import type { ReactNode } from "react";

import type { MockTone } from "./data";

export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export const toneText: Record<MockTone, string> = {
  amber: "text-mockup-amber",
  green: "text-mockup-green",
  red: "text-mockup-red",
  lime: "text-mockup-lime",
  muted: "text-mockup-muted",
};

export const toneDot: Record<MockTone, string> = {
  amber: "bg-mockup-amber",
  green: "bg-mockup-green",
  red: "bg-mockup-red",
  lime: "bg-mockup-lime",
  muted: "bg-mockup-muted",
};

const toneBadge: Record<MockTone, string> = {
  amber: "border-mockup-amber/30 bg-mockup-amber/10 text-mockup-amber",
  green: "border-mockup-green/25 bg-mockup-green/10 text-mockup-green",
  red: "border-mockup-red/25 bg-mockup-red/10 text-mockup-red",
  lime: "border-mockup-lime/25 bg-mockup-lime/10 text-mockup-lime",
  muted: "border-mockup-line-strong bg-white/[0.03] text-mockup-muted",
};

const toneAvatar: Record<MockTone, string> = {
  amber:
    "border-mockup-amber/25 bg-mockup-amber/10 text-mockup-amber",
  green:
    "border-mockup-green/25 bg-mockup-green/10 text-mockup-green",
  red: "border-mockup-red/25 bg-mockup-red/10 text-mockup-red",
  lime: "border-mockup-lime/25 bg-mockup-lime/10 text-mockup-lime",
  muted: "border-mockup-line-strong bg-white/[0.03] text-mockup-muted",
};

const toneSegment: Record<MockTone, string> = {
  amber: "bg-mockup-amber",
  green: "bg-mockup-green",
  red: "bg-mockup-red",
  lime: "bg-mockup-lime",
  muted: "bg-mockup-muted",
};

const toneGradient: Record<MockTone, string> = {
  amber:
    "from-mockup-amber/40 via-mockup-amber/10 to-transparent",
  green: "from-mockup-green/35 via-mockup-green/10 to-transparent",
  red: "from-mockup-red/35 via-mockup-red/10 to-transparent",
  lime: "from-mockup-lime/30 via-mockup-lime/10 to-transparent",
  muted: "from-white/[0.06] via-white/[0.02] to-transparent",
};

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-[2px] border border-mockup-line bg-mockup-panel",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex min-h-11 items-center justify-between gap-3 border-b border-mockup-line px-4 py-2.5",
        className,
      )}
    >
      <h2 className="font-mockup-mono text-[10px] font-medium uppercase tracking-[0.2em] text-mockup-muted">
        {title}
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: MockTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5 font-mockup-mono text-[9px] font-medium uppercase leading-4 tracking-[0.16em]",
        toneBadge[tone],
        className,
      )}
    >
      <span className={cx("h-1 w-1 rounded-full", toneDot[tone])} />
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone,
  className,
}: {
  label: string;
  value: string;
  delta: string;
  tone: MockTone;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[2px] border border-mockup-line bg-mockup-panel px-4 py-4",
        className,
      )}
    >
      <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.2em] text-mockup-muted">
        {label}
      </p>
      <p className="mt-3 font-mockup text-[28px] font-medium leading-none tracking-[-0.04em] text-mockup-text">
        {value}
      </p>
      <p
        className={cx(
          "mt-3 font-mockup-mono text-[10px] uppercase tracking-[0.08em]",
          toneText[tone],
        )}
      >
        {delta}
      </p>
    </div>
  );
}

export function SegmentedBar({
  value,
  tone = "green",
  segments = 24,
  className,
}: {
  value: number;
  tone?: MockTone;
  segments?: number;
  className?: string;
}) {
  const filled = Math.max(
    0,
    Math.min(segments, Math.round((value / 100) * segments)),
  );

  return (
    <div
      className={cx("flex h-2.5 w-full gap-[2px]", className)}
      aria-hidden="true"
    >
      {Array.from({ length: segments }).map((_, index) => (
        <span
          key={index}
          className={cx(
            "h-full flex-1",
            index < filled ? toneSegment[tone] : "bg-white/[0.06]",
          )}
        />
      ))}
    </div>
  );
}

export function TokenAvatar({
  symbol,
  tone = "muted",
  className,
}: {
  symbol: string;
  tone?: MockTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border font-mockup-mono text-[10px] font-semibold uppercase",
        toneAvatar[tone],
        className,
      )}
    >
      {symbol.slice(0, 1)}
    </span>
  );
}

export function HeatTile({
  symbol,
  weight,
  zScore,
  tone,
}: {
  symbol: string;
  weight: string;
  zScore: string;
  tone: MockTone;
}) {
  return (
    <div className="group relative min-h-[92px] overflow-hidden border border-mockup-line bg-mockup-panel p-3">
      <div
        className={cx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 transition-opacity group-hover:opacity-100",
          toneGradient[tone],
        )}
      />
      <div
        className={cx(
          "pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl",
          toneDot[tone],
          "opacity-20",
        )}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mockup text-sm font-medium uppercase tracking-[0.08em] text-mockup-text">
            {symbol}
          </span>
          <span className="font-mockup-mono text-[9px] text-mockup-muted">
            {weight}
          </span>
        </div>
        <p
          className={cx(
            "text-right font-mockup-mono text-[11px] font-medium",
            toneText[tone],
          )}
        >
          {zScore}
        </p>
      </div>
    </div>
  );
}

export function ViewSwitch({
  view,
  onChange,
  className,
}: {
  view: "dashboard" | "detail";
  onChange: (view: "dashboard" | "detail") => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex items-center rounded-[2px] border border-mockup-line bg-mockup-panel p-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange("dashboard")}
        aria-pressed={view === "dashboard"}
        className={cx(
          "h-7 rounded-[1px] px-2.5 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] transition",
          view === "dashboard"
            ? "bg-mockup-amber/10 text-mockup-amber"
            : "text-mockup-muted hover:text-mockup-text",
        )}
      >
        Dashboard
      </button>
      <button
        type="button"
        onClick={() => onChange("detail")}
        aria-pressed={view === "detail"}
        className={cx(
          "h-7 rounded-[1px] px-2.5 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] transition",
          view === "detail"
            ? "bg-mockup-amber/10 text-mockup-amber"
            : "text-mockup-muted hover:text-mockup-text",
        )}
      >
        Run Detail
      </button>
    </div>
  );
}
