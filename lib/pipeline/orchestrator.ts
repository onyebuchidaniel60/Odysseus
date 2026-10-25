import { and, eq, gte, lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  auditLog,
  decision,
  deviationSignal,
  execution,
  indexSnapshot,
  riskCheck,
} from "@/lib/db/schema";
import { placeOrders, type OrderLeg } from "@/lib/sodex/client";
import {
  getConstituents,
  getCurrencyKlines,
  listIndices,
} from "@/lib/sosovalue/client";
import { synthesizeIndexKlines } from "@/lib/sosovalue/synthesize";
import type { Constituent, Kline } from "@/lib/sosovalue/types";

import {
  runBearAgent,
  runBullAgent,
  runChiefAgent,
  type BearOutput,
  type BullOutput,
  type ChiefOutput,
} from "./agents";
import { computeDeviations, type DeviationSignal } from "./deviation";
import { evaluateRisk, type RiskCheck, type RiskContext } from "./risk";
import { validateData } from "./validation";

const INDEX_TICKER = "ssimag7";
const MAG7_TOKEN_CURRENCY_ID = "1871600836616355842";
const Z_SCORE_THRESHOLD = 2.0;
const DEMO_RISK_INPUTS = {
  portfolioBalanceUsd: 100_000,
  spreadPct: 0.001,
  depthUsd: 200_000,
  dataConfidence: 0.9,
} as const;

export interface PipelineResult {
  success: boolean;
  runId?: string;
  decision: "SHORT" | "NO_TRADE";
  reason?: string;
  error?: string;
}

export interface SnapshotInput {
  indexTicker: string;
  observedAt: Date;
  indexKlines: Kline[];
  constituents: Constituent[];
  validationStatus: string;
}

export interface SnapshotUpdate {
  validationStatus: string;
  validationReason: string | null;
  trackingError: number | null;
}

export interface DecisionInput {
  snapshotId: string;
  signalId: string | null;
  bullOutput: BullOutput | null;
  bearOutput: BearOutput | null;
  chiefOutput: ChiefOutput | null;
  finalDecision: "SHORT" | "NO_TRADE";
  noTradeReason: string | null;
  confidence: number | null;
}

export interface DecisionUpdate {
  finalDecision: "SHORT" | "NO_TRADE";
  noTradeReason: string | null;
}

export interface RiskCheckInput {
  decisionId: string;
  checks: RiskCheck[];
  approved: boolean;
  approvedSize: number | null;
  stopLoss: number | null;
}

export interface ExecutionLeg extends OrderLeg {
  orderId: string | null;
  status: string;
}

export interface ExecutionInput {
  riskCheckId: string;
  venue: string;
  legs: ExecutionLeg[];
  clientOrderId: string;
  status: string;
}

export interface PipelineStore {
  createSnapshot(input: SnapshotInput): Promise<{ id: string }>;
  updateSnapshot(id: string, input: SnapshotUpdate): Promise<void>;
  insertSignals(
    snapshotId: string,
    signals: DeviationSignal[],
  ): Promise<Array<{ id: string; signal: DeviationSignal }>>;
  insertDecision(input: DecisionInput): Promise<{ id: string }>;
  updateDecision(id: string, input: DecisionUpdate): Promise<void>;
  insertRiskCheck(input: RiskCheckInput): Promise<{ id: string }>;
  insertExecution(input: ExecutionInput): Promise<{ id: string }>;
  log(
    runId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
  findRunIdForDay(
    indexTicker: string,
    observedAt: Date,
  ): Promise<string | undefined>;
}

export interface RunPipelineOptions {
  mockSodex: boolean;
  store?: PipelineStore;
  riskContext?: Partial<Omit<RiskContext, "chiefDecision">>;
  now?: Date;
}

export class RunAlreadyExistsError extends Error {
  readonly runId?: string;

  constructor(runId?: string) {
    super("Run already exists for today");
    this.name = "RunAlreadyExistsError";
    this.runId = runId;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; cause?: unknown };

  if (record.code === "23505") {
    return true;
  }

  return isUniqueViolation(record.cause);
}

function utcDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  return { start, end: new Date(start.getTime() + 86_400_000) };
}

class DrizzlePipelineStore implements PipelineStore {
  private get db() {
    return getDb();
  }

