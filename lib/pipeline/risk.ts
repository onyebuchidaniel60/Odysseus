import type { ChiefOutput } from "./agents";

export interface RiskContext {
  chiefDecision: ChiefOutput;
  portfolioBalanceUsd: number;
  spreadPct: number;
  depthUsd: number;
  dataConfidence: number;
  forceDemoTrade?: boolean;
}

export interface RiskCheck {
  name: string;
  passed: boolean;
  value: string | number;
  reason?: string;
}

export interface RiskResult {
  approved: boolean;
  checks: RiskCheck[];
  approvedSizeUsd?: number;
  stopLossPct?: number;
}

const MAX_POSITION_PCT = 0.1;
const DEPTH_UTILIZATION_PCT = 0.1;
const STOP_LOSS_PCT = 0.05;
const MIN_DATA_CONFIDENCE = 0.8;
const MAX_SPREAD_PCT = 0.005;
const MIN_DEPTH_USD = 10_000;
const MIN_AI_CONFIDENCE = 0.6;

export function evaluateRisk(context: RiskContext): RiskResult {
  if (context.chiefDecision.decision === "NO_TRADE") {
    return {
      approved: false,
      checks: [
        {
          name: "decision",
          passed: false,
          value: "NO_TRADE",
          reason: "Chief decided no trade",
        },
      ],
    };
  }

  const checks: RiskCheck[] = [];
  const forceDemoTrade = context.forceDemoTrade === true;

  const dataConfidencePassed =
    context.dataConfidence >= MIN_DATA_CONFIDENCE;
  checks.push({
    name: "data_confidence",
    passed: dataConfidencePassed,
    value: context.dataConfidence,
    ...(dataConfidencePassed
      ? {}
      : { reason: "insufficient_data_confidence" }),
  });

  const spreadPassed = context.spreadPct <= MAX_SPREAD_PCT;
  checks.push({
    name: "spread",
    passed: spreadPassed,
    value: context.spreadPct,
    ...(spreadPassed ? {} : { reason: "spread_too_wide" }),
  });

  const depthPassed = context.depthUsd >= MIN_DEPTH_USD;
  const depthBypassed = forceDemoTrade && !depthPassed;
  checks.push({
    name: "depth",
    passed: depthPassed || forceDemoTrade,
    value: context.depthUsd,
    ...(depthBypassed
      ? { reason: "bypassed_by_force_demo_trade" }
      : depthPassed
        ? {}
        : { reason: "insufficient_liquidity" }),
  });

  let approvedSizeUsd = context.portfolioBalanceUsd * MAX_POSITION_PCT;
  const depthCap = context.depthUsd * DEPTH_UTILIZATION_PCT;
  const cappedByDepth = approvedSizeUsd > depthCap;

  if (cappedByDepth) {
    approvedSizeUsd = depthCap;
  }

  checks.push({
    name: "position_size",
    passed: true,
    value: approvedSizeUsd,
    ...(cappedByDepth ? { reason: "capped_by_depth" } : {}),
  });

  checks.push({
    name: "stop_loss",
    passed: true,
    value: STOP_LOSS_PCT,
  });

  const aiConfidencePassed =
    context.chiefDecision.confidence >= MIN_AI_CONFIDENCE;
  const aiConfidenceBypassed = forceDemoTrade && !aiConfidencePassed;
  checks.push({
    name: "ai_confidence",
    passed: aiConfidencePassed || forceDemoTrade,
    value: context.chiefDecision.confidence,
    ...(aiConfidenceBypassed
      ? { reason: "bypassed_by_force_demo_trade" }
      : aiConfidencePassed
        ? {}
        : { reason: "low_ai_confidence" }),
  });

  const approved = checks.every((check) => check.passed);

  if (!approved) {
    return { approved: false, checks };
  }

  return {
    approved: true,
    checks,
    approvedSizeUsd,
    stopLossPct: STOP_LOSS_PCT,
  };
}
