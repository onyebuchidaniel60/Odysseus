import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const indexSnapshot = pgTable(
  "index_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indexTicker: text("index_ticker").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    indexKlines: jsonb("index_klines").notNull(),
    constituentKlines: jsonb("constituent_klines"),
    tokenKlines: jsonb("token_klines"),
    constituents: jsonb("constituents").notNull(),
    replayOf: uuid("replay_of"),
    validationStatus: text("validation_status").notNull(),
    validationReason: text("validation_reason"),
    trackingError: numeric("tracking_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_run_per_day")
      .on(
        table.indexTicker,
        sql`DATE(${table.observedAt} AT TIME ZONE 'UTC')`,
      )
      .where(sql`${table.replayOf} IS NULL`),
  ],
);

export const deviationSignal = pgTable("deviation_signal", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id").references(() => indexSnapshot.id),
  symbol: text("symbol").notNull(),
  weight: numeric("weight").notNull(),
  constituentReturn: numeric("constituent_return").notNull(),
  indexReturn: numeric("index_return").notNull(),
  weightDeviation: numeric("weight_deviation").notNull(),
  zScore: numeric("z_score").notNull(),
  direction: text("direction").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const decision = pgTable("decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id").references(() => indexSnapshot.id),
  signalId: uuid("signal_id").references(() => deviationSignal.id),
  bullOutput: jsonb("bull_output"),
  bearOutput: jsonb("bear_output"),
  chiefOutput: jsonb("chief_output"),
  finalDecision: text("final_decision").notNull(),
  noTradeReason: text("no_trade_reason"),
  confidence: numeric("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const riskCheck = pgTable("risk_check", {
  id: uuid("id").primaryKey().defaultRandom(),
  decisionId: uuid("decision_id").references(() => decision.id),
  checks: jsonb("checks").notNull(),
  approved: boolean("approved").notNull(),
  approvedSize: numeric("approved_size"),
  stopLoss: numeric("stop_loss"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const execution = pgTable("execution", {
  id: uuid("id").primaryKey().defaultRandom(),
  riskCheckId: uuid("risk_check_id").references(() => riskCheck.id),
  venue: text("venue").notNull(),
  legs: jsonb("legs").notNull(),
  clientOrderId: text("client_order_id").notNull().unique(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
