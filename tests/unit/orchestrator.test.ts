import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sosovalue/client", () => ({
  listIndices: vi.fn(),
  getConstituents: vi.fn(),
  getCurrencyKlines: vi.fn(),
}));

vi.mock("@/lib/pipeline/agents", () => ({
  runBullAgent: vi.fn(),
  runBearAgent: vi.fn(),
  runChiefAgent: vi.fn(),
}));

vi.mock("@/lib/sodex/client", () => ({
  placeOrders: vi.fn(),
}));

import {
  runBearAgent,
  runBullAgent,
  runChiefAgent,
} from "@/lib/pipeline/agents";
import {
  processSnapshot,
  RunAlreadyExistsError,
  runPipeline,
  type DecisionInput,
  type DecisionUpdate,
  type ExecutionInput,
  type PipelineStore,
  type RiskCheckInput,
  type SnapshotInput,
  type SnapshotUpdate,
} from "@/lib/pipeline/orchestrator";
import type { DeviationSignal } from "@/lib/pipeline/deviation";
import { placeOrders } from "@/lib/sodex/client";
import {
  getConstituents,
  getCurrencyKlines,
  listIndices,
} from "@/lib/sosovalue/client";
import { synthesizeIndexKlines } from "@/lib/sosovalue/synthesize";
import type { Constituent, Kline } from "@/lib/sosovalue/types";

const START = Date.UTC(2025, 0, 1);
const DAY_MS = 86_400_000;
const TOKEN_CURRENCY_ID = "1871600836616355842";
const SYMBOLS = ["btc", "eth", "bnb", "xrp", "sol", "doge", "hype"];
const WEIGHTS = [0.4, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05];
const CURRENCY_IDS = Object.fromEntries(
  SYMBOLS.map((symbol) => [symbol, `currency-${symbol}`]),
);
const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures", import.meta.url));

function loadFixture(name: string): unknown {
  const envelope = JSON.parse(
    fs.readFileSync(`${FIXTURES_DIR}/${name}`, "utf8"),
  ) as { data: unknown };

  return envelope.data;
}

interface MarketData {
  constituents: Constituent[];
  klinesBySymbol: Record<string, Kline[]>;
  syntheticKlines: Kline[];
}

