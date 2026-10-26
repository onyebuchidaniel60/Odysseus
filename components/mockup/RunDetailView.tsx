import Link from "next/link";
import type { ReactNode } from "react";

import {
  formatCheckValue,
  formatConfidence,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatUsd,
  humanizeKey,
  shortId,
} from "@/components/format";
import type {
  AuditEventView,
  DeviationSignalView,
  RunDetailResponse,
} from "@/components/types";

import { Icon } from "./Icon";
import {
  Badge,
  Panel,
  PanelHeader,
  StatCard,
  TokenAvatar,
  cx,
  toneDot,
  toneText,
} from "./primitives";
import type { MockTone } from "./types";

interface RunDetailViewProps {
  data: RunDetailResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onExport: () => void;
}

function validationTone(status: string | null | undefined): MockTone {
  if (status === "passed") {
    return "green";
  }

  if (status === "failed") {
    return "red";
  }

  return "muted";
}

function decisionTone(decision: string | null | undefined): MockTone {
  return decision === "SHORT" ? "amber" : "muted";
}

function signalTone(signal: DeviationSignalView | null): MockTone {
  if (!signal) {
    return "muted";
  }

  const zScore = Number(signal.zScore);

  if (signal.direction === "overextended" || zScore >= 2) {
    return "amber";
  }

  if (signal.direction === "lagging" || zScore <= -2) {
    return "red";
  }

  return "muted";
}

function executionTone(status: string | null | undefined): MockTone {
  if (status === "filled" || status === "submitted") {
    return "green";
  }

  if (status === "failed") {
    return "red";
  }

  return "muted";
}

function eventTone(eventType: string): MockTone {
  const value = eventType.toUpperCase();

  if (
    value.includes("FAILED") ||
    value.includes("REJECTED") ||
    value.includes("ERROR")
  ) {
    return "red";
  }

  if (value.includes("NO_TRADE")) {
    return "amber";
  }

  if (
    value.includes("APPROVED") ||
    value.includes("PLACED") ||
    value.includes("COMPLETED") ||
    value.includes("PASSED")
  ) {
    return "green";
  }

  return "muted";
}

function formatTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "—";
  }

  return Object.entries(payload as Record<string, unknown>)
    .slice(0, 2)
    .map(([key, value]) => `${humanizeKey(key)} ${String(value)}`)
    .join(" · ");
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-8 text-center font-mockup-mono text-[9px] uppercase tracking-[0.12em] text-mockup-dim">
      {children}
    </p>
  );
}

