import type { RunDetailResponse, RunSummaryView } from "@/components/types";

export type MockTone = "amber" | "green" | "red" | "lime" | "muted";

export const mockRunId = "7c2f9d1a-4e8b-4f3a-9d2c-6a1b5e8f0a11";

export const mockRuns: RunSummaryView[] = [
  {
    id: mockRunId,
    observedAt: "2026-10-26T00:05:00.000Z",
    indexTicker: "ssimag7",
    validationStatus: "passed",
    finalDecision: "SHORT",
  },
  {
    id: "2b8e4c6d-9a1f-4d7e-8c3b-5f0a2d6e9b22",
    observedAt: "2026-10-25T00:05:00.000Z",
    indexTicker: "ssimag7",
    validationStatus: "passed",
    finalDecision: "NO_TRADE",
  },
  {
    id: "9d1a7c2f-4e8b-4f3a-9d2c-6a1b5e8f0a33",
    observedAt: "2026-10-24T00:05:00.000Z",
    indexTicker: "ssimag7",
    validationStatus: "failed",
    finalDecision: null,
  },
  {
    id: "5f0a2d6e-9b22-4c6d-9a1f-8c3b2b8e4c44",
    observedAt: "2026-10-23T00:05:00.000Z",
    indexTicker: "ssimag7",
    validationStatus: "passed",
    finalDecision: "NO_TRADE",
  },
];

export const mockRunMeta: Record<
  string,
  { topSignal: string; zScore: string; returnValue: string }
> = {
  [mockRunId]: {
    topSignal: "BTC",
    zScore: "+2.45",
    returnValue: "+4.12%",
  },
  "2b8e4c6d-9a1f-4d7e-8c3b-5f0a2d6e9b22": {
    topSignal: "ETH",
    zScore: "+1.82",
    returnValue: "+2.21%",
  },
  "9d1a7c2f-4e8b-4f3a-9d2c-6a1b5e8f0a33": {
    topSignal: "—",
    zScore: "—",
    returnValue: "—",
  },
  "5f0a2d6e-9b22-4c6d-9a1f-8c3b2b8e4c44": {
    topSignal: "SOL",
    zScore: "-2.11",
    returnValue: "-3.06%",
  },
};

export interface MockConstituent {
  symbol: string;
  name: string;
  price: string;
  change: string;
  weight: string;
  tone: MockTone;
}

export const mockConstituents: MockConstituent[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: "$98,412.55",
    change: "+2.41%",
    weight: "73.63%",
    tone: "amber",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: "$3,784.12",
    change: "+3.18%",
    weight: "13.77%",
    tone: "green",
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: "$218.44",
    change: "+6.72%",
    weight: "2.63%",
    tone: "amber",
  },
  {
    symbol: "BNB",
    name: "BNB",
    price: "$612.08",
    change: "+1.12%",
    weight: "4.32%",
    tone: "lime",
  },
  {
    symbol: "XRP",
    name: "XRP",
    price: "$2.41",
    change: "-0.84%",
    weight: "4.20%",
    tone: "red",
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    price: "$0.3842",
    change: "+0.42%",
    weight: "0.62%",
    tone: "green",
  },
  {
    symbol: "HYPE",
    name: "Hyperliquid",
    price: "$41.87",
    change: "-1.26%",
    weight: "0.83%",
    tone: "red",
  },
];

export interface MockStat {
  label: string;
  value: string;
  delta: string;
  tone: MockTone;
}

export const mockStats: MockStat[] = [
  {
    label: "Runs Today",
    value: "1",
    delta: "1 / 1 UTC day",
    tone: "amber",
  },
  {
    label: "Top Deviation",
    value: "2.45z",
    delta: "BTC overextended",
    tone: "amber",
  },
  {
    label: "Risk Approval",
    value: "96.4%",
    delta: "+2.1% vs 30d",
    tone: "green",
  },
  {
    label: "Execution Fill",
    value: "100%",
    delta: "2 / 2 legs filled",
    tone: "green",
  },
];

export interface MockFlowRow {
  label: string;
  value: string;
  pct: number;
  tone: MockTone;
}

export const mockFlow: MockFlowRow[] = [
  {
    label: "SHORT BTC-PERP",
    value: "$5,000",
    pct: 88,
    tone: "amber",
  },
  {
    label: "LONG MAG7.SSI",
    value: "$5,000",
    pct: 88,
    tone: "green",
  },
  {
    label: "RISK BUFFER",
    value: "$1,240",
    pct: 24,
    tone: "lime",
  },
];

export interface MockConsensusRow {
  label: string;
  value: number;
  tone: MockTone;
  note: string;
}

export const mockConsensus: MockConsensusRow[] = [
  {
    label: "Bull agent",
    value: 82,
    tone: "green",
    note: "SHORT thesis",
  },
  {
    label: "Bear agent",
    value: 64,
    tone: "red",
    note: "NO_TRADE risk",
  },
  {
    label: "Chief verdict",
    value: 78,
    tone: "amber",
    note: "SHORT",
  },
];