  async createSnapshot(input: SnapshotInput): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(indexSnapshot)
      .values({
        indexTicker: input.indexTicker,
        observedAt: input.observedAt,
        indexKlines: input.indexKlines,
        constituents: input.constituents,
        validationStatus: input.validationStatus,
      })
      .returning({ id: indexSnapshot.id });

    return row;
  }

  async updateSnapshot(id: string, input: SnapshotUpdate): Promise<void> {
    await this.db
      .update(indexSnapshot)
      .set({
        validationStatus: input.validationStatus,
        validationReason: input.validationReason,
        trackingError:
          input.trackingError === null ? null : String(input.trackingError),
      })
      .where(eq(indexSnapshot.id, id));
  }

  async insertSignals(
    snapshotId: string,
    signals: DeviationSignal[],
  ): Promise<Array<{ id: string; signal: DeviationSignal }>> {
    const rows = await this.db
      .insert(deviationSignal)
      .values(
        signals.map((signal) => ({
          snapshotId,
          symbol: signal.symbol,
          weight: String(signal.weight),
          constituentReturn: String(signal.constituentReturn),
          indexReturn: String(signal.indexReturn),
          weightDeviation: String(signal.weightDeviation),
          zScore: String(signal.zScore),
          direction: signal.direction,
        })),
      )
      .returning({ id: deviationSignal.id, symbol: deviationSignal.symbol });

    const idBySymbol = new Map(rows.map((row) => [row.symbol, row.id]));

    return signals.map((signal) => {
      const id = idBySymbol.get(signal.symbol);

      if (!id) {
        throw new Error(`Missing persisted signal for ${signal.symbol}`);
      }

      return { id, signal };
    });
  }

  async insertDecision(input: DecisionInput): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(decision)
      .values({
        snapshotId: input.snapshotId,
        signalId: input.signalId,
        bullOutput: input.bullOutput,
        bearOutput: input.bearOutput,
        chiefOutput: input.chiefOutput,
        finalDecision: input.finalDecision,
        noTradeReason: input.noTradeReason,
        confidence:
          input.confidence === null ? null : String(input.confidence),
      })
      .returning({ id: decision.id });

    return row;
  }

  async updateDecision(id: string, input: DecisionUpdate): Promise<void> {
    await this.db
      .update(decision)
      .set({
        finalDecision: input.finalDecision,
        noTradeReason: input.noTradeReason,
      })
      .where(eq(decision.id, id));
  }

  async insertRiskCheck(input: RiskCheckInput): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(riskCheck)
      .values({
        decisionId: input.decisionId,
        checks: input.checks,
        approved: input.approved,
        approvedSize:
          input.approvedSize === null ? null : String(input.approvedSize),
        stopLoss: input.stopLoss === null ? null : String(input.stopLoss),
      })
      .returning({ id: riskCheck.id });

    return row;
  }

  async insertExecution(input: ExecutionInput): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(execution)
      .values({
        riskCheckId: input.riskCheckId,
        venue: input.venue,
        legs: input.legs,
        clientOrderId: input.clientOrderId,
        status: input.status,
      })
      .returning({ id: execution.id });

    return row;
  }

  async log(
    runId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(auditLog).values({ runId, eventType, payload });
  }

  async findRunIdForDay(
    indexTicker: string,
    observedAt: Date,
  ): Promise<string | undefined> {
    const { start, end } = utcDayBounds(observedAt);
    const [row] = await this.db
      .select({ id: indexSnapshot.id })
      .from(indexSnapshot)
      .where(
        and(
          eq(indexSnapshot.indexTicker, indexTicker),
          gte(indexSnapshot.observedAt, start),
          lt(indexSnapshot.observedAt, end),
        ),
      )
      .limit(1);

    return row?.id;
  }
}

interface MarketData {
  constituents: Constituent[];
  constituentKlines: Record<string, Kline[]>;
  tokenKlines: Kline[];
  syntheticKlines: Kline[];
}

async function loadMarketData(): Promise<MarketData> {
  const indices = await listIndices();
  const available = indices.some(
    (index) => index.toLowerCase() === INDEX_TICKER,
  );

  if (!available) {
    throw new Error(`Index ${INDEX_TICKER} is not available`);
  }

  const constituents = await getConstituents(INDEX_TICKER);
  const [constituentKlines, tokenKlines] = await Promise.all([
    Promise.all(
      constituents.map(async (constituent) => {
        const klines = await getCurrencyKlines(constituent.currency_id);
        return [constituent.symbol, klines] as const;
      }),
    ),
    getCurrencyKlines(MAG7_TOKEN_CURRENCY_ID),
  ]);

  const klinesBySymbol = Object.fromEntries(constituentKlines);
  const syntheticKlines = synthesizeIndexKlines(
    constituents,
    klinesBySymbol,
  );

  return {
    constituents,
    constituentKlines: klinesBySymbol,
    tokenKlines,
    syntheticKlines,
  };
}

