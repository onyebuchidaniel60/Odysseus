import { randomUUID } from "node:crypto";

import { concatHex, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getEnv } from "../env";

export interface OrderLeg {
  symbol: string;
  side: "LONG" | "SHORT";
  sizeUsd: number;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  legs: Array<{
    symbol: string;
    orderId: string;
    status: string;
  }>;
  error?: string;
}

export type Market = "spot" | "perps";

interface SignedOrder {
  market: Market;
  action: "batchNewOrder" | "newOrder";
  params: Record<string, unknown>;
}

interface MarketSymbol {
  id: number;
  name: string;
  displayName?: string;
  baseCoin?: string;
  quantityPrecision: number;
  stepSize: string;
  minQuantity: string;
  minNotional: string;
}

interface ExecutionCache {
  symbols: Map<Market, Promise<MarketSymbol[]>>;
  tickers?: Promise<Map<string, number>>;
}

interface LegResponse {
  orderId?: string;
  error?: string;
}

const MOCK_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;
const TESTNET_CHAIN_ID = 138565;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SIDE_BUY = 1;
const SIDE_SELL = 2;
const TYPE_MARKET = 2;
const TIME_IN_FORCE_IOC = 3;
const ORDER_MODIFIER_NORMAL = 1;
const POSITION_SIDE_BOTH = 1;
const TICKER_ALIASES: Record<string, string> = {
  ssimag7: "mag7ssi",
};

let lastNonce = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nextNonce(): bigint {
  const now = Date.now();
  lastNonce = Math.max(now, lastNonce + 1);
  return BigInt(lastNonce);
}

