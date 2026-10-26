"use client";

import { StatusBadge } from "./StatusBadge";
import { cn, formatCheckValue, formatPercent, formatUsd, humanizeKey } from "./format";
import type { RiskCheckView } from "./types";

interface RiskChecklistProps {
  riskCheck: RiskCheckView | null;
  className?: string;
}

export function RiskChecklist({
  riskCheck,
  className,
}: RiskChecklistProps) {
  if (!riskCheck) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-white/10 bg-surface/60 px-6 py-10 text-center text-sm text-muted",
          className,
        )}
      >
        Risk checks were not reached for this run.
      </div>
    );
  }

  const checks = Array.isArray(riskCheck.checks) ? riskCheck.checks : [];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/5 bg-surface shadow-panel",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            Risk Checklist
          </p>
          <p className="mt-1 text-xs text-muted">
            Deterministic checks evaluated before execution
          </p>
        </div>
        <StatusBadge
          validationStatus={riskCheck.approved ? "PASS" : "FAIL"}
          size="md"
        />
      </div>

      {checks.length > 0 ? (
        <ul className="divide-y divide-white/[0.04]">
          {checks.map((check) => (
            <li
              key={check.name}
              className={cn(
                "flex items-start gap-3 px-5 py-3.5",
                !check.passed && "bg-danger/[0.04]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
                  check.passed
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-danger/30 bg-danger/10 text-danger",
                )}
                aria-hidden="true"
              >
                {check.passed ? "✓" : "✕"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-foreground">
                    {humanizeKey(check.name)}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-foreground/80">
                    {formatCheckValue(check.name, check.value)}
                  </p>
                </div>
                {check.reason ? (
                  <p className="mt-1 text-xs text-danger/90">
                    {humanizeKey(check.reason)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted">
          No risk checks recorded.
        </p>
      )}

      <div className="grid gap-4 border-t border-white/5 bg-white/[0.02] px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Approved size
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
            {formatUsd(riskCheck.approvedSize)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Stop loss
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
            {formatPercent(riskCheck.stopLoss)}
          </p>
        </div>
      </div>
    </div>
  );
}
