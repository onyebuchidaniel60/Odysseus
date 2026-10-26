import type { KeyboardEvent } from "react";

import {
  mockConsensus,
  mockConstituents,
  mockDetail,
  mockFlow,
  mockHeatmap,
  mockRunMeta,
  mockRuns,
  mockStats,
  type MockTone,
} from "./data";
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

function shortId(value: string) {
  return value.slice(0, 8);
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

function formatSigned(value: string | number, digits = 2) {
  const parsed = Number(value);

  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(digits)}`;
}

function formatPercent(value: string | number, signed = false) {
  const parsed = Number(value);

  return `${signed && parsed > 0 ? "+" : ""}${(parsed * 100).toFixed(2)}%`;
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

function decisionTone(decision: string | null): MockTone {
  if (decision === "SHORT") {
    return "amber";
  }

  if (decision === "NO_TRADE") {
    return "muted";
  }

  return "muted";
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

export function DashboardView({ onOpenRun }: { onOpenRun: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.24em] text-mockup-amber">
            Pipeline console / 26 Oct 2026
          </p>
          <h1 className="mt-2 font-mockup text-[26px] font-medium tracking-[-0.035em] text-mockup-text">
            Deviation Intelligence
          </h1>
          <p className="mt-1 max-w-xl text-[12px] leading-5 text-mockup-muted">
            Daily MAG7.ssi runs, agent debate, risk gates, and execution audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-[2px] border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text"
          >
            <Icon name="download" className="h-3 w-3" />
            Export
          </button>
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-[2px] bg-mockup-amber px-3 font-mockup text-[11px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft"
          >
            <Icon name="play" className="h-3 w-3" />
            Run Pipeline
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {mockStats.map((stat) => (
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
                  Last 20 · newest first
                </span>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-mockup-line">
                    {[
                      "Run",
                      "Timestamp",
                      "Top signal",
                      "Z-score",
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
                  {mockRuns.map((run, index) => {
                    const meta = mockRunMeta[run.id];
                    const isLatest = index === 0;
                    const returnTone: MockTone =
                      !meta || meta.returnValue === "—"
                        ? "muted"
                        : meta.returnValue.startsWith("-")
                          ? "red"
                          : "green";
                    const zTone: MockTone =
                      !meta || meta.zScore === "—"
                        ? "muted"
                        : meta.zScore.startsWith("-")
                          ? "red"
                          : "amber";

                    return (
                      <tr
                        key={run.id}
                        role="button"
                        tabIndex={0}
                        onClick={onOpenRun}
                        onKeyDown={(event) =>
                          handleRowKeyDown(event, onOpenRun)
                        }
                        className={cx(
                          "group cursor-pointer border-b border-mockup-line/70 transition-colors last:border-0 hover:bg-white/[0.025]",
                          isLatest && "bg-mockup-amber/[0.035]",
                        )}
                      >
                        <td
                          className={cx(
                            "px-4 py-3",
                            isLatest &&
                              "border-l-2 border-mockup-amber",
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
                          <p className="font-mockup-mono text-[10px] text-mockup-text">
                            {meta?.topSignal ?? "—"}
                          </p>
                          <p
                            className={cx(
                              "mt-0.5 font-mockup-mono text-[9px]",
                              toneText[returnTone],
                            )}
                          >
                            {meta?.returnValue ?? "—"}
                          </p>
                        </td>
                        <td
                          className={cx(
                            "px-4 py-3 font-mockup-mono text-[11px]",
                            toneText[zTone],
                          )}
                        >
                          {meta?.zScore ?? "—"}
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
              <span>Showing 4 of 24 runs</span>
              <span className="flex items-center gap-1.5 text-mockup-amber">
                Open latest
                <Icon name="arrowUpRight" className="h-3 w-3" />
              </span>
            </div>
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
            <div className="grid grid-cols-[52px_minmax(0,1fr)_64px_54px] gap-3 border-b border-mockup-line px-4 py-2 font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim sm:grid-cols-[60px_minmax(0,1fr)_76px_64px]">
              <span>Asset</span>
              <span>Weight deviation</span>
              <span className="text-right">Δ</span>
              <span className="text-right">Z</span>
            </div>
            <div className="divide-y divide-mockup-line/70">
              {mockDetail.signals.map((signal) => {
                const zScore = Number(signal.zScore);
                const tone: MockTone =
                  zScore >= 0 ? "amber" : "red";

                return (
                  <div
                    key={signal.id}
                    className="grid grid-cols-[52px_minmax(0,1fr)_64px_54px] items-center gap-3 px-4 py-2.5 sm:grid-cols-[60px_minmax(0,1fr)_76px_64px]"
                  >
                    <span className="font-mockup text-[11px] font-medium uppercase tracking-[0.06em] text-mockup-text">
                      {signal.symbol}
                    </span>
                    <SegmentedBar
                      value={Math.min(100, (Math.abs(zScore) / 3) * 100)}
                      tone={tone}
                      segments={30}
                    />
                    <span className="text-right font-mockup-mono text-[9px] text-mockup-muted">
                      {formatPercent(signal.weightDeviation, true)}
                    </span>
                    <span
                      className={cx(
                        "text-right font-mockup-mono text-[10px]",
                        toneText[tone],
                      )}
                    >
                      {formatSigned(signal.zScore)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Constituent heatmap"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  7 assets + cash
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
              {mockHeatmap.map((tile) => (
                <HeatTile key={tile.symbol} {...tile} />
              ))}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-2.5">
          <Panel>
            <PanelHeader
              title="Top constituents"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  24h
                </span>
              }
            />
            <div className="divide-y divide-mockup-line/70">
              {mockConstituents.map((constituent) => (
                <div
                  key={constituent.symbol}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                >
                  <TokenAvatar
                    symbol={constituent.symbol}
                    tone={constituent.tone}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mockup text-[11px] font-medium text-mockup-text">
                      {constituent.symbol}
                    </p>
                    <p className="font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                      {constituent.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mockup-mono text-[10px] text-mockup-text">
                      {constituent.price}
                    </p>
                    <p
                      className={cx(
                        "font-mockup-mono text-[9px]",
                        toneText[constituent.tone],
                      )}
                    >
                      {constituent.change}
                    </p>
                  </div>
                  <span className="w-12 text-right font-mockup-mono text-[9px] text-mockup-muted">
                    {constituent.weight}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
              <span>Basket weight</span>
              <span className="text-mockup-text">100.00%</span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Execution flow"
              action={<Badge tone="green">Filled</Badge>}
            />
            <div className="space-y-3 px-4 py-3">
              {mockFlow.map((row) => (
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
              <span className="text-mockup-green">$0</span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Agent consensus"
              action={<Badge tone="amber">Short</Badge>}
            />
            <div className="space-y-3 px-4 py-3">
              {mockConsensus.map((row) => (
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
                      {row.value}%
                    </span>
                  </div>
                  <SegmentedBar
                    value={row.value}
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
          </Panel>
        </div>
      </div>

      <footer className="mt-3 flex flex-col gap-1.5 border-t border-mockup-line pt-3 font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim sm:flex-row sm:items-center sm:justify-between">
        <span>Static mockup · no API calls</span>
        <span>Last sync 26 Oct 2026 · 00:05 UTC</span>
      </footer>
    </>
  );
}