async function logFailure(
  store: PipelineStore,
  runId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  try {
    await store.log(runId, "PIPELINE_FAILED", { error: message });
  } catch {
    return;
  }
}

export async function runPipeline(
  options: RunPipelineOptions,
): Promise<PipelineResult> {
  const store = options.store ?? new DrizzlePipelineStore();
  const observedAt = options.now ?? new Date();
  let runId: string | undefined;

  try {
    const {
      constituents,
      constituentKlines,
      tokenKlines,
      syntheticKlines,
    } = await loadMarketData();

    try {
      const snapshot = await store.createSnapshot({
        indexTicker: INDEX_TICKER,
        observedAt,
        indexKlines: syntheticKlines,
        constituents,
        validationStatus: "pending",
      });
      runId = snapshot.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existingRunId = await store
          .findRunIdForDay(INDEX_TICKER, observedAt)
          .catch(() => undefined);
        throw new RunAlreadyExistsError(existingRunId);
      }

      throw error;
    }

    await store.log(runId, "SNAPSHOT_CREATED", {
      indexTicker: INDEX_TICKER,
      observedAt: observedAt.toISOString(),
    });

    const validation = validateData(
      constituents,
      constituentKlines,
      tokenKlines,
    );

    await store.updateSnapshot(runId, {
      validationStatus: validation.passed ? "passed" : "failed",
      validationReason: validation.reason ?? null,
      trackingError: validation.trackingError ?? null,
    });

    if (!validation.passed) {
      const reason = validation.reason ?? "validation_failed";
      await store.log(runId, "VALIDATION_FAILED", { reason });
      await store.insertDecision({
        snapshotId: runId,
        signalId: null,
        bullOutput: null,
        bearOutput: null,
        chiefOutput: null,
        finalDecision: "NO_TRADE",
        noTradeReason: reason,
        confidence: null,
      });
      await store.log(runId, "RUN_COMPLETED", {
        decision: "NO_TRADE",
        reason,
      });

      return { success: true, runId, decision: "NO_TRADE", reason };
    }

    await store.log(runId, "VALIDATION_PASSED", {
      trackingError: validation.trackingError,
    });

    const signals = computeDeviations(
      constituents,
      constituentKlines,
      syntheticKlines,
    );
    const persistedSignals = await store.insertSignals(runId, signals);
    const topSignal = persistedSignals[0];

    if (!topSignal) {
      throw new Error("Deviation engine returned no signals");
    }

    await store.log(runId, "DEVIATION_COMPUTED", {
      signalCount: persistedSignals.length,
      topSymbol: topSignal.signal.symbol,
      topZScore: topSignal.signal.zScore,
    });

    if (Math.abs(topSignal.signal.zScore) < Z_SCORE_THRESHOLD) {
      const reason = "below_z_score_threshold";
      await store.insertDecision({
        snapshotId: runId,
        signalId: topSignal.id,
        bullOutput: null,
        bearOutput: null,
        chiefOutput: null,
        finalDecision: "NO_TRADE",
        noTradeReason: reason,
        confidence: null,
      });
      await store.log(runId, "NO_TRADE", {
        reason,
        symbol: topSignal.signal.symbol,
        zScore: topSignal.signal.zScore,
      });
      await store.log(runId, "RUN_COMPLETED", {
        decision: "NO_TRADE",
        reason,
      });

      return { success: true, runId, decision: "NO_TRADE", reason };
    }

    if (topSignal.signal.direction === "lagging") {
      const reason = "lagging_constituent";
      await store.insertDecision({
        snapshotId: runId,
        signalId: topSignal.id,
        bullOutput: null,
        bearOutput: null,
        chiefOutput: null,
        finalDecision: "NO_TRADE",
        noTradeReason: reason,
        confidence: null,
      });
      await store.log(runId, "NO_TRADE", {
        reason,
        symbol: topSignal.signal.symbol,
        zScore: topSignal.signal.zScore,
      });
      await store.log(runId, "RUN_COMPLETED", {
        decision: "NO_TRADE",
        reason,
      });

      return { success: true, runId, decision: "NO_TRADE", reason };
    }

    const bull = await runBullAgent({ signal: topSignal.signal });
    const bear = await runBearAgent({ signal: topSignal.signal });
    const chief = await runChiefAgent(
      { signal: topSignal.signal },
      bull,
      bear,
    );

    const decisionRow = await store.insertDecision({
      snapshotId: runId,
      signalId: topSignal.id,
      bullOutput: bull,
      bearOutput: bear,
      chiefOutput: chief,
      finalDecision: chief.decision,
      noTradeReason:
        chief.decision === "NO_TRADE" ? "chief_no_trade" : null,
      confidence: chief.confidence,
    });

    await store.log(runId, "AI_DECISION", {
      decision: chief.decision,
      confidence: chief.confidence,
      symbol: topSignal.signal.symbol,
    });

    if (chief.decision === "NO_TRADE") {
      await store.log(runId, "RUN_COMPLETED", {
        decision: "NO_TRADE",
        reason: "chief_no_trade",
      });

      return {
        success: true,
        runId,
        decision: "NO_TRADE",
        reason: "chief_no_trade",
      };
    }

    const risk = evaluateRisk({
      chiefDecision: chief,
      ...DEMO_RISK_INPUTS,
      ...options.riskContext,
    });
    const riskRow = await store.insertRiskCheck({
      decisionId: decisionRow.id,
      checks: risk.checks,
      approved: risk.approved,
      approvedSize: risk.approvedSizeUsd ?? null,
      stopLoss: risk.stopLossPct ?? null,
    });

    if (!risk.approved) {
      const failedCheck = risk.checks.find((check) => !check.passed);
      const reason = failedCheck?.reason ?? "risk_rejected";
      await store.updateDecision(decisionRow.id, {
        finalDecision: "NO_TRADE",
        noTradeReason: reason,
      });
      await store.log(runId, "RISK_REJECTED", {
        reason,
        checks: risk.checks,
      });
      await store.log(runId, "RUN_COMPLETED", {
        decision: "NO_TRADE",
        reason,
      });

      return { success: true, runId, decision: "NO_TRADE", reason };
    }

    const sizeUsd = risk.approvedSizeUsd;

    if (sizeUsd === undefined) {
      throw new Error("Risk engine approved without a position size");
    }

    await store.log(runId, "RISK_APPROVED", {
      approvedSizeUsd: sizeUsd,
      stopLossPct: risk.stopLossPct,
    });

    const legs: OrderLeg[] = [
      { symbol: topSignal.signal.symbol, side: "SHORT", sizeUsd },
      { symbol: INDEX_TICKER, side: "LONG", sizeUsd },
    ];
    const result = await placeOrders(legs, options.mockSodex);
    const clientOrderId =
      result.orderId ?? result.legs[0]?.orderId ?? `run-${runId}`;
    const executionLegs: ExecutionLeg[] = legs.map((leg, index) => ({
      ...leg,
      orderId: result.legs[index]?.orderId ?? null,
      status:
        result.legs[index]?.status ?? (result.success ? "submitted" : "failed"),
    }));

    await store.insertExecution({
      riskCheckId: riskRow.id,
      venue: "sodex-testnet",
      legs: executionLegs,
      clientOrderId,
      status: result.success
        ? options.mockSodex
          ? "filled"
          : "submitted"
        : "failed",
    });

    if (!result.success) {
      const error = result.error ?? "execution_failed";
      await store.updateDecision(decisionRow.id, {
        finalDecision: "NO_TRADE",
        noTradeReason: "execution_failed",
      });
      await store.log(runId, "EXECUTION_FAILED", {
        error,
        legs: result.legs,
      });
      await store.log(runId, "RUN_COMPLETED", {
        decision: "NO_TRADE",
        reason: "execution_failed",
      });

      return { success: false, runId, decision: "NO_TRADE", error };
    }

    await store.log(runId, "ORDER_PLACED", {
      orderId: result.orderId,
      legs: result.legs,
    });
    await store.log(runId, "RUN_COMPLETED", {
      decision: "SHORT",
      symbol: topSignal.signal.symbol,
      sizeUsd,
    });

    return { success: true, runId, decision: "SHORT" };
  } catch (error) {
    if (error instanceof RunAlreadyExistsError) {
      throw error;
    }

    if (runId) {
      await logFailure(store, runId, error);
    }

    return {
      success: false,
      runId,
      decision: "NO_TRADE",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
