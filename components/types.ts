export type NumericValue = string | number;

export interface RunSummaryView {
  id: string;
  observedAt: string;
  indexTicker: string;
  validationStatus: string;
  finalDecision: string | null;
}

export interface RunsResponse {
  runs: RunSummaryView[];
}

export interface SnapshotView {
  id: string;
  indexTicker: string;
  observedAt: string;
  indexKlines: unknown;
  constituents: unknown;
  validationStatus: string;
  validationReason: string | null;
  trackingError: NumericValue | null;
  createdAt: string | null;
}

export interface DeviationSignalView {
  id: string;
  snapshotId: string | null;
  symbol: string;
  weight: NumericValue;
  constituentReturn: NumericValue;
  indexReturn: NumericValue;
  weightDeviation: NumericValue;
  zScore: NumericValue;
  direction: string;
  createdAt: string | null;
}

export interface BullOutputView {
  argument: string;
  direction: string;
  confidence: NumericValue;
  key_points: string[];
}

export interface BearOutputView {
  argument: string;
  recommended: string;
  confidence: NumericValue;
  key_points: string[];
}

export interface ChiefOutputView {
  decision: string;
  confidence: NumericValue;
  thesis: string;
  invalidators: string[];
  key_evidence: string[];
}

export interface DecisionView {
  id: string;
  snapshotId: string | null;
  signalId: string | null;
  bullOutput: BullOutputView | null;
  bearOutput: BearOutputView | null;
  chiefOutput: ChiefOutputView | null;
  finalDecision: string;
  noTradeReason: string | null;
  confidence: NumericValue | null;
  createdAt: string | null;
}

export interface RiskCheckItemView {
  name: string;
  passed: boolean;
  value: string | number;
  reason?: string;
}

export interface RiskCheckView {
  id: string;
  decisionId: string | null;
  checks: RiskCheckItemView[];
  approved: boolean;
  approvedSize: NumericValue | null;
  stopLoss: NumericValue | null;
  createdAt: string | null;
}

export interface ExecutionLegView {
  symbol: string;
  side: string;
  sizeUsd: NumericValue;
  orderId: string | null;
  status: string;
  mode?: string | null;
}

export interface ExecutionView {
  id: string;
  riskCheckId: string | null;
  venue: string;
  legs: ExecutionLegView[];
  clientOrderId: string;
  status: string;
  executionMode: string | null;
  createdAt: string | null;
}

export interface AuditEventView {
  id: string;
  runId: string;
  eventType: string;
  payload: unknown;
  createdAt: string | null;
}

export interface RunDetailResponse {
  snapshot: SnapshotView;
  signals: DeviationSignalView[];
  decision: DecisionView | null;
  riskCheck: RiskCheckView | null;
  execution: ExecutionView | null;
  auditLog: AuditEventView[];
}

export interface PipelineResultView {
  success: boolean;
  runId?: string;
  decision?: string;
  reason?: string;
  error?: string;
}
