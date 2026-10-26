import type { KeyboardEvent, ReactNode } from "react";

import {
  formatNumber,
  formatPercent,
  formatUsd,
  humanizeKey,
  shortId,
} from "@/components/format";
import type {
  DeviationSignalView,
  NumericValue,
  RunDetailResponse,
  RunSummaryView,
} from "@/components/types";

import { Icon } from "./Icon";
import {
  Badge,
  HeatTile,
  Panel,
  PanelHeader,
  SegmentedBar,
  StatCard,
  TokenAvatar,
  cx,
  toneText,
} from "./primitives";
import type { MockTone } from "./types";

interface DashboardViewProps {
  runs: RunSummaryView[];
  latestDetail: RunDetailResponse | null;
  loading: boolean;
  latestLoading: boolean;
  error: string | null;
  latestError: string | null;
  secret: string;
  onSecretChange: (value: string) => void;
  onRun: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onOpenRun: (id: string) => void;
  running: boolean;
}

interface StatRow {
  label: string;
  value: string;
  delta: string;
  tone: MockTone;
}

interface ConstituentRow {
  symbol: string;
  weight: NumericValue;
}

interface HeatRow {
  symbol: string;
  weight: string;
  zScore: string;
  tone: MockTone;
}

function validationTone(status: string): MockTone {
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

function signalTone(signal: DeviationSignalView | null | undefined): MockTone {
  if (!signal) {
    return "muted";
  }

  const zScore = Number(signal.zScore);

  if (!Number.isFinite(zScore)) {
    return "muted";
  }

  if (zScore >= 2) {
    return "amber";
  }

  if (zScore <= -2) {
    return "red";
  }

  return zScore >= 0 ? "green" : "red";
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

function formatRunDate(value: string) {
  const date = new Date(value);

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function parseConstituents(value: unknown): ConstituentRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as { symbol?: unknown; weight?: unknown };

    if (typeof record.symbol !== "string") {
      return [];
    }

    if (typeof record.weight !== "string" && typeof record.weight !== "number") {
      return [];
    }

    return [{ symbol: record.symbol, weight: record.weight }];
  });
}

function confidencePercent(value: NumericValue | null | undefined) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, parsed * 100));
}

function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden="true"
    />
  );
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-mockup-line/70">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-4 px-4 py-3.5"
        >
          <div className="h-7 w-7 bg-white/[0.04]" />
          <div className="h-2.5 w-20 bg-white/[0.04]" />
          <div className="ml-auto h-2.5 w-24 bg-white/[0.04]" />
          <div className="h-5 w-16 bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-9 w-9 items-center justify-center border border-mockup-amber/20 bg-mockup-amber/10 font-mockup-mono text-[11px] text-mockup-amber">
        $
      </div>
      <p className="mt-3 font-mockup text-[13px] font-medium text-mockup-text">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-5 text-mockup-muted">
        {body}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-mockup-mono text-[10px] uppercase tracking-[0.14em] text-mockup-red">
        Could not load recent runs
      </p>
      <p className="mt-2 text-[11px] text-mockup-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-8 items-center border border-mockup-red/30 bg-mockup-red/10 px-3 font-mockup-mono text-[9px] uppercase tracking-[0.14em] text-mockup-red transition hover:bg-mockup-red/15"
      >
        Retry
      </button>
    </div>
  );
}

function DetailEmpty({ message }: { message: string }) {
  return (
    <p className="px-4 py-8 text-center font-mockup-mono text-[9px] uppercase tracking-[0.12em] text-mockup-dim">
      {message}
    </p>
  );
}

function handleRowKeyDown(
  event: KeyboardEvent<HTMLTableRowElement>,
  openRun: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openRun();
  }
}

