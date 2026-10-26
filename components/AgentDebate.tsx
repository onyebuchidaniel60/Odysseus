"use client";

import { StatusBadge } from "./StatusBadge";
import { cn, formatConfidence, humanizeKey } from "./format";
import type {
  BearOutputView,
  BullOutputView,
  ChiefOutputView,
} from "./types";

interface AgentDebateProps {
  bull: BullOutputView | null;
  bear: BearOutputView | null;
  chief: ChiefOutputView | null;
  className?: string;
}

interface AgentCardProps {
  label: string;
  tone: "accent" | "danger";
  argument: string | null | undefined;
  confidence: string | number | null | undefined;
  keyPoints: string[] | null | undefined;
  metaLabel: string;
  metaValue: string | null | undefined;
}

function AgentCard({
  label,
  tone,
  argument,
  confidence,
  keyPoints,
  metaLabel,
  metaValue,
}: AgentCardProps) {
  const points = keyPoints ?? [];

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-surface p-5 shadow-panel",
        tone === "accent" ? "border-accent/15" : "border-danger/15",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "font-mono text-[10px] font-semibold uppercase tracking-[0.22em]",
              tone === "accent" ? "text-accent" : "text-danger",
            )}
          >
            {label}
          </p>
          <p className="mt-1 text-xs text-muted">{metaLabel}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {formatConfidence(confidence)} conf.
        </span>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
        {argument || "No argument recorded."}
      </p>

      {metaValue ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {humanizeKey(metaValue)}
        </p>
      ) : null}

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Key points
        </p>
        {points.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {points.map((point, index) => (
              <li
                key={`${label}-${index}`}
                className="flex gap-2 text-sm leading-5 text-foreground/80"
              >
                <span
                  className={cn(
                    "mt-2 h-1 w-1 shrink-0 rounded-full",
                    tone === "accent" ? "bg-accent" : "bg-danger",
                  )}
                />
                {point}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No key points recorded.</p>
        )}
      </div>
    </article>
  );
}

export function AgentDebate({
  bull,
  bear,
  chief,
  className,
}: AgentDebateProps) {
  if (!bull && !bear && !chief) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-white/10 bg-surface/60 px-6 py-10 text-center text-sm text-muted",
          className,
        )}
      >
        Agent debate was not reached for this run.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 md:grid-cols-2">
        <AgentCard
          label="Bull Agent"
          tone="accent"
          argument={bull?.argument}
          confidence={bull?.confidence}
          keyPoints={bull?.key_points}
          metaLabel="Case for the trade"
          metaValue={bull?.direction}
        />
        <AgentCard
          label="Bear Agent"
          tone="danger"
          argument={bear?.argument}
          confidence={bear?.confidence}
          keyPoints={bear?.key_points}
          metaLabel="Case against the trade"
          metaValue={bear?.recommended}
        />
      </div>

      <article className="rounded-2xl border border-accent/20 bg-surface p-5 shadow-panel md:p-6">
        <div className="flex flex-col gap-3 border-b border-white/5 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Chief Decision
            </p>
            <p className="mt-1 text-xs text-muted">
              Final constrained verdict after the debate
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {formatConfidence(chief?.confidence)} conf.
            </span>
            <StatusBadge decision={chief?.decision} size="md" />
          </div>
        </div>

        <p className="mt-5 max-w-4xl text-sm leading-6 text-foreground/90">
          {chief?.thesis || "No Chief thesis recorded."}
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Invalidators
            </p>
            {chief?.invalidators?.length ? (
              <ul className="mt-2 space-y-2">
                {chief.invalidators.map((item, index) => (
                  <li
                    key={`invalidator-${index}`}
                    className="flex gap-2 text-sm leading-5 text-foreground/80"
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warning" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">None stated.</p>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Key evidence
            </p>
            {chief?.key_evidence?.length ? (
              <ul className="mt-2 space-y-2">
                {chief.key_evidence.map((item, index) => (
                  <li
                    key={`evidence-${index}`}
                    className="flex gap-2 text-sm leading-5 text-foreground/80"
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No evidence recorded.</p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
