import { getEnv } from "@/lib/env";

import type {
  ApiEnvelope,
  Constituent,
  Kline,
  RawConstituent,
  RawKline,
} from "./types";

const BASE_URL = "https://openapi.sosovalue.com/openapi/v1";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;
const DEFAULT_KLINE_LIMIT = 100;
const MAX_KLINE_LIMIT = 500;
const INDEX_TICKER = "ssimag7";

const SYMBOL_ALIASES: Record<string, string> = {
  bitcoin: "btc",
  btc: "btc",
  ethereum: "eth",
  ether: "eth",
  eth: "eth",
  "binance-coin": "bnb",
  binancecoin: "bnb",
  binance: "bnb",
  bnb: "bnb",
  ripple: "xrp",
  xrp: "xrp",
  dogecoin: "doge",
  doge: "doge",
  solana: "sol",
  sol: "sol",
  hyperliquid: "hype",
  hype: "hype",
  cardano: "ada",
  ada: "ada",
};

interface ApiErrorOptions {
  status?: number;
  code?: number;
}

export class SoSoApiError extends Error {
  readonly status?: number;
  readonly code?: number;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "SoSoApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export class SoSoAuthError extends SoSoApiError {
  constructor(message: string, status?: number) {
    super(message, { status });
    this.name = "SoSoAuthError";
  }
}

export class SoSoServerError extends SoSoApiError {
  constructor(message: string, status?: number) {
    super(message, { status });
    this.name = "SoSoServerError";
  }
}

export class SoSoTimeoutError extends SoSoApiError {
  constructor(message: string) {
    super(message);
    this.name = "SoSoTimeoutError";
  }
}

export class SoSoNetworkError extends SoSoApiError {
  constructor(message: string) {
    super(message);
    this.name = "SoSoNetworkError";
  }
}

export class SoSoResponseError extends SoSoApiError {
  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options);
    this.name = "SoSoResponseError";
  }
}

export class SoSoRequestError extends SoSoApiError {
  constructor(message: string) {
    super(message);
    this.name = "SoSoRequestError";
  }
}

export class SoSoSymbolNotFoundError extends SoSoApiError {
  readonly symbol: string;

  constructor(symbol: string) {
    super(`SoSoValue constituent symbol not found: ${symbol}`);
    this.name = "SoSoSymbolNotFoundError";
    this.symbol = symbol;
  }
}

export function normalizeSymbol(symbol: string): string {
  const key = symbol.trim().toLowerCase();
  return SYMBOL_ALIASES[key] ?? key;
}

function getApiKey(): string {
  const apiKey = getEnv().SOSO_API_KEY;

  if (!apiKey) {
    throw new SoSoAuthError("SOSO_API_KEY is not configured");
  }

  return apiKey;
}