function makeKlines(returns: number[]): Kline[] {
  const closes = [100];

  for (const value of returns) {
    closes.push(closes[closes.length - 1] * (1 + value));
  }

  return closes.map((close, index) => ({
    timestamp: START + index * DAY_MS,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
}

function buildMarketData(): MarketData {
  const constituents = SYMBOLS.map((symbol, index) => ({
    currency_id: CURRENCY_IDS[symbol],
    symbol,
    weight: WEIGHTS[index],
  }));
  const klinesBySymbol: Record<string, Kline[]> = {};

  for (const symbol of SYMBOLS) {
    const returns = Array.from({ length: 89 }, () => 0);

    if (symbol === "btc") {
      returns[87] = 0.1;
    }

    klinesBySymbol[symbol] = makeKlines(returns);
  }

  return {
    constituents,
    klinesBySymbol,
    syntheticKlines: synthesizeIndexKlines(constituents, klinesBySymbol),
  };
}

class FakeStore implements PipelineStore {
  snapshots: Array<{ id: string; input: SnapshotInput }> = [];
  snapshotUpdates: Array<{ id: string; update: SnapshotUpdate }> = [];
  signals: Array<{
    id: string;
    snapshotId: string;
    signal: DeviationSignal;
  }> = [];
  decisions: Array<{ id: string; input: DecisionInput }> = [];
  decisionUpdates: Array<{ id: string; update: DecisionUpdate }> = [];
  riskChecks: Array<{ id: string; input: RiskCheckInput }> = [];
  executions: Array<{ id: string; input: ExecutionInput }> = [];
  audit: Array<{
    runId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }> = [];
  conflict = false;
  existingRunId: string | undefined = "existing-run";
  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  async createSnapshot(input: SnapshotInput): Promise<{ id: string }> {
    if (this.conflict) {
      const error = new Error(
        "duplicate key value violates unique constraint",
      ) as Error & { code?: string };
      error.code = "23505";
      throw error;
    }

    const id = this.nextId("snapshot");
    this.snapshots.push({ id, input });
    return { id };
  }

  async updateSnapshot(id: string, update: SnapshotUpdate): Promise<void> {
    this.snapshotUpdates.push({ id, update });
  }

  async insertSignals(
    snapshotId: string,
    signals: DeviationSignal[],
  ): Promise<Array<{ id: string; signal: DeviationSignal }>> {
    return signals.map((signal) => {
      const id = this.nextId("signal");
      this.signals.push({ id, snapshotId, signal });
      return { id, signal };
    });
  }

  async insertDecision(input: DecisionInput): Promise<{ id: string }> {
    const id = this.nextId("decision");
    this.decisions.push({ id, input });
    return { id };
  }

  async updateDecision(id: string, update: DecisionUpdate): Promise<void> {
    this.decisionUpdates.push({ id, update });
  }

  async insertRiskCheck(input: RiskCheckInput): Promise<{ id: string }> {
    const id = this.nextId("risk");
    this.riskChecks.push({ id, input });
    return { id };
  }

  async insertExecution(input: ExecutionInput): Promise<{ id: string }> {
    const id = this.nextId("execution");
    this.executions.push({ id, input });
    return { id };
  }

  async log(
    runId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.audit.push({ runId, eventType, payload });
  }

  async findRunIdForDay(): Promise<string | undefined> {
    return this.existingRunId;
  }
}

let market: MarketData;

function runOptions(store: FakeStore) {
  return {
    mockSodex: true,
    store,
    now: new Date("2025-06-01T12:00:00.000Z"),
    riskContext: {
      portfolioBalanceUsd: 100_000,
      spreadPct: 0.001,
      depthUsd: 200_000,
      dataConfidence: 0.9,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  market = buildMarketData();

  vi.mocked(listIndices).mockResolvedValue(["ssiMAG7"]);
  vi.mocked(getConstituents).mockResolvedValue(market.constituents);
  vi.mocked(getCurrencyKlines).mockImplementation(async (currencyId) => {
    if (currencyId === TOKEN_CURRENCY_ID) {
      return market.syntheticKlines;
    }

    const symbol = SYMBOLS.find(
      (entry) => CURRENCY_IDS[entry] === currencyId,
    );

    if (!symbol) {
      throw new Error(`Unexpected currency id: ${currencyId}`);
    }

    return market.klinesBySymbol[symbol];
  });
  vi.mocked(runBullAgent).mockResolvedValue({
    argument: "The deviation is tradeable.",
    direction: "SHORT_CONSTITUENT_LONG_INDEX",
    confidence: 0.9,
    key_points: ["z-score above threshold"],
  });
  vi.mocked(runBearAgent).mockResolvedValue({
    argument: "The hedge is available.",
    recommended: "SHORT_CONSTITUENT_LONG_INDEX",
    confidence: 0.6,
    key_points: ["overextended"],
  });
  vi.mocked(runChiefAgent).mockResolvedValue({
    decision: "SHORT",
    confidence: 0.9,
    thesis: "Short the constituent and long the index.",
    invalidators: [],
    key_evidence: ["z-score 5.57"],
  });
  vi.mocked(placeOrders).mockResolvedValue({
    success: true,
    orderId: "order-1",
    legs: [
      { symbol: "btc", orderId: "leg-1", status: "filled" },
      { symbol: "ssimag7", orderId: "leg-2", status: "filled" },
    ],
  });
});

describe("runPipeline", () => {
  it("persists every stage on the happy path", async () => {
    const store = new FakeStore();
    const result = await runPipeline(runOptions(store));

    expect(result).toEqual({
      success: true,
      runId: "snapshot-1",
      decision: "SHORT",
    });
    expect(store.snapshots).toHaveLength(1);
    expect(store.snapshots[0]?.input.replayOf).toBeNull();
    expect(store.snapshots[0]?.input.constituentKlines).toEqual(
      market.klinesBySymbol,
    );
    expect(store.snapshots[0]?.input.tokenKlines).toBe(
      market.syntheticKlines,
    );
    expect(store.snapshotUpdates[0]?.update.validationStatus).toBe("passed");
    expect(store.signals).toHaveLength(7);
    expect(store.signals[0]?.signal.symbol).toBe("btc");
    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]?.input.finalDecision).toBe("SHORT");
    expect(store.riskChecks).toHaveLength(1);
    expect(store.riskChecks[0]?.input.approved).toBe(true);
    expect(store.executions).toHaveLength(1);
    expect(store.executions[0]?.input.status).toBe("filled");
    expect(store.executions[0]?.input.legs).toEqual([
      {
        symbol: "btc",
        side: "SHORT",
        sizeUsd: 10_000,
        orderId: "leg-1",
        status: "filled",
      },
      {
        symbol: "ssimag7",
        side: "LONG",
        sizeUsd: 10_000,
        orderId: "leg-2",
        status: "filled",
      },
    ]);
    expect(vi.mocked(placeOrders)).toHaveBeenCalledWith(
      [
        { symbol: "btc", side: "SHORT", sizeUsd: 10_000 },
        { symbol: "ssimag7", side: "LONG", sizeUsd: 10_000 },
      ],
      true,
    );
    expect(store.audit.map((entry) => entry.eventType)).toEqual(
      expect.arrayContaining([
        "SNAPSHOT_CREATED",
        "VALIDATION_PASSED",
        "DEVIATION_COMPUTED",
        "AI_DECISION",
        "RISK_APPROVED",
        "ORDER_PLACED",
        "RUN_COMPLETED",
      ]),
    );
  });

  it("replays a stored snapshot without SoSoValue ingestion", async () => {
    const store = new FakeStore();
    const result = await processSnapshot(
      {
        indexTicker: "ssimag7",
        observedAt: new Date("2025-06-01T12:00:00.000Z"),
        indexKlines: market.syntheticKlines,
        constituentKlines: market.klinesBySymbol,
        tokenKlines: market.syntheticKlines,
        constituents: market.constituents,
        replayOf: "source-snapshot",
      },
      {
        mockSodex: true,
        store,
      },
    );

    expect(result).toEqual({
      success: true,
      runId: "snapshot-1",
      decision: "SHORT",
    });
    expect(store.snapshots[0]?.input.replayOf).toBe("source-snapshot");
    expect(store.snapshots[0]?.input.indexKlines).toBe(
      market.syntheticKlines,
    );
    expect(store.snapshots[0]?.input.constituentKlines).toBe(
      market.klinesBySymbol,
    );
    expect(store.snapshots[0]?.input.tokenKlines).toBe(
      market.syntheticKlines,
    );
    expect(store.signals).toHaveLength(7);
    expect(store.decisions[0]?.input.finalDecision).toBe("SHORT");
    expect(store.audit.map((entry) => entry.eventType)).toEqual(
      expect.arrayContaining(["SNAPSHOT_CREATED", "REPLAY_STARTED"]),
    );
    expect(vi.mocked(listIndices)).not.toHaveBeenCalled();
    expect(vi.mocked(getConstituents)).not.toHaveBeenCalled();
    expect(vi.mocked(getCurrencyKlines)).not.toHaveBeenCalled();
  });

  it("produces the same decision on replay as the original run", async () => {
    const liveStore = new FakeStore();
    const live = await runPipeline(runOptions(liveStore));
    const replayStore = new FakeStore();
    const replay = await processSnapshot(
      {
        indexTicker: "ssimag7",
        observedAt: new Date("2025-06-01T12:00:00.000Z"),
        indexKlines: market.syntheticKlines,
        constituentKlines: market.klinesBySymbol,
        tokenKlines: market.syntheticKlines,
        constituents: market.constituents,
        replayOf: live.runId ?? "source-snapshot",
      },
      {
        mockSodex: true,
        store: replayStore,
      },
    );

    expect(replay.decision).toBe(live.decision);
    expect(replayStore.decisions[0]?.input.finalDecision).toBe(
      liveStore.decisions[0]?.input.finalDecision,
    );
  });

  it("persists a decision row for the captured fixtures", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/sosovalue/client")
    >("@/lib/sosovalue/client");
    const constituents = actual.parseConstituents(
      loadFixture("ssimag7-constituents.json"),
    );
    const klinesBySymbol = Object.fromEntries(
      SYMBOLS.map((symbol) => [
        symbol,
        actual.parseKlines(loadFixture(`${symbol}-klines.json`)),
      ]),
    );
    const tokenKlines = actual.parseKlines(
      loadFixture("ssimag7-token-klines.json"),
    );

    vi.mocked(getConstituents).mockResolvedValue(constituents);
    vi.mocked(getCurrencyKlines).mockImplementation(async (currencyId) => {
      if (currencyId === TOKEN_CURRENCY_ID) {
        return tokenKlines;
      }

      const constituent = constituents.find(
        (entry) => entry.currency_id === currencyId,
      );

      if (!constituent) {
        throw new Error(`Unexpected currency id: ${currencyId}`);
      }

      return klinesBySymbol[constituent.symbol];
    });

    const store = new FakeStore();
    const result = await runPipeline(runOptions(store));

    expect(result).toMatchObject({
      success: true,
      decision: "NO_TRADE",
      reason: "below_z_score_threshold",
    });
    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]?.input.finalDecision).toBe("NO_TRADE");
    expect(store.signals).toHaveLength(7);
    expect(store.riskChecks).toHaveLength(0);
    expect(vi.mocked(runBullAgent)).not.toHaveBeenCalled();
  });

  it("returns a successful NO_TRADE when validation fails", async () => {
    vi.mocked(getConstituents).mockResolvedValue(
      market.constituents.slice(0, 6),
    );
    const store = new FakeStore();
    const result = await runPipeline(runOptions(store));

    expect(result).toMatchObject({
      success: true,
      decision: "NO_TRADE",
      reason: "invalid_constituent_count",
    });
    expect(store.snapshotUpdates[0]?.update.validationStatus).toBe("failed");
    expect(store.snapshotUpdates[0]?.update.validationReason).toBe(
      "invalid_constituent_count",
    );
    expect(store.signals).toHaveLength(0);
    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]?.input.finalDecision).toBe("NO_TRADE");
    expect(store.riskChecks).toHaveLength(0);
    expect(store.executions).toHaveLength(0);
    expect(vi.mocked(placeOrders)).not.toHaveBeenCalled();
  });

  it("short-circuits when the Chief returns NO_TRADE", async () => {
    vi.mocked(runChiefAgent).mockResolvedValue({
      decision: "NO_TRADE",
      confidence: 0.9,
      thesis: "The edge is not executable.",
      invalidators: [],
      key_evidence: ["bear case"],
    });
    const store = new FakeStore();
    const result = await runPipeline(runOptions(store));

    expect(result).toMatchObject({
      success: true,
      decision: "NO_TRADE",
      reason: "chief_no_trade",
    });
    expect(store.decisions[0]?.input.finalDecision).toBe("NO_TRADE");
    expect(store.riskChecks).toHaveLength(0);
    expect(store.executions).toHaveLength(0);
    expect(vi.mocked(placeOrders)).not.toHaveBeenCalled();
  });

  it("throws a catchable error when the daily run lock conflicts", async () => {
    const store = new FakeStore();
    store.conflict = true;

    await expect(runPipeline(runOptions(store))).rejects.toBeInstanceOf(
      RunAlreadyExistsError,
    );
    await expect(runPipeline(runOptions(store))).rejects.toMatchObject({
      runId: "existing-run",
    });
    expect(store.snapshots).toHaveLength(0);
  });

  it("updates the decision when risk rejects the trade", async () => {
    const store = new FakeStore();
    const result = await runPipeline({
      ...runOptions(store),
      riskContext: {
        portfolioBalanceUsd: 100_000,
        spreadPct: 0.01,
        depthUsd: 200_000,
        dataConfidence: 0.9,
      },
    });

    expect(result).toMatchObject({
      success: true,
      decision: "NO_TRADE",
      reason: "spread_too_wide",
    });
    expect(store.riskChecks[0]?.input.approved).toBe(false);
    expect(store.decisionUpdates[0]?.update).toEqual({
      finalDecision: "NO_TRADE",
      noTradeReason: "spread_too_wide",
    });
    expect(store.executions).toHaveLength(0);
    expect(vi.mocked(placeOrders)).not.toHaveBeenCalled();
  });

  it("returns an execution failure and records the failed order", async () => {
    vi.mocked(placeOrders).mockResolvedValue({
      success: false,
      error: "sodex_http_500",
      legs: [],
    });
    const store = new FakeStore();
    const result = await runPipeline(runOptions(store));

    expect(result).toMatchObject({
      success: false,
      decision: "NO_TRADE",
      error: "sodex_http_500",
    });
    expect(store.executions[0]?.input.status).toBe("failed");
    expect(store.decisionUpdates[0]?.update).toEqual({
      finalDecision: "NO_TRADE",
      noTradeReason: "execution_failed",
    });
  });
});
