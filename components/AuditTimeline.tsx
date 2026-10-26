"use client";

import { cn, formatDateTime, humanizeKey, safeJson } from "./format";
import type { AuditEventView } from "./types";

interface AuditTimelineProps {
  events: AuditEventView[];
  className?: string;
}

const dotClasses = {
  accent: "bg-accent shadow-[0_0_12px_rgba(79,140,255,0.65)]",
  success: "bg-success shadow-[0_0_12px_rgba(46,212,122,0.55)]",
  danger: "bg-danger shadow-[0_0_12px_rgba(255,92,92,0.55)]",
  warning: "bg-warning shadow-[0_0_12px_rgba(245,166,35,0.55)]",
} as const;

function toneForEvent(eventType: string) {
  const value = eventType.toUpperCase();

  if (
    value.includes("FAILED") ||
    value.includes("REJECTED") ||
    value.includes("ERROR")
  ) {
    return "danger" as const;
  }

  if (value.includes("NO_TRADE")) {
    return "warning" as const;
  }

  if (
    value.includes("APPROVED") ||
    value.includes("PLACED") ||
    value.includes("COMPLETED") ||
    value.includes("PASSED")
  ) {
    return "success" as const;
  }

  return "accent" as const;
}

export function AuditTimeline({ events, className }: AuditTimelineProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-surface p-5 shadow-panel sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            Audit Timeline
          </p>
          <p className="mt-1 text-xs text-muted">
            Every persisted stage in chronological order
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No audit events recorded for this run.
        </p>
      ) : (
        <ol className="relative mt-5 space-y-5 pl-6 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/10">
          {events.map((event) => {
            const tone = toneForEvent(event.eventType);

            return (
              <li key={event.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface",
                    dotClasses[tone],
                  )}
                />
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <p
                    className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-foreground"
                    title={event.eventType}
                  >
                    {humanizeKey(event.eventType)}
                  </p>
                  <time className="font-mono text-[10px] tabular-nums text-muted">
                    {formatDateTime(event.createdAt)}
                  </time>
                </div>

                {event.payload !== null && event.payload !== undefined ? (
                  <details className="group mt-2">
                    <summary className="w-fit cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-foreground">
                      <span className="group-open:hidden">Show payload</span>
                      <span className="hidden group-open:inline">Hide payload</span>
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/5 bg-background/70 p-3 font-mono text-[11px] leading-5 text-muted">
                      {safeJson(event.payload)}
                    </pre>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