function buildUrl(
  path: string,
  query: Record<string, string | number | undefined> = {},
): URL {
  const url = new URL(`${BASE_URL}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function logFailure(url: URL, status?: number, detail?: string): void {
  const statusLabel = status === undefined ? "network" : String(status);
  const detailLabel = detail ? ` (${detail})` : "";
  console.warn(
    `[sosovalue] GET ${url.toString()} failed: ${statusLabel}${detailLabel}`,
  );
}

async function request<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = buildUrl(path, query);
  const headers = {
    "x-soso-api-key": getApiKey(),
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };

  let rateLimitRetries = 0;
  let serverRetryUsed = false;

  for (;;) {
    let timedOut = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429) {
        if (rateLimitRetries >= RETRY_DELAYS_MS.length) {
          logFailure(url, response.status);
          throw new SoSoApiError(
            `SoSoValue rate limit exceeded for ${url.toString()}`,
            { status: response.status },
          );
        }

        const delay = RETRY_DELAYS_MS[rateLimitRetries];
        rateLimitRetries += 1;
        logFailure(url, response.status, `retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        logFailure(url, response.status);
        throw new SoSoAuthError(
          `SoSoValue authentication failed for ${url.toString()}`,
          response.status,
        );
      }

      if (response.status >= 500) {
        if (serverRetryUsed) {
          logFailure(url, response.status);
          throw new SoSoServerError(
            `SoSoValue server error for ${url.toString()}`,
            response.status,
          );
        }

        serverRetryUsed = true;
        logFailure(url, response.status, "retrying once");
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logFailure(url, response.status, body.slice(0, 300));
        throw new SoSoApiError(
          `SoSoValue request failed for ${url.toString()}`,
          { status: response.status },
        );
      }

      let payload: ApiEnvelope<T>;

      try {
        payload = (await response.json()) as ApiEnvelope<T>;
      } catch {
        logFailure(url, response.status, "invalid JSON");
        throw new SoSoResponseError(
          `SoSoValue returned invalid JSON for ${url.toString()}`,
          { status: response.status },
        );
      }

      if (!payload || typeof payload !== "object" || payload.code !== 0) {
        const code =
          payload && typeof payload === "object" ? payload.code : undefined;
        const message =
          payload && typeof payload === "object"
            ? payload.message
            : "unknown error";
        logFailure(url, response.status, `api code ${String(code)}`);
        throw new SoSoResponseError(
          `SoSoValue API error for ${url.toString()}: ${String(message)}`,
          { status: response.status, code },
        );
      }

      return payload.data;
    } catch (error) {
      if (error instanceof SoSoApiError) {
        throw error;
      }

      if (timedOut) {
        logFailure(url, undefined, `timeout after ${REQUEST_TIMEOUT_MS}ms`);
        throw new SoSoTimeoutError(
          `SoSoValue request timed out for ${url.toString()}`,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      logFailure(url, undefined, message);
      throw new SoSoNetworkError(
        `SoSoValue network error for ${url.toString()}: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function ensureArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new SoSoResponseError(`${label} response is not an array`);
  }

  return value;
}

export function parseConstituents(raw: unknown): Constituent[] {
  const rows = ensureArray(raw, "Constituents");

  return rows.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new SoSoResponseError(
        `Constituent at index ${index} is not an object`,
      );
    }

    const record = row as Record<string, unknown>;
    const currencyId = record.currency_id;
    const symbol = record.symbol;
    const weight = record.weight;

    if (typeof currencyId !== "string" || currencyId.length === 0) {
      throw new SoSoResponseError(
        `Constituent at index ${index} has an invalid currency_id`,
      );
    }

    if (typeof symbol !== "string" || symbol.trim().length === 0) {
      throw new SoSoResponseError(
        `Constituent at index ${index} has an invalid symbol`,
      );
    }

    if (weight === undefined || weight === null) {
      throw new SoSoResponseError(
        `Constituent at index ${index} has an invalid weight`,
      );
    }

    const numericWeight = Number(weight);

    if (!Number.isFinite(numericWeight) || numericWeight < 0) {
      throw new SoSoResponseError(
        `Constituent at index ${index} has an invalid weight`,
      );
    }

    return {
      currency_id: currencyId,
      symbol: normalizeSymbol(symbol),
      weight: numericWeight,
    };
  });
}

export function parseKlines(raw: unknown): Kline[] {
  const rows = ensureArray(raw, "Klines");

  const parsed = rows.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new SoSoResponseError(`Kline at index ${index} is not an object`);
    }

    const record = row as Record<string, unknown>;
    const timestamp = Number(record.timestamp);
    const open = Number(record.open);
    const high = Number(record.high);
    const low = Number(record.low);
    const close = Number(record.close);
    const volume =
      record.volume === undefined || record.volume === null
        ? 0
        : Number(record.volume);

    if (!Number.isInteger(timestamp) || timestamp <= 0) {
      throw new SoSoResponseError(
        `Kline at index ${index} has an invalid timestamp`,
      );
    }

    const fields = { open, high, low, close, volume };

    for (const [name, value] of Object.entries(fields)) {
      if (!Number.isFinite(value)) {
        throw new SoSoResponseError(
          `Kline at index ${index} has an invalid ${name}`,
        );
      }
    }

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
      throw new SoSoResponseError(
        `Kline at index ${index} has non-positive values`,
      );
    }

    if (
      high < low ||
      high < open ||
      high < close ||
      low > open ||
      low > close
    ) {
      throw new SoSoResponseError(
        `Kline at index ${index} has inconsistent OHLC values`,
      );
    }

    return { timestamp, open, high, low, close, volume };
  });

  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index].timestamp <= parsed[index - 1].timestamp) {
      throw new SoSoResponseError(
        "Kline timestamps must be strictly ascending",
      );
    }
  }

  return parsed;
}

export async function listIndices(): Promise<string[]> {
  const data = await request<unknown>("/indices");
  const rows = ensureArray(data, "Indices");

  return rows.map((value, index) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new SoSoResponseError(
        `Index at position ${index} is not a non-empty string`,
      );
    }

    return value;
  });
}

export async function getConstituents(
  indexTicker: string,
): Promise<Constituent[]> {
  const ticker = indexTicker.trim();

  if (!ticker) {
    throw new SoSoRequestError("indexTicker is required");
  }

  const data = await request<unknown>(
    `/indices/${encodeURIComponent(ticker)}/constituents`,
  );

  return parseConstituents(data);
}

export async function getCurrencyKlines(
  currencyId: string,
  limit?: number,
): Promise<Kline[]> {
  const id = currencyId.trim();
  const effectiveLimit = limit ?? DEFAULT_KLINE_LIMIT;

  if (!id) {
    throw new SoSoRequestError("currencyId is required");
  }

  if (
    !Number.isInteger(effectiveLimit) ||
    effectiveLimit < 1 ||
    effectiveLimit > MAX_KLINE_LIMIT
  ) {
    throw new SoSoRequestError(
      `limit must be an integer between 1 and ${MAX_KLINE_LIMIT}`,
    );
  }

  const data = await request<unknown>(
    `/currencies/${encodeURIComponent(id)}/klines`,
    { interval: "1d", limit: effectiveLimit },
  );

  return parseKlines(data);
}

let constituentsCache: Promise<Constituent[]> | undefined;

function loadIndexConstituents(): Promise<Constituent[]> {
  if (!constituentsCache) {
    constituentsCache = getConstituents(INDEX_TICKER).catch(
      (error: unknown) => {
        constituentsCache = undefined;
        throw error;
      },
    );
  }

  return constituentsCache;
}

export async function resolveCurrencyId(symbol: string): Promise<string> {
  const normalized = normalizeSymbol(symbol);

  if (!normalized) {
    throw new SoSoRequestError("symbol is required");
  }

  const constituents = await loadIndexConstituents();
  const match = constituents.find(
    (constituent) => constituent.symbol === normalized,
  );

  if (!match) {
    throw new SoSoSymbolNotFoundError(normalized);
  }

  return match.currency_id;
}