function truncate(value: string, maxLength = 300): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...`
    : value;
}

function sideCode(leg: OrderLeg): number {
  return leg.side === "LONG" ? SIDE_BUY : SIDE_SELL;
}

function apiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

function endpointFor(baseUrl: string, market: Market): string {
  const suffix =
    market === "spot" ? "/spot/trade/orders/batch" : "/perps/trade/orders";
  return `${apiBaseUrl(baseUrl)}${suffix}`;
}

function parseAccountId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("SODEX_ACCOUNT_ID must be a uint64 string");
  }

  const parsed = BigInt(value);

  if (
    parsed <= BigInt(0) ||
    parsed > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      "SODEX_ACCOUNT_ID must fit in a safe integer for order JSON",
    );
  }

  return Number(parsed);
}

function normalizeTicker(value: string): string {
  const normalized = value.trim().toLowerCase();
  return TICKER_ALIASES[normalized] ?? normalized.replace(/^v/, "");
}

function matchesTicker(symbol: MarketSymbol, ticker: string): boolean {
  const target = normalizeTicker(ticker);
  const candidates = [
    symbol.baseCoin,
    symbol.name.split(/[-_]/)[0],
    symbol.displayName?.split("/")[0],
  ];

  return candidates.some(
    (candidate) => candidate && normalizeTicker(candidate) === target,
  );
}

function parseMarketSymbols(payload: unknown): MarketSymbol[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("sodex_markets_unexpected_response");
  }

  const record = payload as Record<string, unknown>;
  const code = record.code;

  if (typeof code === "number" && code !== 0) {
    const message = extractErrorMessage(
      record.error ?? record.message ?? record.msg ?? record.details,
    );
    throw new Error(
      `sodex_markets_error_${code}${message ? `: ${message}` : ""}`,
    );
  }

  if (!Array.isArray(record.data)) {
    throw new Error("sodex_markets_invalid_data");
  }

  return record.data.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`sodex_markets_invalid_symbol_at_${index}`);
    }

    const symbol = entry as Record<string, unknown>;
    const id = Number(symbol.id);
    const name = symbol.name;

    if (!Number.isInteger(id) || id <= 0 || typeof name !== "string") {
      throw new Error(`sodex_markets_invalid_symbol_at_${index}`);
    }

    return {
      id,
      name,
      displayName:
        typeof symbol.displayName === "string"
          ? symbol.displayName
          : undefined,
      baseCoin:
        typeof symbol.baseCoin === "string" ? symbol.baseCoin : undefined,
      quantityPrecision:
        typeof symbol.quantityPrecision === "number"
          ? symbol.quantityPrecision
          : 0,
      stepSize:
        typeof symbol.stepSize === "string" ? symbol.stepSize : "1",
      minQuantity:
        typeof symbol.minQuantity === "string" ? symbol.minQuantity : "0",
      minNotional:
        typeof symbol.minNotional === "string" ? symbol.minNotional : "0",
    };
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `sodex_markets_http_${response.status}: ${truncate(body)}`,
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("sodex_markets_invalid_json");
  }
}

async function loadMarketSymbols(
  baseUrl: string,
  market: Market,
  cache: ExecutionCache,
): Promise<MarketSymbol[]> {
  const cached = cache.symbols.get(market);

  if (cached) {
    return cached;
  }

  const promise = fetchJson(
    `${apiBaseUrl(baseUrl)}/${market}/markets/symbols`,
  ).then(parseMarketSymbols);
  cache.symbols.set(market, promise);

  return promise;
}

async function resolveMarketSymbol(
  ticker: string,
  market: Market,
  baseUrl: string,
  cache: ExecutionCache,
): Promise<MarketSymbol> {
  const symbols = await loadMarketSymbols(baseUrl, market, cache);
  const symbol = symbols.find((entry) => matchesTicker(entry, ticker));

  if (!symbol) {
    throw new Error(`sodex_symbol_not_found:${market}:${ticker}`);
  }

  return symbol;
}

export async function getSymbolId(
  ticker: string,
  market: Market,
): Promise<number> {
  const env = getEnv();
  const symbol = await resolveMarketSymbol(ticker, market, env.SODEX_BASE_URL, {
    symbols: new Map(),
  });

  return symbol.id;
}

function parseAskNotional(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    throw new Error("sodex_orderbook_unexpected_response");
  }

  const record = payload as Record<string, unknown>;
  const code = record.code;

  if (typeof code === "number" && code !== 0) {
    throw new Error(`sodex_orderbook_error_${code}`);
  }

  const data = record.data;

  if (!data || typeof data !== "object") {
    throw new Error("sodex_orderbook_invalid_data");
  }

  const asks = (data as Record<string, unknown>).asks;

  if (!Array.isArray(asks)) {
    throw new Error("sodex_orderbook_invalid_asks");
  }

  let notional = 0;

  for (const ask of asks) {
    if (!Array.isArray(ask) || ask.length < 2) {
      continue;
    }

    const price = Number(ask[0]);
    const quantity = Number(ask[1]);

    if (
      Number.isFinite(price) &&
      Number.isFinite(quantity) &&
      price > 0 &&
      quantity > 0
    ) {
      notional += price * quantity;
    }
  }

  return notional;
}

async function assertSpotLiquidity(
  leg: OrderLeg,
  baseUrl: string,
  cache: ExecutionCache,
): Promise<void> {
  const symbol = await resolveMarketSymbol(
    leg.symbol,
    "spot",
    baseUrl,
    cache,
  );
  const payload = await fetchJson(
    `${apiBaseUrl(baseUrl)}/spot/markets/${encodeURIComponent(
      symbol.name,
    )}/orderbook?limit=20`,
  );
  const notional = parseAskNotional(payload);

  if (notional < leg.sizeUsd) {
    throw new Error(
      `sodex_insufficient_spot_liquidity:${symbol.name}:${notional.toFixed(2)}`,
    );
  }
}

function parsePerpsTickers(payload: unknown): Map<string, number> {
  if (!payload || typeof payload !== "object") {
    throw new Error("sodex_tickers_unexpected_response");
  }

  const record = payload as Record<string, unknown>;
  const code = record.code;

  if (typeof code === "number" && code !== 0) {
    throw new Error(`sodex_tickers_error_${code}`);
  }

  if (!Array.isArray(record.data)) {
    throw new Error("sodex_tickers_invalid_data");
  }

  const prices = new Map<string, number>();

  for (const entry of record.data) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const ticker = entry as Record<string, unknown>;
    const symbol = ticker.symbol;
    const markPrice = Number(ticker.markPrice);

    if (
      typeof symbol === "string" &&
      Number.isFinite(markPrice) &&
      markPrice > 0
    ) {
      prices.set(symbol, markPrice);
    }
  }

  return prices;
}

async function resolveMarkPrice(
  symbolName: string,
  baseUrl: string,
  cache: ExecutionCache,
): Promise<number> {
  if (!cache.tickers) {
    cache.tickers = fetchJson(
      `${apiBaseUrl(baseUrl)}/perps/markets/mark-prices`,
    ).then(parsePerpsTickers);
  }

  const prices = await cache.tickers;
  const markPrice = prices.get(symbolName);

  if (!markPrice) {
    throw new Error(`sodex_mark_price_not_found:${symbolName}`);
  }

  return markPrice;
}

function roundToStep(
  value: number,
  stepSize: string,
  precision: number,
): number {
  const step = Number(stepSize);

  if (!Number.isFinite(step) || step <= 0) {
    return Number(value.toFixed(precision));
  }

  return Number((Math.round(value / step) * step).toFixed(precision));
}

function formatDecimal(value: number, precision: number): string {
  const fixed = value.toFixed(precision);

  return fixed.includes(".")
    ? fixed.replace(/0+$/, "").replace(/\.$/, "")
    : fixed;
}

function buildPerpsQuantity(
  sizeUsd: number,
  markPrice: number,
  symbol: MarketSymbol,
): string {
  const precision = Number.isInteger(symbol.quantityPrecision)
    ? symbol.quantityPrecision
    : 0;
  const step = Number(symbol.stepSize);
  const minQuantity = Number(symbol.minQuantity);
  const minNotional = Number(symbol.minNotional);
  let quantity = roundToStep(
    sizeUsd / markPrice,
    symbol.stepSize,
    precision,
  );

  if (Number.isFinite(minQuantity) && quantity < minQuantity) {
    quantity = minQuantity;
  }

  let guard = 0;

  while (
    Number.isFinite(minNotional) &&
    minNotional > 0 &&
    quantity * markPrice < minNotional &&
    guard < 1_000
  ) {
    quantity = roundToStep(
      quantity + (Number.isFinite(step) && step > 0 ? step : 10 ** -precision),
      symbol.stepSize,
      precision,
    );
    guard += 1;
  }

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    (Number.isFinite(minNotional) &&
      minNotional > 0 &&
      quantity * markPrice < minNotional)
  ) {
    throw new Error(`sodex_min_notional_not_met:${symbol.name}`);
  }

  return formatDecimal(quantity, precision);
}

function buildSignedOrder(
  leg: OrderLeg,
  accountId: number,
  symbolId: number,
  clientOrderId: string,
  quantity?: string,
): SignedOrder {
  const side = sideCode(leg);

  if (leg.side === "LONG") {
    return {
      market: "spot",
      action: "batchNewOrder",
      params: {
        accountID: accountId,
        orders: [
          {
            symbolID: symbolId,
            clOrdID: clientOrderId,
            side,
            type: TYPE_MARKET,
            timeInForce: TIME_IN_FORCE_IOC,
            funds: leg.sizeUsd.toString(),
          },
        ],
      },
    };
  }

  if (!quantity) {
    throw new Error("perps_quantity_required");
  }

  return {
    market: "perps",
    action: "newOrder",
    params: {
      accountID: accountId,
      symbolID: symbolId,
      orders: [
        {
          clOrdID: clientOrderId,
          modifier: ORDER_MODIFIER_NORMAL,
          side,
          type: TYPE_MARKET,
          timeInForce: TIME_IN_FORCE_IOC,
          quantity,
          reduceOnly: false,
          positionSide: POSITION_SIDE_BOTH,
        },
      ],
    },
  };
}

async function signOrder(
  order: SignedOrder,
  privateKey: string,
  nonce: bigint,
): Promise<string> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const payloadHash = keccak256(
    toHex(
      JSON.stringify({
        type: order.action,
        params: order.params,
      }),
    ),
  );

  const signature = await account.signTypedData({
    domain: {
      name: order.market === "spot" ? "spot" : "futures",
      version: "1",
      chainId: TESTNET_CHAIN_ID,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    } as const,
    primaryType: "ExchangeAction",
    message: {
      payloadHash,
      nonce,
    },
  });

  const recovery = Number.parseInt(signature.slice(-2), 16);
  const wireSignature = (signature.slice(0, -2) +
    (recovery >= 27 ? recovery - 27 : recovery)
      .toString(16)
      .padStart(2, "0")) as `0x${string}`;

  return concatHex(["0x01", wireSignature]);
}

function extractErrorMessage(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractErrorMessage(
      record.message ?? record.msg ?? record.error ?? record.detail,
    );
  }

  return "";
}

function parseOrderResponse(
  body: string,
  clientOrderId: string,
): LegResponse {
  let envelope: unknown;

  try {
    envelope = JSON.parse(body);
  } catch {
    return { error: "sodex_invalid_json_response" };
  }

  if (!envelope || typeof envelope !== "object") {
    return { error: "sodex_unexpected_response" };
  }

  const record = envelope as Record<string, unknown>;
  const code = record.code;

  if (typeof code === "number" && code !== 0) {
    const message = extractErrorMessage(
      record.error ?? record.message ?? record.msg ?? record.details,
    );
    return {
      error: `sodex_error_${code}${message ? `: ${message}` : ""}`,
    };
  }

  const data = record.data;
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  if (rows.length === 0) {
    return { error: "sodex_empty_order_response" };
  }

  const first = rows[0];

  if (!first || typeof first !== "object") {
    return { error: "sodex_unexpected_order_response" };
  }

  const order = first as Record<string, unknown>;
  const orderCode = order.code;

  if (typeof orderCode === "number" && orderCode !== 0) {
    const message = extractErrorMessage(order.error ?? order.message);
    return {
      error: `sodex_order_error_${orderCode}${message ? `: ${message}` : ""}`,
    };
  }

  const orderId = order.orderID ?? order.orderId ?? order.id;
  const responseClientOrderId = order.clOrdID;

  return {
    orderId:
      orderId !== undefined && orderId !== null
        ? String(orderId)
        : typeof responseClientOrderId === "string"
          ? responseClientOrderId
          : clientOrderId,
  };
}

async function postSignedOrder(
  order: SignedOrder,
  signature: string,
  nonce: bigint,
  apiKeyName: string,
  baseUrl: string,
  batchClientOrderId: string,
): Promise<LegResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpointFor(baseUrl, order.market), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKeyName,
        "X-API-Sign": signature,
        "X-API-Nonce": nonce.toString(),
        "X-API-Chain": String(TESTNET_CHAIN_ID),
        "X-Client-Order-ID": batchClientOrderId,
      },
      body: JSON.stringify(order.params),
      signal: controller.signal,
    });

    const body = await response.text();

    if (!response.ok) {
      const rawMessage = truncate(body);
      let message = rawMessage;

      try {
        const envelope: unknown = JSON.parse(body);

        if (envelope && typeof envelope === "object") {
          const record = envelope as Record<string, unknown>;
          message =
            extractErrorMessage(
              record.error ??
                record.message ??
                record.msg ??
                record.details,
            ) || rawMessage;
        }
      } catch {
        message = rawMessage;
      }

      return {
        error: `sodex_http_${response.status}${message ? `: ${message}` : ""}`,
      };
    }

    return parseOrderResponse(body, batchClientOrderId);
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        error: `sodex_timeout_after_${REQUEST_TIMEOUT_MS}ms`,
      };
    }

    return {
      error: `sodex_request_failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function reconcileOrderStatus(
  orderId: string,
  market: Market,
  symbolName: string,
  accountId: number,
  userAddress: string,
  baseUrl: string,
): Promise<string> {
  const engine = market === "spot" ? "spot" : "perps";
  const url = `${apiBaseUrl(baseUrl)}/${engine}/accounts/${userAddress}/orders/history?accountID=${accountId}&symbol=${encodeURIComponent(
    symbolName,
  )}&limit=50`;

  try {
    const payload = await fetchJson(url);
    const record = payload as { data?: unknown };
    const orders = Array.isArray(record.data) ? record.data : [];
    const match = orders.find((order) => {
      if (!order || typeof order !== "object") {
        return false;
      }

      return String((order as Record<string, unknown>).orderID) === orderId;
    });

    if (!match || typeof match !== "object") {
      return "submitted";
    }

    const status = (match as Record<string, unknown>).status;

    if (typeof status !== "string") {
      return "submitted";
    }

    const normalized = status.toLowerCase();
    return normalized === "new" ? "submitted" : normalized;
  } catch {
    return "submitted";
  }
}

