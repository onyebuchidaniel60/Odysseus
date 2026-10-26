import { mockDetail, type MockTone } from "./data";
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

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatSigned(value: string | number, digits = 2) {
  const parsed = Number(value);

  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(digits)}`;
}

function formatPercent(
  value: string | number | null | undefined,
  digits = 2,
  signed = false,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const parsed = Number(value);
  const prefix = signed && parsed > 0 ? "+" : "";

  return `${prefix}${(parsed * 100).toFixed(digits)}%`;
}

function formatUsd(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function humanizeKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCheckValue(
  name: string,
  value: string | number | null | undefined,
) {
  switch (name) {
    case "data_confidence":
    case "ai_confidence":
      return formatPercent(value, 1);
    case "spread":
    case "stop_loss":
      return formatPercent(value, 2);
    case "depth":
    case "position_size":
      return formatUsd(value);
    default:
      return typeof value === "string"
        ? value.replace(/_/g, " ")
        : String(value);
  }
}

function directionTone(direction: string): MockTone {
  return direction === "overextended" ? "amber" : "red";
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

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "—";
  }

  return Object.entries(payload as Record<string, unknown>)
    .slice(0, 2)
    .map(([key, value]) => `${humanizeKey(key)} ${String(value)}`)
    .join(" · ");
}

export function RunDetailView({ onBack }: { onBack: () => void }) {
  const { snapshot, signals, decision, riskCheck, execution, auditLog } =
    mockDetail;
  const chief = decision?.chiefOutput;
  const topSignal = signals[0];

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="group flex items-center gap-2 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.16em] text-mockup-muted transition hover:text-mockup-text"
        >
          <Icon
            name="arrowLeft"
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
          />
          All runs
        </button>
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
            <Badge tone="amber">SHORT</Badge>
            <Badge tone="green">Validation passed</Badge>
          </div>
          <p className="mt-1 break-all font-mockup-mono text-[9px] text-mockup-muted">
            {snapshot.id} · {formatDate(snapshot.observedAt)} ·{" "}
            {snapshot.indexTicker}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-[2px] border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text"
          >
            <Icon name="download" className="h-3 w-3" />
            Export audit
          </button>
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-[2px] border border-mockup-amber/30 bg-mockup-amber/10 px-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-amber transition hover:bg-mockup-amber/15"
          >
            Open API
            <Icon name="external" className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Top signal"
          value={topSignal.symbol.toUpperCase()}
          delta={`Weight ${formatPercent(topSignal.weight, 2)} · ${formatPercent(topSignal.constituentReturn, 2, true)}`}
          tone="amber"
        />
        <StatCard
          label="Z-score"
          value={formatSigned(topSignal.zScore)}
          delta="Threshold 2.00"
          tone="amber"
        />
        <StatCard
          label="Risk approved"
          value={formatUsd(riskCheck?.approvedSize)}
          delta={`Stop loss ${formatPercent(riskCheck?.stopLoss)}`}
          tone="green"
        />
        <StatCard
          label="Execution"
          value={(execution?.status ?? "—").toUpperCase()}
          delta={`${execution?.legs.length ?? 0} / 2 legs filled`}
          tone="green"
        />
      </div>

      <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
        <div className="min-w-0 space-y-2.5">
          <Panel>
            <PanelHeader
              title="Deviation signals"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Sorted by |z| ↓
                </span>
              }
            />
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
                    const tone = directionTone(signal.direction);

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
                            isTop &&
                              "border-l-2 border-mockup-amber",
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <TokenAvatar
                              symbol={signal.symbol}
                              tone={tone}
                            />
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
                            {formatPercent(
                              signal.constituentReturn,
                              2,
                              true,
                            )}
                          </p>
                          <p className="mt-0.5 font-mockup-mono text-[8px] text-mockup-dim">
                            Index{" "}
                            {formatPercent(signal.indexReturn, 2, true)}
                          </p>
                        </td>
                        <td
                          className={cx(
                            "px-4 py-3 font-mockup-mono text-[10px]",
                            toneText[tone],
                          )}
                        >
                          {formatPercent(signal.weightDeviation, 2, true)}
                        </td>
                        <td
                          className={cx(
                            "px-4 py-3 font-mockup-mono text-[11px]",
                            toneText[tone],
                          )}
                        >
                          {formatSigned(signal.zScore)}
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
          </Panel>

          <Panel>
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
                    {formatPercent(
                      decision?.bullOutput?.confidence,
                      0,
                    )}{" "}
                    conf
                  </span>
                </div>

                <p className="mt-3 text-[12px] leading-5 text-mockup-text/90">
                  {decision?.bullOutput?.argument}
                </p>

                <div className="mt-4 border-t border-mockup-green/10 pt-3">
                  <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                    Key points
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {decision?.bullOutput?.key_points.map((point, index) => (
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
                    {formatPercent(
                      decision?.bearOutput?.confidence,
                      0,
                    )}{" "}
                    conf
                  </span>
                </div>

                <p className="mt-3 text-[12px] leading-5 text-mockup-text/90">
                  {decision?.bearOutput?.argument}
                </p>

                <div className="mt-4 border-t border-mockup-red/10 pt-3">
                  <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                    Key points
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {decision?.bearOutput?.key_points.map((point, index) => (
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
                      {formatPercent(chief?.confidence, 0)} conf
                    </span>
                    <Badge tone="amber">{chief?.decision}</Badge>
                  </div>
                </div>

                <p className="mt-4 max-w-4xl text-[12px] leading-5 text-mockup-text/90">
                  {chief?.thesis}
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                      Invalidators
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {chief?.invalidators.map((item, index) => (
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
                      {chief?.key_evidence.map((item, index) => (
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
          <Panel>
            <PanelHeader
              title="Risk checklist"
              action={<Badge tone="green">Approved</Badge>}
            />
            <div className="divide-y divide-mockup-line/70">
              {riskCheck?.checks.map((check) => (
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
            <div className="grid grid-cols-2 gap-4 border-t border-mockup-line bg-white/[0.015] px-4 py-3">
              <div>
                <p className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Approved size
                </p>
                <p className="mt-1 font-mockup-mono text-[11px] text-mockup-text">
                  {formatUsd(riskCheck?.approvedSize)}
                </p>
              </div>
              <div>
                <p className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Stop loss
                </p>
                <p className="mt-1 font-mockup-mono text-[11px] text-mockup-text">
                  {formatPercent(riskCheck?.stopLoss)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Execution"
              action={<Badge tone="green">Filled</Badge>}
            />
            <div className="flex items-center justify-between border-b border-mockup-line px-4 py-2.5">
              <span className="font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                Venue
              </span>
              <span className="font-mockup-mono text-[9px] text-mockup-text">
                {execution?.venue}
              </span>
            </div>
            <div className="divide-y divide-mockup-line/70">
              {execution?.legs.map((leg) => (
                <div key={leg.orderId} className="px-4 py-3">
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
                    <span className="truncate">{leg.orderId}</span>
                    <span className="uppercase text-mockup-green">
                      {leg.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
              <span>Client order</span>
              <span className="text-mockup-muted">
                {execution?.clientOrderId}
              </span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Audit timeline"
              action={
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  {auditLog.length} events
                </span>
              }
            />
            <ol className="relative space-y-3 px-4 py-4 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-mockup-line-strong">
              {auditLog.map((event) => {
                const tone = eventTone(event.eventType);

                return (
                  <li key={event.id} className="relative pl-5">
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
              })}
            </ol>
          </Panel>
        </div>
      </div>

      <footer className="mt-3 flex flex-col gap-1.5 border-t border-mockup-line pt-3 font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim sm:flex-row sm:items-center sm:justify-between">
        <span>Static mockup · no API calls</span>
        <span>Audit snapshot · 26 Oct 2026 · 00:05 UTC</span>
      </footer>
    </>
  );
}
