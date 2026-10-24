import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  parseConstituents,
  parseKlines,
  resolveCurrencyId,
} from "@/lib/sosovalue/client";
import { synthesizeIndexKlines } from "@/lib/sosovalue/synthesize";
import type { Constituent, Kline } from "@/lib/sosovalue/types";

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => ({ SOSO_API_KEY: "soso_test_key" })),
}));

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures", import.meta.url));

const INDICES_FIXTURE = "indices.json";
const CONSTITUENTS_FIXTURE = "ssimag7-constituents.json";
const TOKEN_FIXTURE = "ssimag7-token-klines.json";

const KLINE_FIXTURES: Record<string, string> = {
  btc: "btc-klines.json",
  eth: "eth-klines.json",
  xrp: "xrp-klines.json",
  bnb: "bnb-klines.json",
  sol: "sol-klines.json",
  doge: "doge-klines.json",
  hype: "hype-klines.json",
};

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
  details: unknown;
}

function loadFixture<T>(name: string): T {
  const filePath = `${FIXTURES_DIR}/${name}`;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function loadEnvelope<T>(name: string): Envelope<T> {
  const envelope = loadFixture<Envelope<T>>(name);
  expect(envelope.code).toBe(0);
  return envelope;
}

function loadConstituents(): Constituent[] {
  return parseConstituents(loadEnvelope<unknown>(CONSTITUENTS_FIXTURE).data);
}

function loadKlines(name: string): Kline[] {
  return parseKlines(loadEnvelope<unknown>(name).data);
}

let constituents: Constituent[];
let klinesBySymbol: Record<string, Kline[]>;
let syntheticKlines: Kline[];
let tokenKlines: Kline[];

beforeAll(() => {
  constituents = loadConstituents();
  klinesBySymbol = {};

  for (const [symbol, fixture] of Object.entries(KLINE_FIXTURES)) {
    klinesBySymbol[symbol] = loadKlines(fixture);
  }

  syntheticKlines = synthesizeIndexKlines(constituents, klinesBySymbol);
  tokenKlines = loadKlines(TOKEN_FIXTURE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sosovalue fixtures", () => {
  it("parses every captured fixture without throwing", () => {
    expect(() => loadEnvelope(INDICES_FIXTURE)).not.toThrow();
    expect(() => loadConstituents()).not.toThrow();

    for (const fixture of Object.values(KLINE_FIXTURES)) {
      expect(() => loadKlines(fixture)).not.toThrow();
    }

    expect(() => loadKlines(TOKEN_FIXTURE)).not.toThrow();
  });

  it("has exactly seven constituents", () => {
    expect(constituents).toHaveLength(7);
  });

  it("has weights that sum to approximately 1", () => {
    const sum = constituents.reduce(
      (total, constituent) => total + constituent.weight,
      0,
    );

    expect(sum).toBeGreaterThanOrEqual(0.99);
    expect(sum).toBeLessThanOrEqual(1.01);
  });

  it("synthesizes at least 30 aligned index klines", () => {
    expect(syntheticKlines.length).toBeGreaterThanOrEqual(30);
  });

  it("has numeric kline fields everywhere", () => {
    const allKlines = [
      ...Object.values(klinesBySymbol).flat(),
      ...tokenKlines,
      ...syntheticKlines,
    ];

    for (const kline of allKlines) {
      for (const field of [
        "timestamp",
        "open",
        "high",
        "low",
        "close",
        "volume",
      ] as const) {
        expect(typeof kline[field]).toBe("number");
        expect(Number.isFinite(kline[field])).toBe(true);
        expect(Number.isNaN(kline[field])).toBe(false);
      }
    }
  });

  it("has strictly ascending kline timestamps", () => {
    const series = [
      ...Object.values(klinesBySymbol),
      tokenKlines,
      syntheticKlines,
    ];

    for (const klines of series) {
      for (let index = 1; index < klines.length; index += 1) {
        expect(klines[index].timestamp).toBeGreaterThan(
          klines[index - 1].timestamp,
        );
      }
    }
  });

  it("includes btc with a non-empty currency_id", () => {
    const btc = constituents.find(
      (constituent) => constituent.symbol === "btc",
    );

    expect(btc).toBeDefined();
    expect(typeof btc?.currency_id).toBe("string");
    expect(btc?.currency_id.length).toBeGreaterThan(0);
  });

  it("resolves btc to the fixture currency_id and caches constituents", async () => {
    const envelope = loadEnvelope<unknown>(CONSTITUENTS_FIXTURE);
    const rawBtc = (
      envelope.data as Array<{ currency_id: string; symbol: string }>
    ).find((constituent) => constituent.symbol === "bitcoin");

    expect(rawBtc).toBeDefined();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveCurrencyId("btc")).resolves.toBe(rawBtc?.currency_id);
    await expect(resolveCurrencyId("bitcoin")).resolves.toBe(
      rawBtc?.currency_id,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toContain("/indices/ssimag7/constituents");
    expect((requestInit as RequestInit).headers).toMatchObject({
      "x-soso-api-key": "soso_test_key",
    });
  });

  it("keeps the 30-day synthetic return within 0.5% of the token", () => {
    const returnDays = 30;
    const windowSize = returnDays + 1;

    const completeSynthetic = syntheticKlines.slice(0, -1);
    const completeToken = tokenKlines.slice(0, -1);
    const tokenByTimestamp = new Map(
      completeToken.map((kline) => [kline.timestamp, kline]),
    );
    const aligned = completeSynthetic.filter((kline) =>
      tokenByTimestamp.has(kline.timestamp),
    );

    expect(aligned.length).toBeGreaterThanOrEqual(windowSize);

    const end = aligned[aligned.length - 1];
    const start = aligned[aligned.length - windowSize];
    const tokenEnd = tokenByTimestamp.get(end.timestamp);
    const tokenStart = tokenByTimestamp.get(start.timestamp);

    if (!tokenEnd || !tokenStart) {
      throw new Error("Token fixture is missing an aligned timestamp");
    }

    const syntheticReturn = end.close / start.close - 1;
    const tokenReturn = tokenEnd.close / tokenStart.close - 1;

    expect(Math.abs(syntheticReturn - tokenReturn)).toBeLessThan(0.005);
  });
});