export function DashboardView({
  runs,
  latestDetail,
  loading,
  latestLoading,
  error,
  latestError,
  secret,
  onSecretChange,
  onRun,
  onRefresh,
  onExport,
  onOpenRun,
  running,
}: DashboardViewProps) {
  const topSignal = latestDetail?.signals[0] ?? null;
  const riskCheck = latestDetail?.riskCheck ?? null;
  const execution = latestDetail?.execution ?? null;
  const decision = latestDetail?.decision ?? null;
  const constituents = parseConstituents(latestDetail?.snapshot.constituents);
  const signals = latestDetail?.signals ?? [];
  const latestDate = latestDetail
    ? formatRunDate(latestDetail.snapshot.observedAt)
    : "Live API";

  const stats: StatRow[] = [
    {
      label: "Tracked Runs",
      value: String(runs.length),
      delta: "Last 20 · newest first",
      tone: "amber",
    },
    {
      label: "Top Deviation",
      value: topSignal
        ? `${formatNumber(topSignal.zScore, 2, true)}z`
        : "—",
      delta: topSignal
        ? `${topSignal.symbol.toUpperCase()} ${humanizeKey(topSignal.direction)}`
        : latestLoading
          ? "Loading..."
          : "No signals",
      tone: signalTone(topSignal),
    },
    {
      label: "Risk Approval",
      value: riskCheck
        ? riskCheck.approved
          ? "Approved"
          : "Rejected"
        : "—",
      delta: riskCheck
        ? `${formatUsd(riskCheck.approvedSize)} clip`
        : latestLoading
          ? "Loading..."
          : "Not reached",
      tone: riskCheck ? (riskCheck.approved ? "green" : "red") : "muted",
    },
    {
      label: "Execution Fill",
      value: execution ? execution.status.toUpperCase() : "—",
      delta: execution
        ? `${execution.legs.length} / 2 legs`
        : latestLoading
          ? "Loading..."
          : "Not reached",
      tone: executionTone(execution?.status),
    },
  ];

  const heatmap: HeatRow[] = constituents.map((constituent) => {
    const signal = signals.find(
      (candidate) => candidate.symbol === constituent.symbol,
    );

    return {
      symbol: constituent.symbol.toUpperCase(),
      weight: formatPercent(constituent.weight),
      zScore: signal ? formatNumber(signal.zScore, 2, true) : "—",
      tone: signalTone(signal),
    };
  });

  if (heatmap.length > 0) {
    heatmap.push({ symbol: "CASH", weight: "—", zScore: "—", tone: "muted" });
  }

  const topConstituents = [...constituents]
    .sort((left, right) => Number(right.weight) - Number(left.weight))
    .slice(0, 7)
    .map((constituent) => {
      const signal = signals.find(
        (candidate) => candidate.symbol === constituent.symbol,
      );

      return {
        ...constituent,
        zScore: signal ? formatNumber(signal.zScore, 2, true) : "—",
        tone: signalTone(signal),
      };
    });

  const totalWeight = constituents.reduce(
    (sum, constituent) => sum + Number(constituent.weight),
    0,
  );

  const maxLegSize = Math.max(
    0,
    ...(execution?.legs.map((leg) => Number(leg.sizeUsd)) ?? []),
  );
  const executionRows =
    execution?.legs.map((leg) => ({
      label: `${leg.side} ${leg.symbol.toUpperCase()}${
        leg.side === "SHORT" ? "-PERP" : ""
      }`,
      value: formatUsd(leg.sizeUsd),
      pct:
        maxLegSize > 0
          ? Math.max(0, Math.min(100, (Number(leg.sizeUsd) / maxLegSize) * 100))
          : 0,
      tone: (leg.side === "SHORT" ? "amber" : "green") as MockTone,
    })) ?? [];
  const netExposure = execution
    ? execution.legs.reduce(
        (sum, leg) =>
          sum +
          (leg.side === "LONG" ? Number(leg.sizeUsd) : -Number(leg.sizeUsd)),
        0,
      )
    : null;

  const consensusRows = decision
    ? [
        {
          label: "Bull agent",
          value: confidencePercent(decision.bullOutput?.confidence),
          tone: "green" as MockTone,
          note: decision.bullOutput
            ? humanizeKey(decision.bullOutput.direction)
            : "Not recorded",
        },
        {
          label: "Bear agent",
          value: confidencePercent(decision.bearOutput?.confidence),
          tone: "red" as MockTone,
          note: decision.bearOutput
            ? humanizeKey(decision.bearOutput.recommended)
            : "Not recorded",
        },
        {
          label: "Chief verdict",
          value: confidencePercent(decision.confidence),
          tone: "amber" as MockTone,
          note: decision.finalDecision,
        },
      ]
    : [];

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.24em] text-mockup-amber">
            Pipeline console / {latestDate}
          </p>
          <h1 className="mt-2 font-mockup text-[26px] font-medium tracking-[-0.035em] text-mockup-text">
            Deviation Intelligence
          </h1>
          <p className="mt-1 max-w-xl text-[12px] leading-5 text-mockup-muted">
            Daily MAG7.ssi runs, agent debate, risk gates, and execution audit.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
              Operator secret
            </span>
            <input
              type="password"
              value={secret}
              onChange={(event) => onSecretChange(event.target.value)}
              placeholder="x-operator-key"
              autoComplete="off"
              spellCheck={false}
              className="h-8 w-full border border-mockup-line bg-mockup-panel px-2.5 font-mockup-mono text-[10px] text-mockup-text outline-none transition placeholder:text-mockup-dim/60 focus:border-mockup-amber/40 focus:ring-1 focus:ring-mockup-amber/20 sm:w-52"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex h-8 items-center gap-2 border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <InlineSpinner />
              ) : (
                <Icon name="activity" className="h-3 w-3" />
              )}
              Refresh
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={runs.length === 0}
              className="flex h-8 items-center gap-2 border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-3 w-3" />
              Export
            </button>
            <button
              type="button"
              onClick={onRun}
              disabled={running}
              className="flex h-8 items-center gap-2 bg-mockup-amber px-3 font-mockup text-[11px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <InlineSpinner className="text-black" />
              ) : (
                <Icon name="play" className="h-3 w-3" />
              )}
              {running ? "Running..." : "Run Pipeline"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[minmax(0,1.62fr)_minmax(320px,0.88fr)]">
        <div className="min-w-0 space-y-2.5">
          <Panel>
            <PanelHeader
              title="Recent runs"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  {loading ? "Syncing..." : `${runs.length} runs · newest first`}
                </span>
              }
            />
            {loading && runs.length === 0 ? (
              <SkeletonRows />
            ) : error ? (
              <ErrorState message={error} onRetry={onRefresh} />
            ) : runs.length === 0 ? (
              <EmptyState
                title="No runs yet."
                body="Enter the operator secret and run the pipeline to create the first MAG7.ssi audit trail."
                action={
                  <button
                    type="button"
                    onClick={onRun}
                    disabled={running}
                    className="inline-flex h-8 items-center gap-2 bg-mockup-amber px-3 font-mockup text-[11px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="play" className="h-3 w-3" />
                    Run Pipeline
                  </button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-mockup-line">
                        {[
                          "Run",
                          "Timestamp",
                          "Validation",
                          "Decision",
                          "",
                        ].map((label) => (
                          <th
                            key={label || "arrow"}
                            className="px-4 py-2.5 font-mockup-mono text-[8px] font-medium uppercase tracking-[0.2em] text-mockup-dim"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run, index) => {
                        const isLatest = index === 0;

                        return (
                          <tr
                            key={run.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenRun(run.id)}
                            onKeyDown={(event) =>
                              handleRowKeyDown(event, () =>
                                onOpenRun(run.id),
                              )
                            }
                            className={cx(
                              "group cursor-pointer border-b border-mockup-line/70 transition-colors last:border-0 hover:bg-white/[0.025]",
                              isLatest && "bg-mockup-amber/[0.035]",
                            )}
                          >
                            <td
                              className={cx(
                                "px-4 py-3",
                                isLatest && "border-l-2 border-mockup-amber",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cx(
                                    "flex h-7 w-7 shrink-0 items-center justify-center border bg-white/[0.02]",
                                    isLatest
                                      ? "border-mockup-amber/25 text-mockup-amber"
                                      : "border-mockup-line text-mockup-dim",
                                  )}
                                >
                                  <Icon
                                    name="activity"
                                    className="h-3.5 w-3.5"
                                  />
                                </span>
                                <div>
                                  <p className="font-mockup-mono text-[10px] font-medium text-mockup-text">
                                    {shortId(run.id)}
                                  </p>
                                  <p className="mt-0.5 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                                    {run.indexTicker}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mockup-mono text-[9px] uppercase tracking-[0.06em] text-mockup-muted">
                              {formatRunDate(run.observedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={validationTone(run.validationStatus)}>
                                {run.validationStatus === "passed"
                                  ? "PASS"
                                  : run.validationStatus === "failed"
                                    ? "FAIL"
                                    : "PENDING"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={decisionTone(run.finalDecision)}>
                                {run.finalDecision === "NO_TRADE"
                                  ? "NO TRADE"
                                  : (run.finalDecision ?? "—")}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Icon
                                name="arrowUpRight"
                                className="ml-auto h-3.5 w-3.5 text-mockup-dim transition-colors group-hover:text-mockup-amber"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                  <span>Showing {runs.length} runs</span>
                  <button
                    type="button"
                    onClick={() => onOpenRun(runs[0].id)}
                    className="flex items-center gap-1.5 text-mockup-amber transition hover:text-mockup-amber-soft"
                  >
                    Open latest
                    <Icon name="arrowUpRight" className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Deviation snapshot"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Z-score · 30d
                </span>
              }
            />
            {latestLoading && !latestDetail ? (
              <SkeletonRows rows={4} />
            ) : latestError && !latestDetail ? (
              <DetailEmpty
                message={`Latest run detail unavailable: ${latestError}`}
              />
            ) : signals.length === 0 ? (
              <DetailEmpty message="No deviation signals recorded." />
            ) : (
              <>
                <div className="grid grid-cols-[52px_minmax(0,1fr)_64px_54px] gap-3 border-b border-mockup-line px-4 py-2 font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim sm:grid-cols-[60px_minmax(0,1fr)_76px_64px]">
                  <span>Asset</span>
                  <span>Weight deviation</span>
                  <span className="text-right">Δ</span>
                  <span className="text-right">Z</span>
                </div>
                <div className="divide-y divide-mockup-line/70">
                  {signals.map((signal) => {
                    const zScore = Number(signal.zScore);
                    const tone = signalTone(signal);

                    return (
                      <div
                        key={signal.id}
                        className="grid grid-cols-[52px_minmax(0,1fr)_64px_54px] items-center gap-3 px-4 py-2.5 sm:grid-cols-[60px_minmax(0,1fr)_76px_64px]"
                      >
                        <span className="font-mockup text-[11px] font-medium uppercase tracking-[0.06em] text-mockup-text">
                          {signal.symbol}
                        </span>
                        <SegmentedBar
                          value={Math.min(
                            100,
                            (Math.abs(zScore) / 3) * 100,
                          )}
                          tone={tone}
                          segments={30}
                        />
                        <span className="text-right font-mockup-mono text-[9px] text-mockup-muted">
                          {formatPercent(signal.weightDeviation, {
                            signed: true,
                          })}
                        </span>
                        <span
                          className={cx(
                            "text-right font-mockup-mono text-[10px]",
                            toneText[tone],
                          )}
                        >
                          {formatNumber(signal.zScore, 2, true)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Constituent heatmap"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  {constituents.length > 0
                    ? `${constituents.length} assets + cash`
                    : "No snapshot"}
                </span>
              }
            />
            {heatmap.length === 0 ? (
              <DetailEmpty message="Constituent heatmap appears after the first run." />
            ) : (
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
                {heatmap.map((tile) => (
                  <HeatTile key={tile.symbol} {...tile} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-2.5">
          <Panel>
            <PanelHeader
              title="Top constituents"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Weight · Z
                </span>
              }
            />
            {topConstituents.length === 0 ? (
              <DetailEmpty message="No constituent weights recorded." />
            ) : (
              <>
                <div className="divide-y divide-mockup-line/70">
                  {topConstituents.map((constituent) => (
                    <div
                      key={constituent.symbol}
                      className="flex items-center gap-2.5 px-4 py-2.5"
                    >
                      <TokenAvatar
                        symbol={constituent.symbol}
                        tone={constituent.tone}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-mockup text-[11px] font-medium uppercase text-mockup-text">
                          {constituent.symbol}
                        </p>
                        <p className="font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                          Weight {formatPercent(constituent.weight)}
                        </p>
                      </div>
                      <p
                        className={cx(
                          "font-mockup-mono text-[10px]",
                          toneText[constituent.tone],
                        )}
                      >
                        {constituent.zScore}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                  <span>Basket weight</span>
                  <span className="text-mockup-text">
                    {formatPercent(totalWeight)}
                  </span>
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Execution flow"
              action={
                <Badge tone={executionTone(execution?.status)}>
                  {execution ? execution.status.toUpperCase() : "Not reached"}
                </Badge>
              }
            />
            {executionRows.length === 0 ? (
              <DetailEmpty message="Execution was not reached for the latest run." />
            ) : (
              <>
                <div className="space-y-3 px-4 py-3">
                  {executionRows.map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mockup-mono text-[9px] uppercase tracking-[0.1em] text-mockup-muted">
                          {row.label}
                        </span>
                        <span
                          className={cx(
                            "font-mockup-mono text-[10px]",
                            toneText[row.tone],
                          )}
                        >
                          {row.value}
                        </span>
                      </div>
                      <SegmentedBar
                        value={row.pct}
                        tone={row.tone}
                        segments={28}
                        className="mt-2"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                  <span>Net exposure</span>
                  <span
                    className={
                      netExposure !== null && Math.abs(netExposure) < 0.01
                        ? "text-mockup-green"
                        : "text-mockup-amber"
                    }
                  >
                    {netExposure === null ? "—" : formatUsd(netExposure)}
                  </span>
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Agent consensus"
              action={
                <Badge tone={decisionTone(decision?.finalDecision)}>
                  {decision?.finalDecision ?? "No decision"}
                </Badge>
              }
            />
            {consensusRows.length === 0 ? (
              <DetailEmpty message="No agent decision recorded." />
            ) : (
              <div className="space-y-3 px-4 py-3">
                {consensusRows.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mockup-mono text-[9px] uppercase tracking-[0.12em] text-mockup-muted">
                        {row.label}
                      </span>
                      <span
                        className={cx(
                          "font-mockup-mono text-[10px]",
                          toneText[row.tone],
                        )}
                      >
                        {row.value === null
                          ? "—"
                          : `${row.value.toFixed(0)}%`}
                      </span>
                    </div>
                    <SegmentedBar
                      value={row.value ?? 0}
                      tone={row.tone}
                      segments={20}
                      className="mt-1.5"
                    />
                    <p className="mt-1 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                      {row.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <footer className="mt-3 flex flex-col gap-1.5 border-t border-mockup-line pt-3 font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim sm:flex-row sm:items-center sm:justify-between">
        <span>Live API · /api/runs</span>
        <span>
          {latestDetail
            ? `Latest snapshot ${formatRunDate(latestDetail.snapshot.observedAt)}`
            : "Awaiting first run"}
        </span>
      </footer>
    </>
  );
}
