import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { computeDeviations } from "@/lib/pipeline/deviation";
import { validateData } from "@/lib/pipeline/validation";
import { parseConstituents, parseKlines } from "@/lib/sosovalue/client";
import { synthesizeIndexKlines } from "@/lib/sosovalue/synthesize";
import type { Constituent, Kline } from "@/lib/sosovalue/types";

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => ({ SOSO_API_KEY: "soso_test_key" })),
}));

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures", import.meta.url));

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

const DAY_MS = 86_400_000;
const SYNTHETIC_START = Date.UTC(2025, 0, 1);
const RETURN_DAYS = 30;
const WINDOW_BARS = RETURN_DAYS + 1;

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

function klinesFromCloses(closes: number[]): Kline[] {
  return closes.map((close, index) => ({
    timestamp: SYNTHETIC_START + index * DAY_MS,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
}

function closesFromReturns(initialClose: number, returns: number[]): number[] {
  const closes = [initialClose];

  for (const value of returns) {
    closes.push(closes[closes.length - 1] * (1 + value));
  }

  return closes;
}

function withIncompleteTail(closes: number[]): number[] {
  return [...closes, closes[closes.length - 1]];
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

describe("validation gate", () => {
  it("passes with the captured fixtures", () => {
    const result = validateData(constituents, klinesBySymbol, tokenKlines);

    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.trackingError).toBeCloseTo(0.004175, 4);
  });

  it("fails when a constituent is missing from the basket", () => {
    const result = validateData(
      constituents.slice(0, 6),
      klinesBySymbol,
      tokenKlines,
    );

    expect(result).toEqual({
      passed: false,
      reason: "invalid_constituent_count",
    });
  });

  it("fails when a constituent has no kline series", () => {
    const missingBtc = Object.fromEntries(
      Object.entries(klinesBySymbol).filter(([symbol]) => symbol !== "btc"),
    );

    const result = validateData(constituents, missingBtc, tokenKlines);

    expect(result).toEqual({
      passed: false,
      reason: "insufficient_kline_history",
    });
  });

  it("fails when weights sum to 0.8", () => {
    const weightSum = constituents.reduce(
      (sum, constituent) => sum + constituent.weight,
      0,
    );
    const scaledConstituents = constituents.map((constituent) => ({
      ...constituent,
      weight: (constituent.weight * 0.8) / weightSum,
    }));

    const result = validateData(
      scaledConstituents,
      klinesBySymbol,
      tokenKlines,
    );

    expect(result).toEqual({ passed: false, reason: "invalid_weight_sum" });
  });

  it("fails when a constituent has fewer than 30 klines", () => {
    const shortHistory = {
      ...klinesBySymbol,
      btc: klinesBySymbol.btc.slice(-29),
    };

    const result = validateData(constituents, shortHistory, tokenKlines);

    expect(result).toEqual({
      passed: false,
      reason: "insufficient_kline_history",
    });
  });

  it("fails when kline timestamps are misaligned", () => {
    const missingTimestamp = klinesBySymbol.btc.length - 10;
    const misaligned = {
      ...klinesBySymbol,
      btc: klinesBySymbol.btc.filter(
        (_, index) => index !== missingTimestamp,
      ),
    };

    const result = validateData(constituents, misaligned, tokenKlines);

    expect(result).toEqual({ passed: false, reason: "misaligned_klines" });
  });

  it("fails when tracking error exceeds 0.005", () => {
    const windowStart = tokenKlines.length - 1 - WINDOW_BARS;
    const shockedToken = tokenKlines.map((kline, index) => {
      if (index !== windowStart) {
        return kline;
      }

      const close = kline.close * 0.8;

      return {
        ...kline,
        close,
        low: Math.min(kline.low, close),
        high: Math.max(kline.high, close),
      };
    });

    const result = validateData(constituents, klinesBySymbol, shockedToken);

    expect(result.passed).toBe(false);
    expect(result.reason).toBe("tracking_error_too_high");
    expect(result.trackingError).toBeGreaterThan(0.005);
  });

  it("passes with exactly 30 aligned klines per series", () => {
    const lastThirty = (klines: Kline[]) => klines.slice(-30);
    const shortHistory = Object.fromEntries(
      Object.entries(klinesBySymbol).map(([symbol, klines]) => [
        symbol,
        lastThirty(klines),
      ]),
    );

    const result = validateData(
      constituents,
      shortHistory,
      lastThirty(tokenKlines),
    );

    expect(result.passed).toBe(true);
  });
});

describe("deviation engine", () => {
  it("returns one signal per constituent from the captured fixtures", () => {
    const signals = computeDeviations(
      constituents,
      klinesBySymbol,
      syntheticKlines,
    );

    expect(signals).toHaveLength(7);
    expect(signals.map((signal) => signal.symbol).sort()).toEqual(
      constituents.map((constituent) => constituent.symbol).sort(),
    );

    for (const signal of signals) {
      const constituent = constituents.find(
        (entry) => entry.symbol === signal.symbol,
      );

      expect(constituent).toBeDefined();
      expect(signal.weight).toBe(constituent?.weight);
      expect(Number.isFinite(signal.constituentReturn)).toBe(true);
      expect(Number.isFinite(signal.indexReturn)).toBe(true);
      expect(Number.isFinite(signal.weightDeviation)).toBe(true);
      expect(Number.isFinite(signal.zScore)).toBe(true);
      expect(signal.weightDeviation).toBeCloseTo(
        signal.weight * (signal.constituentReturn - signal.indexReturn),
        12,
      );
      expect(signal.direction).toBe(
        signal.weightDeviation > 0 ? "overextended" : "lagging",
      );
    }

    for (let index = 1; index < signals.length; index += 1) {
      expect(Math.abs(signals[index - 1].zScore)).toBeGreaterThanOrEqual(
        Math.abs(signals[index].zScore),
      );
    }
  });

  it("uses the last complete daily return for the fixtures", () => {
    const signals = computeDeviations(
      constituents,
      klinesBySymbol,
      syntheticKlines,
    );
    const btc = signals.find((signal) => signal.symbol === "btc");

    expect(btc).toBeDefined();

    const completeBtc = klinesBySymbol.btc.slice(0, -1);
    const expectedBtcReturn =
      completeBtc[completeBtc.length - 1].close /
        completeBtc[completeBtc.length - 2].close -
      1;
    const completeIndex = syntheticKlines.slice(0, -1);
    const expectedIndexReturn =
      completeIndex[completeIndex.length - 1].close /
        completeIndex[completeIndex.length - 2].close -
      1;

    expect(btc?.constituentReturn).toBeCloseTo(expectedBtcReturn, 12);
    expect(btc?.indexReturn).toBeCloseTo(expectedIndexReturn, 12);
  });

  it("computes weightDeviation from the latest daily returns", () => {
    const constituentReturns: number[] = [...Array(29).fill(0), 0.1];
    const indexReturns: number[] = [...Array(29).fill(0), 0.02];
    const constituentKlines = klinesFromCloses(
      withIncompleteTail(closesFromReturns(100, constituentReturns)),
    );
    const indexKlines = klinesFromCloses(
      withIncompleteTail(closesFromReturns(100, indexReturns)),
    );

    const [signal] = computeDeviations(
      [{ currency_id: "btc-id", symbol: "btc", weight: 0.3 }],
      { btc: constituentKlines },
      indexKlines,
    );

    expect(signal.constituentReturn).toBeCloseTo(0.1, 10);
    expect(signal.indexReturn).toBeCloseTo(0.02, 10);
    expect(signal.weightDeviation).toBeCloseTo(0.024, 10);
    expect(signal.direction).toBe("overextended");
  });

  it("computes a robust z-score of approximately 2 for a two-MAD outlier", () => {
    const mad = 0.01;
    const outlier = 2 * 1.4826 * mad;
    const constituentReturns: number[] = [
      ...Array(15).fill(-mad),
      ...Array(14).fill(mad),
      outlier,
    ];
    const constituentKlines = klinesFromCloses(
      withIncompleteTail(closesFromReturns(100, constituentReturns)),
    );
    const indexKlines = klinesFromCloses(
      withIncompleteTail(Array.from({ length: 31 }, () => 100)),
    );

    const [signal] = computeDeviations(
      [{ currency_id: "btc-id", symbol: "btc", weight: 1 }],
      { btc: constituentKlines },
      indexKlines,
    );

    expect(signal.zScore).toBeCloseTo(2, 6);
  });

  it("falls back to standard deviation when MAD is zero and returns 0 when dispersion is zero", () => {
    const constituentReturns: number[] = [...Array(29).fill(0), 0.02];
    const constituentKlines = klinesFromCloses(
      withIncompleteTail(closesFromReturns(100, constituentReturns)),
    );
    const indexKlines = klinesFromCloses(
      withIncompleteTail(Array.from({ length: 31 }, () => 100)),
    );

    const [signal] = computeDeviations(
      [{ currency_id: "btc-id", symbol: "btc", weight: 1 }],
      { btc: constituentKlines },
      indexKlines,
    );

    expect(signal.zScore).toBeGreaterThan(1);

    const flatReturns = Array.from(
      { length: RETURN_DAYS },
      (_, index) => ((index % 3) - 1) * 0.01,
    );
    const flatCloses = withIncompleteTail(
      closesFromReturns(100, flatReturns),
    );
    const flatKlines = klinesFromCloses(flatCloses);

    const [flatSignal] = computeDeviations(
      [{ currency_id: "btc-id", symbol: "btc", weight: 1 }],
      { btc: flatKlines },
      flatKlines,
    );

    expect(flatSignal.zScore).toBe(0);
    expect(flatSignal.direction).toBe("lagging");
  });

  it("ranks signals by absolute z-score and assigns direction from the sign", () => {
    const indexKlines = klinesFromCloses(
      withIncompleteTail(Array.from({ length: 31 }, () => 100)),
    );
    const btcKlines = klinesFromCloses(
      withIncompleteTail(
        closesFromReturns(100, [...Array(29).fill(0), 0.04]),
      ),
    );
    const ethKlines = klinesFromCloses(
      withIncompleteTail(
        closesFromReturns(100, [...Array(28).fill(0), -0.01, -0.02]),
      ),
    );

    const signals = computeDeviations(
      [
        { currency_id: "btc-id", symbol: "btc", weight: 0.5 },
        { currency_id: "eth-id", symbol: "eth", weight: 0.5 },
      ],
      { btc: btcKlines, eth: ethKlines },
      indexKlines,
    );

    expect(signals.map((signal) => signal.symbol)).toEqual(["btc", "eth"]);
    expect(signals[0].direction).toBe("overextended");
    expect(signals[1].direction).toBe("lagging");
    expect(signals[0].weightDeviation).toBeCloseTo(0.02, 10);
    expect(signals[1].weightDeviation).toBeCloseTo(-0.01, 10);
    expect(Math.abs(signals[0].zScore)).toBeGreaterThan(
      Math.abs(signals[1].zScore),
    );
  });
});