export interface MockHeatmapTile {
  symbol: string;
  weight: string;
  zScore: string;
  tone: MockTone;
}

export const mockHeatmap: MockHeatmapTile[] = [
  { symbol: "BTC", weight: "73.63%", zScore: "+2.45", tone: "amber" },
  { symbol: "ETH", weight: "13.77%", zScore: "+0.42", tone: "green" },
  { symbol: "SOL", weight: "2.63%", zScore: "+1.18", tone: "amber" },
  { symbol: "BNB", weight: "4.32%", zScore: "-0.31", tone: "red" },
  { symbol: "XRP", weight: "4.20%", zScore: "-0.52", tone: "red" },
  { symbol: "DOGE", weight: "0.62%", zScore: "+0.22", tone: "green" },
  { symbol: "HYPE", weight: "0.83%", zScore: "-0.74", tone: "red" },
  { symbol: "CASH", weight: "—", zScore: "—", tone: "muted" },
];

export const mockTickers = [
  { symbol: "BTC", price: "98,412.55", change: "+2.41%", tone: "green" },
  { symbol: "ETH", price: "3,784.12", change: "+3.18%", tone: "green" },
  { symbol: "SOL", price: "218.44", change: "+6.72%", tone: "green" },
] as const;

export const mockDetail: RunDetailResponse = {
  snapshot: {
    id: mockRunId,
    indexTicker: "ssimag7",
    observedAt: "2026-10-26T00:05:00.000Z",
    indexKlines: [
      { timestamp: "2026-10-24T00:00:00.000Z", close: 1272.18 },
      { timestamp: "2026-10-25T00:00:00.000Z", close: 1278.64 },
      { timestamp: "2026-10-26T00:00:00.000Z", close: 1284.32 },
    ],
    constituents: [
      { symbol: "btc", weight: 0.7363 },
      { symbol: "eth", weight: 0.1377 },
      { symbol: "bnb", weight: 0.0432 },
      { symbol: "xrp", weight: 0.042 },
      { symbol: "sol", weight: 0.0263 },
      { symbol: "doge", weight: 0.0062 },
      { symbol: "hype", weight: 0.0083 },
    ],
    validationStatus: "passed",
    validationReason: null,
    trackingError: "0.001842",
    createdAt: "2026-10-26T00:05:03.000Z",
  },
  signals: [
    {
      id: "sig-btc",
      snapshotId: mockRunId,
      symbol: "btc",
      weight: "0.7363",
      constituentReturn: "0.0412",
      indexReturn: "0.0184",
      weightDeviation: "0.0168",
      zScore: "2.45",
      direction: "overextended",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "sig-sol",
      snapshotId: mockRunId,
      symbol: "sol",
      weight: "0.0263",
      constituentReturn: "0.0312",
      indexReturn: "0.0184",
      weightDeviation: "0.00034",
      zScore: "1.18",
      direction: "overextended",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "sig-eth",
      snapshotId: mockRunId,
      symbol: "eth",
      weight: "0.1377",
      constituentReturn: "0.0221",
      indexReturn: "0.0184",
      weightDeviation: "0.00051",
      zScore: "0.42",
      direction: "overextended",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "sig-doge",
      snapshotId: mockRunId,
      symbol: "doge",
      weight: "0.0062",
      constituentReturn: "0.035",
      indexReturn: "0.0184",
      weightDeviation: "0.0001",
      zScore: "0.22",
      direction: "overextended",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "sig-bnb",
      snapshotId: mockRunId,
      symbol: "bnb",
      weight: "0.0432",
      constituentReturn: "0.0125",
      indexReturn: "0.0184",
      weightDeviation: "-0.00025",
      zScore: "-0.31",
      direction: "lagging",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "sig-xrp",
      snapshotId: mockRunId,
      symbol: "xrp",
      weight: "0.042",
      constituentReturn: "0.0098",
      indexReturn: "0.0184",
      weightDeviation: "-0.00036",
      zScore: "-0.52",
      direction: "lagging",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "sig-hype",
      snapshotId: mockRunId,
      symbol: "hype",
      weight: "0.0083",
      constituentReturn: "-0.004",
      indexReturn: "0.0184",
      weightDeviation: "-0.00019",
      zScore: "-0.74",
      direction: "lagging",
      createdAt: "2026-10-26T00:05:04.000Z",
    },
  ],
  decision: {
    id: "dec-20261026-0005",
    snapshotId: mockRunId,
    signalId: "sig-btc",
    bullOutput: {
      argument:
        "BTC is trading 4.12% above the synthesized MAG7.ssi index while carrying 73.63% of basket weight. The deviation is broad, liquidity is deep, and the perp funding rate is not yet stretched. A market-neutral short in BTC perp against long index spot captures the convergence without taking directional index risk.",
      direction: "SHORT_CONSTITUENT_LONG_INDEX",
      confidence: "0.82",
      key_points: [
        "BTC contributes 73.63% of index weight and 1.68% of absolute deviation.",
        "Perp depth is $240k with a 12 bps spread, enough for the $5k clip.",
        "Funding remains neutral, so carry does not erode the convergence trade.",
      ],
    },
    bearOutput: {
      argument:
        "The z-score is elevated, but BTC momentum can persist into the daily close. A single 2.45σ print is not enough to rule out a regime shift, and the index spot leg may lag while the perp short moves against us. The risk engine should require a tighter stop and a clear invalidator before sizing up.",
      recommended: "NO_TRADE",
      confidence: "0.64",
      key_points: [
        "Momentum regimes can keep the top constituent overextended for multiple days.",
        "Index spot liquidity is thinner than BTC perp liquidity.",
        "The 5% stop is wide relative to a 1.68% deviation.",
      ],
    },
    chiefOutput: {
      decision: "SHORT",
      confidence: "0.78",
      thesis:
        "The deviation is large, deterministic, and directionally clean: BTC is overextended versus the basket, and the only permitted expression is short BTC perp plus long MAG7.ssi spot. Risk checks clear at the approved $5,000 clip. Take the trade with a hard 5% stop and stand down if the deviation compresses below 1.0σ before entry.",
      invalidators: [
        "BTC perp funding turns sharply negative before entry.",
        "MAG7.ssi spot depth falls below the $10k risk floor.",
        "The next daily close shows the z-score below 1.0σ.",
      ],
      key_evidence: [
        "Top signal: BTC at +2.45σ, weight deviation +1.68%.",
        "Validation passed with 18 bps tracking error.",
        "Risk engine approved $5,000 with a 5% stop.",
      ],
    },
    finalDecision: "SHORT",
    noTradeReason: null,
    confidence: "0.78",
    createdAt: "2026-10-26T00:05:18.000Z",
  },
  riskCheck: {
    id: "risk-20261026-0005",
    decisionId: "dec-20261026-0005",
    checks: [
      { name: "decision", passed: true, value: "SHORT" },
      { name: "data_confidence", passed: true, value: "0.92" },
      { name: "spread", passed: true, value: "0.0012" },
      { name: "depth", passed: true, value: "240000" },
      { name: "ai_confidence", passed: true, value: "0.78" },
      { name: "position_size", passed: true, value: "5000" },
      { name: "stop_loss", passed: true, value: "0.05" },
    ],
    approved: true,
    approvedSize: "5000",
    stopLoss: "0.05",
    createdAt: "2026-10-26T00:05:19.000Z",
  },
  execution: {
    id: "exec-20261026-0005",
    riskCheckId: "risk-20261026-0005",
    venue: "SoDEX Testnet",
    legs: [
      {
        symbol: "btc",
        side: "SHORT",
        sizeUsd: "5000",
        orderId: "ord_01J9K2M4P6Q8R0S2T4V6W8X0Y2",
        status: "filled",
      },
      {
        symbol: "ssimag7",
        side: "LONG",
        sizeUsd: "5000",
        orderId: "ord_01J9K2M4P6Q8R0S2T4V6W8X0Y3",
        status: "filled",
      },
    ],
    clientOrderId: "odysseus-20261026-0005",
    status: "filled",
    createdAt: "2026-10-26T00:05:24.000Z",
  },
  auditLog: [
    {
      id: "audit-1",
      runId: mockRunId,
      eventType: "SNAPSHOT_CREATED",
      payload: { indexTicker: "ssimag7", constituents: 7 },
      createdAt: "2026-10-26T00:05:03.000Z",
    },
    {
      id: "audit-2",
      runId: mockRunId,
      eventType: "VALIDATION_PASSED",
      payload: { trackingError: "0.001842" },
      createdAt: "2026-10-26T00:05:04.000Z",
    },
    {
      id: "audit-3",
      runId: mockRunId,
      eventType: "DEVIATION_COMPUTED",
      payload: { signals: 7, topSymbol: "btc", topZScore: "2.45" },
      createdAt: "2026-10-26T00:05:05.000Z",
    },
    {
      id: "audit-4",
      runId: mockRunId,
      eventType: "AI_DECISION",
      payload: { finalDecision: "SHORT", confidence: "0.78" },
      createdAt: "2026-10-26T00:05:18.000Z",
    },
    {
      id: "audit-5",
      runId: mockRunId,
      eventType: "RISK_APPROVED",
      payload: { approvedSizeUsd: "5000", stopLossPct: "0.05" },
      createdAt: "2026-10-26T00:05:19.000Z",
    },
    {
      id: "audit-6",
      runId: mockRunId,
      eventType: "ORDER_PLACED",
      payload: { legs: 2, venue: "SoDEX Testnet" },
      createdAt: "2026-10-26T00:05:24.000Z",
    },
    {
      id: "audit-7",
      runId: mockRunId,
      eventType: "RUN_COMPLETED",
      payload: { success: true },
      createdAt: "2026-10-26T00:05:25.000Z",
    },
  ],
};
