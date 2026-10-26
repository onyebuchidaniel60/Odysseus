"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AgentDebate } from "@/components/AgentDebate";
import { AuditTimeline } from "@/components/AuditTimeline";
import { DeviationTable } from "@/components/DeviationTable";
import { RiskChecklist } from "@/components/RiskChecklist";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import {
  cn,
  formatConfidence,
  formatDateTime,
  formatPercent,
  formatUsd,
  humanizeKey,
} from "@/components/format";
import type { RunDetailResponse } from "@/components/types";

type MetricTone = "default" | "success" | "danger" | "warning";

const metricToneClasses: Record<MetricTone, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
};

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: MetricTone;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-background/40 px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-sm font-semibold capitalize",
          metricToneClasses[tone],
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/10 font-mono text-[10px] font-semibold text-accent">
        {index}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}

export default function RunDetailPage() {
  const { id: runId } = useParams<{ id: string }>();
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    if (!runId) {
      setError("Run id is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | RunDetailResponse
        | { error?: string }
        | null;

      if (response.status === 404) {
        throw new Error("Run not found.");
      }

      if (!response.ok || !payload || !("snapshot" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Failed to load run.",
        );
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load run.",
      );
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  const snapshot = data?.snapshot;
  const signals = data?.signals ?? [];
  const decision = data?.decision ?? null;
  const riskCheck = data?.riskCheck ?? null;
  const execution = data?.execution ?? null;
  const auditLog = data?.auditLog ?? [];

  const executionTone: MetricTone =
    execution?.status === "filled" || execution?.status === "submitted"
      ? "success"
      : execution?.status === "failed"
        ? "danger"
        : "default";

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-grid-fade opacity-60" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition hover:text-foreground"
          >
            <span aria-hidden="true">←</span>
            Back to dashboard
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Run detail
          </span>
        </div>

        {loading ? (
          <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-white/5 bg-surface/60">
            <Spinner className="h-6 w-6 text-accent" />
            <p className="mt-3 text-sm text-muted">Loading run detail…</p>
          </div>
        ) : error || !snapshot ? (
          <div className="mt-6 rounded-2xl border border-danger/20 bg-danger/[0.05] px-6 py-12 text-center">
            <p className="text-sm font-medium text-danger">
              {error ?? "Run not found."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void loadRun()}
                className="inline-flex h-9 items-center rounded-lg border border-danger/30 bg-danger/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-danger transition hover:bg-danger/15"
              >
                Retry
              </button>
              <Link
                href="/"
                className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:text-foreground"
              >
                Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-2xl border border-white/5 bg-surface p-5 shadow-panel sm:p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                    Run Detail
                  </p>
                  <h1 className="mt-2 break-all font-mono text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {snapshot.id}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                    <span>{formatDateTime(snapshot.observedAt)}</span>
                    <span className="h-1 w-1 rounded-full bg-muted/40" />
                    <span className="font-mono uppercase tracking-[0.12em]">
                      {snapshot.indexTicker}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-muted/40" />
                    <span className="font-mono">
                      Tracking error {formatPercent(snapshot.trackingError)}
                    </span>
                  </div>

                  {snapshot.validationReason ? (
                    <p className="mt-3 text-xs text-warning">
                      Validation: {humanizeKey(snapshot.validationReason)}
                    </p>
                  ) : null}
                  {decision?.noTradeReason ? (
                    <p className="mt-1 text-xs text-warning">
                      Reason: {humanizeKey(decision.noTradeReason)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    validationStatus={snapshot.validationStatus}
                    size="md"
                  />
                  <StatusBadge
                    decision={decision?.finalDecision ?? "PENDING"}
                    size="lg"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Signals" value={String(signals.length)} />
                <Metric
                  label="Risk"
                  value={
                    riskCheck
                      ? riskCheck.approved
                        ? "Approved"
                        : "Rejected"
                      : "Not reached"
                  }
                  tone={
                    riskCheck
                      ? riskCheck.approved
                        ? "success"
                        : "danger"
                      : "default"
                  }
                />
                <Metric
                  label="Execution"
                  value={execution?.status ?? "Not reached"}
                  tone={executionTone}
                />
                <Metric
                  label="Chief confidence"
                  value={
                    decision ? formatConfidence(decision.confidence) : "—"
                  }
                />
              </div>

              {execution ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                    Execution legs
                  </span>
                  {execution.legs.length > 0 ? (
                    execution.legs.map((leg, index) => (
                      <span
                        key={`${leg.symbol}-${index}`}
                        className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-background/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
                      >
                        <span
                          className={cn(
                            leg.side === "SHORT" ? "text-warning" : "text-success",
                          )}
                        >
                          {leg.side}
                        </span>
                        <span className="text-foreground">{leg.symbol}</span>
                        <span>{formatUsd(leg.sizeUsd)}</span>
                        <span>{leg.status}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted">No order legs.</span>
                  )}
                </div>
              ) : null}
            </section>

            <section className="mt-8">
              <SectionHeading
                index="01"
                title="Deviation Signals"
                description="Weight-adjusted constituent returns and robust z-scores."
              />
              <DeviationTable
                signals={signals}
                topSymbol={signals[0]?.symbol}
                className="mt-4"
              />
            </section>

            <section className="mt-8">
              <SectionHeading
                index="02"
                title="Agent Debate"
                description="Bull and Bear arguments followed by the Chief's constrained verdict."
              />
              <AgentDebate
                bull={decision?.bullOutput ?? null}
                bear={decision?.bearOutput ?? null}
                chief={decision?.chiefOutput ?? null}
                className="mt-4"
              />
            </section>

            <section className="mt-8">
              <SectionHeading
                index="03"
                title="Risk Checklist"
                description="Deterministic checks that gate execution."
              />
              <RiskChecklist riskCheck={riskCheck} className="mt-4" />
            </section>

            <section className="mt-8">
              <SectionHeading
                index="04"
                title="Audit Timeline"
                description="Every persisted event for this run, in order."
              />
              <AuditTimeline events={auditLog} className="mt-4" />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
