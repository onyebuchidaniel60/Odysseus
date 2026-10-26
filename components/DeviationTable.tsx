"use client";

import { cn, formatNumber, formatPercent, humanizeKey } from "./format";
import type { DeviationSignalView } from "./types";

interface DeviationTableProps {
  signals: DeviationSignalView[];
  topSymbol?: string | null;
  className?: string;
}

const columns = [
  "Symbol",
  "Weight",
  "Return",
  "Deviation",
  "Z-Score",
  "Direction",
];

export function DeviationTable({
  signals,
  topSymbol,
  className,
}: DeviationTableProps) {
  const top = topSymbol ?? signals[0]?.symbol;

  if (signals.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-white/10 bg-surface/60 px-6 py-10 text-center text-sm text-muted",
          className,
        )}
      >
        No deviation signals recorded for this run.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/5 bg-surface shadow-panel",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => {
              const isTop = signal.symbol === top;
              const zScore = Number(signal.zScore);
              const deviation = Number(signal.weightDeviation);

              return (
                <tr
                  key={signal.id}
                  className={cn(
                    "border-b border-white/[0.04] transition-colors last:border-0",
                    isTop ? "bg-accent/[0.06]" : "hover:bg-white/[0.02]",
                  )}
                >
                  <td
                    className={cn(
                      "px-4 py-3.5",
                      isTop && "border-l-2 border-l-accent",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
                        {signal.symbol}
                      </span>
                      {isTop ? (
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">
                          Top
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-sm tabular-nums text-foreground">
                    {formatPercent(signal.weight)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-sm tabular-nums text-foreground">
                      {formatPercent(signal.constituentReturn, {
                        signed: true,
                      })}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted">
                      Index {formatPercent(signal.indexReturn, { signed: true })}
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3.5 font-mono text-sm tabular-nums",
                      deviation >= 0 ? "text-accent" : "text-muted",
                    )}
                  >
                    {formatPercent(signal.weightDeviation, { signed: true })}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex min-w-[64px] items-center rounded-md border px-2 py-1 font-mono text-sm tabular-nums",
                        Math.abs(zScore) >= 2
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-white/5 bg-white/[0.02] text-foreground",
                      )}
                    >
                      {formatNumber(signal.zScore, 2, true)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em]",
                        signal.direction === "overextended"
                          ? "border-accent/25 bg-accent/10 text-accent"
                          : "border-warning/20 bg-warning/[0.06] text-warning",
                      )}
                    >
                      {humanizeKey(signal.direction)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