async function placeMockOrders(legs: OrderLeg[]): Promise<ExecutionResult> {
  await sleep(MOCK_DELAY_MS);

  return {
    success: true,
    legs: legs.map((leg) => ({
      symbol: leg.symbol,
      orderId: randomUUID(),
      status: "filled",
    })),
  };
}

export async function placeOrders(
  legs: OrderLeg[],
  mock: boolean,
): Promise<ExecutionResult> {
  if (mock) {
    return placeMockOrders(legs);
  }

  if (legs.length === 0) {
    return {
      success: false,
      error: "no_order_legs",
      legs: [],
    };
  }

  const batchClientOrderId = randomUUID();
  const results: ExecutionResult["legs"] = [];
  const cache: ExecutionCache = { symbols: new Map() };
  let env: ReturnType<typeof getEnv>;
  let accountId: number;

  try {
    env = getEnv();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      legs: legs.map((leg) => ({
        symbol: leg.symbol,
        orderId: batchClientOrderId,
        status: "rejected",
      })),
    };
  }

  try {
    accountId = parseAccountId(env.SODEX_ACCOUNT_ID);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      legs: legs.map((leg) => ({
        symbol: leg.symbol,
        orderId: batchClientOrderId,
        status: "rejected",
      })),
    };
  }

  const userAddress = privateKeyToAccount(
    env.SODEX_API_KEY_PRIVATE_KEY as `0x${string}`,
  ).address;

  for (const leg of legs) {
    if (leg.side !== "LONG") {
      continue;
    }

    try {
      await assertSpotLiquidity(leg, env.SODEX_BASE_URL, cache);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        legs: legs.map((entry) => ({
          symbol: entry.symbol,
          orderId: batchClientOrderId,
          status: "rejected",
        })),
      };
    }
  }

  for (const [index, leg] of legs.entries()) {
    if (!Number.isFinite(leg.sizeUsd) || leg.sizeUsd <= 0) {
      return {
        success: false,
        error: "OrderLeg.sizeUsd must be a positive finite number",
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: batchClientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    const clientOrderId = `${batchClientOrderId
      .replace(/-/g, "")
      .slice(0, 28)}${String(index).padStart(2, "0")}`;
    const market: Market = leg.side === "LONG" ? "spot" : "perps";
    let symbol: MarketSymbol;
    let quantity: string | undefined;

    try {
      symbol = await resolveMarketSymbol(
        leg.symbol,
        market,
        env.SODEX_BASE_URL,
        cache,
      );

      if (market === "perps") {
        const markPrice = await resolveMarkPrice(
          symbol.name,
          env.SODEX_BASE_URL,
          cache,
        );
        quantity = buildPerpsQuantity(leg.sizeUsd, markPrice, symbol);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: clientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    const order = buildSignedOrder(
      leg,
      accountId,
      symbol.id,
      clientOrderId,
      quantity,
    );
    const nonce = nextNonce();
    let signature: string;

    try {
      signature = await signOrder(
        order,
        env.SODEX_API_KEY_PRIVATE_KEY,
        nonce,
      );
    } catch (error) {
      return {
        success: false,
        error: `sodex_signing_failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: clientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    const response = await postSignedOrder(
      order,
      signature,
      nonce,
      env.SODEX_API_KEY_NAME,
      env.SODEX_BASE_URL,
      batchClientOrderId,
    );

    if (response.error) {
      return {
        success: false,
        error: response.error,
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: clientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    const orderId = response.orderId ?? clientOrderId;
    const status = response.orderId
      ? await reconcileOrderStatus(
          orderId,
          market,
          symbol.name,
          accountId,
          userAddress,
          env.SODEX_BASE_URL,
        )
      : "submitted";

    results.push({
      symbol: leg.symbol,
      orderId,
      status,
    });

    if (status === "canceled" || status === "expired" || status === "rejected") {
      return {
        success: false,
        error: `sodex_order_not_filled:${leg.symbol}:${status}`,
        legs: results,
      };
    }
  }

  return {
    success: true,
    orderId: batchClientOrderId,
    legs: results,
  };
}