function AuditRow({ event }: { event: AuditEventView }) {
  const tone = eventTone(event.eventType);

  return (
    <li className="relative pl-5">
      <span
        className={cx(
          "absolute left-0 top-1 h-1.5 w-1.5 rounded-full",
          toneDot[tone],
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="font-mockup-mono text-[9px] uppercase tracking-[0.1em] text-mockup-text">
          {humanizeKey(event.eventType)}
        </p>
        <time className="shrink-0 font-mockup-mono text-[8px] text-mockup-dim">
          {formatTime(event.createdAt)}
        </time>
      </div>
      <p className="mt-0.5 truncate font-mockup-mono text-[8px] text-mockup-dim">
        {summarizePayload(event.payload)}
      </p>
    </li>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="group flex items-center gap-2 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.16em] text-mockup-muted transition hover:text-mockup-text"
    >
      <Icon
        name="arrowLeft"
        className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
      />
      All runs
    </Link>
  );
}

export function RunDetailView({
  data,
  loading,
  error,
  onRetry,
  onExport,
}: RunDetailViewProps) {
  if (loading) {
    return (
      <>
        <div className="flex items-center justify-between gap-4">
          <BackLink />
          <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
            Run detail / loading
          </span>
        </div>
        <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center border border-mockup-line bg-mockup-panel">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-mockup-amber border-t-transparent" />
          <p className="mt-3 font-mockup-mono text-[9px] uppercase tracking-[0.14em] text-mockup-muted">
            Loading run detail...
          </p>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="flex items-center justify-between gap-4">
          <BackLink />
          <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
            Run detail / unavailable
          </span>
        </div>
        <div className="mt-6 border border-mockup-red/20 bg-mockup-red/[0.04] px-6 py-12 text-center">
          <p className="font-mockup-mono text-[10px] uppercase tracking-[0.14em] text-mockup-red">
            {error ?? "Run not found."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 items-center border border-mockup-red/30 bg-mockup-red/10 px-3 font-mockup-mono text-[9px] uppercase tracking-[0.14em] text-mockup-red transition hover:bg-mockup-red/15"
            >
              Retry
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[9px] uppercase tracking-[0.14em] text-mockup-muted transition hover:text-mockup-text"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  const { snapshot, signals, decision, riskCheck, execution, auditLog } = data;
  const topSignal = signals[0] ?? null;
  const bull = decision?.bullOutput ?? null;
  const bear = decision?.bearOutput ?? null;
  const chief = decision?.chiefOutput ?? null;
  const finalDecision = decision?.finalDecision ?? null;
  const riskApproved = riskCheck?.approved ?? null;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <BackLink />
        <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
          Run detail / {shortId(snapshot.id)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mockup text-[26px] font-medium tracking-[-0.035em] text-mockup-text">
              Run Detail
            </h1>
            <Badge tone={decisionTone(finalDecision)}>
              {finalDecision ?? "PENDING"}
            </Badge>
            <Badge tone={validationTone(snapshot.validationStatus)}>
              {snapshot.validationStatus === "passed"
                ? "Validation passed"
                : snapshot.validationStatus === "failed"
                  ? "Validation failed"
                  : "Validation pending"}
            </Badge>
          </div>
          <p className="mt-1 break-all font-mockup-mono text-[9px] text-mockup-muted">
            {snapshot.id} · {formatDateTime(snapshot.observedAt)} ·{" "}
            {snapshot.indexTicker}
          </p>
          {snapshot.validationReason ? (
            <p className="mt-1 font-mockup-mono text-[9px] uppercase tracking-[0.08em] text-mockup-amber">
              Validation: {humanizeKey(snapshot.validationReason)}
            </p>
          ) : null}
          {decision?.noTradeReason ? (
            <p className="mt-1 font-mockup-mono text-[9px] uppercase tracking-[0.08em] text-mockup-amber">
              Reason: {humanizeKey(decision.noTradeReason)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="flex h-8 items-center gap-2 border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text"
          >
            <Icon name="download" className="h-3 w-3" />
            Export JSON
          </button>
          <a
            href={`/api/runs/${snapshot.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-2 border border-mockup-amber/30 bg-mockup-amber/10 px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-amber transition hover:bg-mockup-amber/15"
          >
            Open API
            <Icon name="external" className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Top signal"
          value={topSignal ? topSignal.symbol.toUpperCase() : "—"}
          delta={
            topSignal
              ? `Weight ${formatPercent(topSignal.weight)} · ${formatPercent(
                  topSignal.constituentReturn,
                  { signed: true },
                )}`
              : "No signals recorded"
          }
          tone={signalTone(topSignal)}
        />
        <StatCard
          label="Z-score"
          value={topSignal ? formatNumber(topSignal.zScore, 2, true) : "—"}
          delta="Threshold 2.00"
          tone={signalTone(topSignal)}
        />
        <StatCard
          label="Risk approved"
          value={formatUsd(riskCheck?.approvedSize)}
          delta={
            riskCheck
              ? `Stop loss ${formatPercent(riskCheck.stopLoss)}`
              : "Not reached"
          }
          tone={
            riskApproved === null ? "muted" : riskApproved ? "green" : "red"
          }
        />
        <StatCard
          label="Execution"
          value={execution ? execution.status.toUpperCase() : "—"}
          delta={
            execution
              ? `${execution.legs.length} / 2 legs`
              : "Not reached"
          }
          tone={executionTone(execution?.status)}
        />
      </div>

      <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
        <div className="min-w-0 space-y-2.5">
          <Panel id="signals">
            <PanelHeader
              title="Deviation signals"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Sorted by |z| ↓
                </span>
              }
            />
            {signals.length === 0 ? (
              <EmptyPanel>No deviation signals recorded for this run.</EmptyPanel>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-mockup-line">
                      {[
                        "Asset",
                        "Weight",
                        "Return",
                        "Deviation",
                        "Z-score",
                        "Direction",
                      ].map((label) => (
                        <th
                          key={label}
                          className="px-4 py-2.5 font-mockup-mono text-[8px] font-medium uppercase tracking-[0.2em] text-mockup-dim"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((signal, index) => {
                      const isTop = index === 0;
                      const tone = signalTone(signal);

                      return (
                        <tr
                          key={signal.id}
                          className={cx(
                            "border-b border-mockup-line/70 transition-colors last:border-0 hover:bg-white/[0.02]",
                            isTop && "bg-mockup-amber/[0.035]",
                          )}
                        >
                          <td
                            className={cx(
                              "px-4 py-3",
                              isTop && "border-l-2 border-mockup-amber",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <TokenAvatar symbol={signal.symbol} tone={tone} />
                              <div>
                                <p className="font-mockup text-[11px] font-medium uppercase text-mockup-text">
                                  {signal.symbol}
                                </p>
                                {isTop ? (
                                  <p className="font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-amber">
                                    Top signal
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mockup-mono text-[10px] text-mockup-muted">
                            {formatPercent(signal.weight)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mockup-mono text-[10px] text-mockup-text">
                              {formatPercent(signal.constituentReturn, {
                                signed: true,
                              })}
                            </p>
                            <p className="mt-0.5 font-mockup-mono text-[8px] text-mockup-dim">
                              Index{" "}
                              {formatPercent(signal.indexReturn, {
                                signed: true,
                              })}
                            </p>
                          </td>
                          <td
                            className={cx(
                              "px-4 py-3 font-mockup-mono text-[10px]",
                              toneText[tone],
                            )}
                          >
                            {formatPercent(signal.weightDeviation, {
                              signed: true,
                            })}
                          </td>
                          <td
                            className={cx(
                              "px-4 py-3 font-mockup-mono text-[11px]",
                              toneText[tone],
                            )}
                          >
                            {formatNumber(signal.zScore, 2, true)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={tone}>
                              {signal.direction === "overextended"
                                ? "Overextended"
                                : "Lagging"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel id="debate">
            <PanelHeader
              title="Agent debate"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  3 agents · 1 round
                </span>
              }
            />
            <div className="grid gap-2.5 p-2.5 md:grid-cols-2">
              <article className="border border-mockup-green/20 bg-mockup-green/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center border border-mockup-green/30 bg-mockup-green/10 text-mockup-green">
                      <Icon name="sparkles" className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.18em] text-mockup-green">
                        Bull agent
                      </p>
                      <p className="mt-0.5 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                        Case for the trade
                      </p>
                    </div>
                  </div>
                  <span className="font-mockup-mono text-[9px] text-mockup-green">
                    {bull ? formatConfidence(bull.confidence) : "—"} conf
                  </span>
                </div>

                <p className="mt-3 text-[12px] leading-5 text-mockup-text/90">
                  {bull?.argument ?? "No bull argument recorded."}
                </p>

                <div className="mt-4 border-t border-mockup-green/10 pt-3">
                  <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                    Key points
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {(bull?.key_points ?? []).map((point, index) => (
                      <li
                        key={`bull-${index}`}
                        className="flex gap-2 text-[11px] leading-4 text-mockup-muted"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mockup-green" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="border border-mockup-red/20 bg-mockup-red/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center border border-mockup-red/30 bg-mockup-red/10 text-mockup-red">
                      <Icon name="shield" className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.18em] text-mockup-red">
                        Bear agent
                      </p>
                      <p className="mt-0.5 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                        Case against the trade
                      </p>
                    </div>
                  </div>
                  <span className="font-mockup-mono text-[9px] text-mockup-red">
                    {bear ? formatConfidence(bear.confidence) : "—"} conf
                  </span>
                </div>

                <p className="mt-3 text-[12px] leading-5 text-mockup-text/90">
                  {bear?.argument ?? "No bear argument recorded."}
                </p>

                <div className="mt-4 border-t border-mockup-red/10 pt-3">
                  <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                    Key points
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {(bear?.key_points ?? []).map((point, index) => (
                      <li
                        key={`bear-${index}`}
                        className="flex gap-2 text-[11px] leading-4 text-mockup-muted"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mockup-red" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>

            <div className="border-t border-mockup-line p-2.5">
              <article className="border border-mockup-amber/25 bg-mockup-amber/[0.03] p-4">
                <div className="flex flex-col gap-3 border-b border-mockup-amber/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center border border-mockup-amber/30 bg-mockup-amber/10 text-mockup-amber">
                      <Icon name="activity" className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.18em] text-mockup-amber">
                        Chief verdict
                      </p>
                      <p className="mt-0.5 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                        Final constrained decision
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mockup-mono text-[9px] text-mockup-amber">
                      {chief ? formatConfidence(chief.confidence) : "—"} conf
                    </span>
                    <Badge tone={decisionTone(chief?.decision ?? finalDecision)}>
                      {chief?.decision ?? finalDecision ?? "—"}
                    </Badge>
                  </div>
                </div>

                <p className="mt-4 max-w-4xl text-[12px] leading-5 text-mockup-text/90">
                  {chief?.thesis ?? "No Chief verdict recorded."}
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                      Invalidators
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {(chief?.invalidators ?? []).map((item, index) => (
                        <li
                          key={`invalidator-${index}`}
                          className="flex gap-2 text-[11px] leading-4 text-mockup-muted"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mockup-amber" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                      Key evidence
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {(chief?.key_evidence ?? []).map((item, index) => (
                        <li
                          key={`evidence-${index}`}
                          className="flex gap-2 text-[11px] leading-4 text-mockup-muted"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mockup-green" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-2.5">
          <Panel id="risk">
            <PanelHeader
              title="Risk checklist"
              action={
                <Badge
                  tone={
                    riskApproved === null
                      ? "muted"
                      : riskApproved
                        ? "green"
                        : "red"
                  }
                >
                  {riskApproved === null
                    ? "Not reached"
                    : riskApproved
                      ? "Approved"
                      : "Rejected"}
                </Badge>
              }
            />
            {!riskCheck ? (
              <EmptyPanel>Risk checks were not reached for this run.</EmptyPanel>
            ) : (
              <>
                {riskCheck.checks.length === 0 ? (
                  <EmptyPanel>No risk checks recorded.</EmptyPanel>
                ) : (
                  <div className="divide-y divide-mockup-line/70">
                    {riskCheck.checks.map((check) => (
                      <div
                        key={check.name}
                        className="flex items-start gap-2.5 px-4 py-2.5"
                      >
                        <span
                          className={cx(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
                            check.passed
                              ? "border-mockup-green/30 bg-mockup-green/10 text-mockup-green"
                              : "border-mockup-red/30 bg-mockup-red/10 text-mockup-red",
                          )}
                        >
                          <Icon
                            name={check.passed ? "check" : "x"}
                            className="h-2.5 w-2.5"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mockup-mono text-[9px] uppercase tracking-[0.12em] text-mockup-text">
                            {humanizeKey(check.name)}
                          </p>
                          {check.reason ? (
                            <p className="mt-0.5 font-mockup-mono text-[8px] text-mockup-red">
                              {humanizeKey(check.reason)}
                            </p>
                          ) : null}
                        </div>
                        <p className="font-mockup-mono text-[9px] text-mockup-muted">
                          {formatCheckValue(check.name, check.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 border-t border-mockup-line bg-white/[0.015] px-4 py-3">
                  <div>
                    <p className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                      Approved size
                    </p>
                    <p className="mt-1 font-mockup-mono text-[11px] text-mockup-text">
                      {formatUsd(riskCheck.approvedSize)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                      Stop loss
                    </p>
                    <p className="mt-1 font-mockup-mono text-[11px] text-mockup-text">
                      {formatPercent(riskCheck.stopLoss)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </Panel>

          <Panel id="execution">
            <PanelHeader
              title="Execution"
              action={
                <Badge tone={executionTone(execution?.status)}>
                  {execution ? execution.status.toUpperCase() : "Not reached"}
                </Badge>
              }
            />
            {!execution ? (
              <EmptyPanel>Execution was not reached for this run.</EmptyPanel>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-mockup-line px-4 py-2.5">
                  <span className="font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                    Venue
                  </span>
                  <span className="font-mockup-mono text-[9px] text-mockup-text">
                    {execution.venue}
                  </span>
                </div>
                <div className="divide-y divide-mockup-line/70">
                  {execution.legs.map((leg, index) => (
                    <div
                      key={`${leg.symbol}-${index}`}
                      className="px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={leg.side === "SHORT" ? "amber" : "green"}
                          >
                            {leg.side}
                          </Badge>
                          <span className="font-mockup text-[11px] font-medium uppercase text-mockup-text">
                            {leg.symbol}
                          </span>
                        </div>
                        <span className="font-mockup-mono text-[10px] text-mockup-text">
                          {formatUsd(leg.sizeUsd)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3 font-mockup-mono text-[8px] text-mockup-dim">
                        <span className="truncate">
                          {leg.orderId ?? "No order id"}
                        </span>
                        <span
                          className={cx(
                            "uppercase",
                            toneText[executionTone(leg.status)],
                          )}
                        >
                          {leg.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                  <span>Client order</span>
                  <span className="text-mockup-muted">
                    {execution.clientOrderId}
                  </span>
                </div>
              </>
            )}
          </Panel>

          <Panel id="audit">
            <PanelHeader
              title="Audit timeline"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  {auditLog.length} events
                </span>
              }
            />
            {auditLog.length === 0 ? (
              <EmptyPanel>No audit events recorded for this run.</EmptyPanel>
            ) : (
              <ol className="relative space-y-3 px-4 py-4 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-mockup-line-strong before:content-['']">
                {auditLog.map((event) => (
                  <AuditRow key={event.id} event={event} />
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <footer className="mt-3 flex flex-col gap-1.5 border-t border-mockup-line pt-3 font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim sm:flex-row sm:items-center sm:justify-between">
        <span>Live API · /api/runs/{shortId(snapshot.id)}</span>
        <span>Audit snapshot · {formatDateTime(snapshot.observedAt)}</span>
      </footer>
    </>
  );
}
