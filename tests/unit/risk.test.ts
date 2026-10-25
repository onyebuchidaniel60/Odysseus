import { describe, expect, it } from "vitest";

import type { ChiefOutput } from "@/lib/pipeline/agents";
import { evaluateRisk } from "@/lib/pipeline/risk";
import type { RiskContext } from "@/lib/pipeline/risk";

const chiefDecision: ChiefOutput = {
  decision: "SHORT",
  confidence: 0.8,
  thesis: "BTC is overextended.",
  invalidators: [],
  key_evidence: ["z-score 2.34"],
};

const baseContext: RiskContext = {
  chiefDecision,
  portfolioBalanceUsd: 100_000,
  spreadPct: 0.001,
  depthUsd: 200_000,
  dataConfidence: 0.9,
};

function checkByName(
  checks: ReturnType<typeof evaluateRisk>["checks"],
  name: string,
) {
  return checks.find((check) => check.name === name);
}

describe("evaluateRisk", () => {
  it("returns NO_TRADE immediately when the Chief decided no trade", () => {
    const result = evaluateRisk({
      ...baseContext,
      chiefDecision: { ...chiefDecision, decision: "NO_TRADE" },
    });

    expect(result.approved).toBe(false);
    expect(result.checks).toEqual([
      {
        name: "decision",
        passed: false,
        value: "NO_TRADE",
        reason: "Chief decided no trade",
      },
    ]);
    expect(result.approvedSizeUsd).toBeUndefined();
    expect(result.stopLossPct).toBeUndefined();
  });

  it("rejects insufficient data confidence", () => {
    const result = evaluateRisk({ ...baseContext, dataConfidence: 0.79 });

    expect(result.approved).toBe(false);
    expect(checkByName(result.checks, "data_confidence")).toMatchObject({
      passed: false,
      reason: "insufficient_data_confidence",
    });
  });

  it("rejects a spread above 0.5%", () => {
    const result = evaluateRisk({ ...baseContext, spreadPct: 0.006 });

    expect(result.approved).toBe(false);
    expect(checkByName(result.checks, "spread")).toMatchObject({
      passed: false,
      reason: "spread_too_wide",
    });
  });

  it("rejects depth below $10,000", () => {
    const result = evaluateRisk({ ...baseContext, depthUsd: 9_999 });

    expect(result.approved).toBe(false);
    expect(checkByName(result.checks, "depth")).toMatchObject({
      passed: false,
      reason: "insufficient_liquidity",
    });
  });

  it("rejects AI confidence below 0.6", () => {
    const result = evaluateRisk({
      ...baseContext,
      chiefDecision: { ...chiefDecision, confidence: 0.59 },
    });

    expect(result.approved).toBe(false);
    expect(checkByName(result.checks, "ai_confidence")).toMatchObject({
      passed: false,
      reason: "low_ai_confidence",
    });
  });

  it("approves a valid trade with a 10% position size and 5% stop loss", () => {
    const result = evaluateRisk(baseContext);

    expect(result.approved).toBe(true);
    expect(result.approvedSizeUsd).toBe(10_000);
    expect(result.stopLossPct).toBe(0.05);
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("caps position size at 10% of available depth", () => {
    const result = evaluateRisk({ ...baseContext, depthUsd: 50_000 });

    expect(result.approved).toBe(true);
    expect(result.approvedSizeUsd).toBe(5_000);
    expect(checkByName(result.checks, "position_size")).toMatchObject({
      passed: true,
      value: 5_000,
      reason: "capped_by_depth",
    });
  });
});
