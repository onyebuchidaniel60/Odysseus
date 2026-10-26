import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import type { MockTone } from "@/components/mockup/types";
import { Icon, type IconName } from "@/components/mockup/Icon";
import {
  Badge,
  SegmentedBar,
  cx,
  toneText,
} from "@/components/mockup/primitives";

export const metadata: Metadata = {
  title: "Odysseus — Autonomous SSI Deviation Agent",
  description:
    "Adversarial agentic trading for MAG7.ssi index deviations on SoDEX. Deterministic validation, Bull/Bear debate, hard risk gates, and transparent execution.",
};

const repoUrl = "https://github.com/onyebuchidaniel60/Odysseus";
const docsUrl = `${repoUrl}#readme`;

const navLinks = [
  { label: "Terminal", href: "/dashboard", external: false },
  { label: "Architecture", href: "#architecture", external: false },
  { label: "Docs", href: docsUrl, external: true },
  { label: "GitHub", href: repoUrl, external: true },
];

const whyCards: Array<{
  index: string;
  title: string;
  body: string;
  tag: string;
  icon: IconName;
}> = [
  {
    index: "01",
    title: "Data-First",
    body: "Deterministic validation gates ensure no trade is placed on stale or misaligned klines.",
    tag: "Hard gate",
    icon: "layers",
  },
  {
    index: "02",
    title: "Adversarial AI",
    body: "A structured Bull vs. Bear debate prevents the LLM from blindly chasing momentum.",
    tag: "Constrained",
    icon: "sparkles",
  },
  {
    index: "03",
    title: "Risk-Obsessed",
    body: "Five hard risk checks (spread, depth, confidence) gate every execution.",
    tag: "Deterministic",
    icon: "shield",
  },
  {
    index: "04",
    title: "NO_TRADE by Default",
    body: "The agent only trades when a statistical anomaly (Z > 2.0) is proven.",
    tag: "Default state",
    icon: "x",
  },
];

const pipelineSteps: Array<{
  title: string;
  body: string;
  tag: string;
  note: string;
  tone: MockTone;
  icon: IconName;
}> = [
  {
    title: "SoSoValue API",
    body: "Constituent and index klines, normalized and aligned.",
    tag: "Data",
    note: "7 assets · 90d window",
    tone: "muted",
    icon: "layers",
  },
  {
    title: "Validation Gate",
    body: "Staleness, alignment, and tracking-error checks.",
    tag: "Hard gate",
    note: "FAIL → NO_TRADE",
    tone: "red",
    icon: "shield",
  },
  {
    title: "Deviation Engine",
    body: "Weight-adjusted returns and robust z-scores.",
    tag: "Signal",
    note: "|z| ≥ 2.00",
    tone: "amber",
    icon: "signals",
  },
  {
    title: "Bull vs. Bear",
    body: "Structured adversarial debate with a constrained Chief.",
    tag: "Agents",
    note: "SHORT or NO_TRADE",
    tone: "muted",
    icon: "sparkles",
  },
  {
    title: "Risk Engine",
    body: "Spread, depth, confidence, size, and stop-loss checks.",
    tag: "Hard gate",
    note: "REJECT → NO_TRADE",
    tone: "red",
    icon: "filter",
  },
  {
    title: "SoDEX Execution",
    body: "Relative-value legs on testnet with a full audit trail.",
    tag: "Execution",
    note: "SHORT + LONG",
    tone: "green",
    icon: "bolt",
  },
];

const heroMetrics = [
  { label: "Spread", value: "12 bps" },
  { label: "Depth", value: "$240k" },
  { label: "AI conf.", value: "78%" },
];

const thesisStats = [
  { value: "00", label: "Human interventions", note: "Daily loop" },
  { value: "00", label: "Custodial keys", note: "No funds held" },
  { value: "100%", label: "Deterministic risk", note: "Hard gates" },
  { value: "01", label: "Run per UTC day", note: "Idempotent lock" },
];

function NavLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const className =
    "font-mockup-mono text-[9px] uppercase tracking-[0.18em] text-mockup-muted transition hover:text-mockup-text";

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function SectionIntro({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-mockup-amber" />
          <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.24em] text-mockup-amber">
            {kicker}
          </p>
        </div>
        <h2 className="mt-4 font-mockup text-[28px] font-medium tracking-[-0.035em] text-mockup-text sm:text-[34px]">
          {title}
        </h2>
      </div>
      <p className="max-w-sm text-[12px] leading-5 text-mockup-muted lg:text-right">
        {description}
      </p>
    </div>
  );
}

function Cta({
  href,
  children,
  variant,
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant: "primary" | "secondary";
  external?: boolean;
}) {
  const className =
    variant === "primary"
      ? "group inline-flex h-10 items-center justify-center gap-2 rounded-[2px] bg-mockup-amber px-5 font-mockup text-[11px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft"
      : "inline-flex h-10 items-center justify-center gap-2 rounded-[2px] border border-mockup-line bg-mockup-panel px-5 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-amber/30 hover:text-mockup-text";

  const content = (
    <>
      {children}
      <Icon
        name={variant === "primary" ? "arrowUpRight" : "file"}
        className={cx(
          "h-3.5 w-3.5",
          variant === "primary" &&
            "transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
        )}
      />
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export default function LandingMockupPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-mockup-bg font-mockup text-mockup-text selection:bg-mockup-amber/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(245,166,35,0.10),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(245,166,35,0.04),transparent_28%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mockup-amber/60 to-transparent" />

      <div className="relative border-b border-mockup-line bg-mockup-panel/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 font-mockup-mono text-[7px] uppercase tracking-[0.2em] text-mockup-dim sm:px-6 lg:px-8">
          <span className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-mockup-green shadow-[0_0_8px_rgba(46,212,122,0.7)]" />
            System online · SoDEX testnet
          </span>
          <span className="hidden items-center gap-4 sm:flex">
            <span>MAG7.SSI</span>
            <span>UTC 00:05:00</span>
            <span className="text-mockup-amber">Buildathon 2026</span>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-mockup-line bg-mockup-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center border border-mockup-amber/40 bg-mockup-amber/10 text-mockup-amber">
              <Icon name="activity" className="h-3.5 w-3.5" />
            </span>
            <span className="font-mockup-mono text-[12px] font-semibold tracking-[0.28em] text-mockup-amber">
              ODYSSEUS
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.label}
                href={link.href}
                external={link.external}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <Link
            href="/dashboard"
            className="group inline-flex h-8 items-center gap-2 rounded-[2px] bg-mockup-amber px-3 font-mockup text-[10px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft"
          >
            Launch Console
            <Icon
              name="arrowUpRight"
              className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-mockup-amber/[0.06] blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
            <div className="grid gap-12 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] xl:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-px w-6 bg-mockup-amber" />
                  <p className="font-mockup-mono text-[9px] font-medium uppercase tracking-[0.24em] text-mockup-amber">
                    Autonomous agentic trading
                  </p>
                </div>

                <h1 className="mt-5 max-w-3xl text-balance font-mockup text-[34px] font-medium leading-[0.98] tracking-[-0.055em] text-mockup-text sm:text-[48px] lg:text-[56px] xl:text-[62px]">
                  The first adversarial agent for{" "}
                  <span className="text-mockup-amber">
                    SSI Index Deviations.
                  </span>
                </h1>

                <p className="mt-6 max-w-2xl text-[14px] leading-7 text-mockup-muted sm:text-[15px]">
                  Odysseus monitors MAG7.ssi constituents, quantifies
                  weight-adjusted deviations, and runs a Bull/Bear debate before
                  executing risk-managed relative-value trades on SoDEX. It is
                  built to say NO_TRADE.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Cta href="/dashboard" variant="primary">
                    Enter Console
                  </Cta>
                  <Cta href={docsUrl} variant="secondary" external>
                    Read the Docs
                  </Cta>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-mockup-green" />
                    Deterministic validation
                  </span>
                  <span className="h-3 w-px bg-mockup-line-strong" />
                  <span>Adversarial debate</span>
                  <span className="h-3 w-px bg-mockup-line-strong" />
                  <span>Hard risk gates</span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-mockup-amber/[0.04] blur-3xl" />
                <div className="relative border border-mockup-line bg-mockup-panel shadow-2xl">
                  <div className="flex h-11 items-center justify-between border-b border-mockup-line px-4">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-mockup-green shadow-[0_0_8px_rgba(46,212,122,0.7)]" />
                      <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-muted">
                        Pipeline / live snapshot
                      </span>
                    </div>
                    <Badge tone="green">Live</Badge>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                          MAG7.SSI / SSIMAG7
                        </p>
                        <p className="mt-2 font-mockup text-[24px] font-medium tracking-[-0.03em] text-mockup-text">
                          BTC{" "}
                          <span className="text-mockup-dim">/ USDT</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                          Z-score / 30d
                        </p>
                        <p className="mt-1 font-mockup text-[34px] font-medium leading-none tracking-[-0.04em] text-mockup-amber">
                          +2.45
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone="amber">Overextended</Badge>
                      <span className="font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                        Weight 73.63%
                      </span>
                      <span className="h-3 w-px bg-mockup-line-strong" />
                      <span className="font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-green">
                        Validation passed
                      </span>
                    </div>

                    <div className="mt-4 border border-mockup-line bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                          Weight deviation
                        </span>
                        <span className="font-mockup-mono text-[10px] text-mockup-amber">
                          +1.68%
                        </span>
                      </div>
                      <SegmentedBar
                        value={82}
                        tone="amber"
                        segments={28}
                        className="mt-2"
                      />
                    </div>

                    <div className="mt-4 border border-mockup-line bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                          Deviation / 30d
                        </span>
                        <span className="font-mockup-mono text-[8px] text-mockup-muted">
                          BTC vs. SSI
                        </span>
                      </div>
                      <svg
                        viewBox="0 0 320 64"
                        className="mt-2 h-14 w-full text-mockup-amber"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1="16"
                          x2="320"
                          y2="16"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="1"
                        />
                        <line
                          x1="0"
                          y1="32"
                          x2="320"
                          y2="32"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="1"
                        />
                        <line
                          x1="0"
                          y1="48"
                          x2="320"
                          y2="48"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="1"
                        />
                        <path
                          d="M0 54 L20 52 L40 50 L60 51 L80 46 L100 48 L120 43 L140 45 L160 38 L180 41 L200 34 L220 36 L240 28 L260 30 L280 22 L300 18 L320 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M0 54 L20 52 L40 50 L60 51 L80 46 L100 48 L120 43 L140 45 L160 38 L180 41 L200 34 L220 36 L240 28 L260 30 L280 22 L300 18 L320 12 L320 64 L0 64 Z"
                          fill="rgba(245,166,35,0.08)"
                        />
                      </svg>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {heroMetrics.map((metric) => (
                        <div
                          key={metric.label}
                          className="border border-mockup-line bg-black/20 p-2.5"
                        >
                          <p className="font-mockup-mono text-[7px] uppercase tracking-[0.16em] text-mockup-dim">
                            {metric.label}
                          </p>
                          <p className="mt-1 font-mockup-mono text-[10px] text-mockup-text">
                            {metric.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 border-t border-mockup-line pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                          Decision
                        </span>
                        <Badge tone="amber">Short</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="border border-mockup-amber/20 bg-mockup-amber/[0.03] p-2">
                          <p className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-amber">
                            Short
                          </p>
                          <p className="mt-1 font-mockup text-[12px] text-mockup-text">
                            BTC-PERP
                          </p>
                        </div>
                        <div className="border border-mockup-green/20 bg-mockup-green/[0.03] p-2">
                          <p className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-green">
                            Long
                          </p>
                          <p className="mt-1 font-mockup text-[12px] text-mockup-text">
                            MAG7.SSI
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-mockup-line pt-3">
                      <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                        Risk engine
                      </span>
                      <span className="font-mockup-mono text-[9px] text-mockup-green">
                        Approved · $5,000 · 5% stop
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-mockup-line px-4 py-2.5 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                    NO_TRADE is always a valid success outcome.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-mockup-line">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionIntro
              kicker="Why Odysseus"
              title="Built to refuse bad trades."
              description="The edge is not a better prediction. It is a stricter process."
            />

            <div className="mt-8 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {whyCards.map((card) => (
                <article
                  key={card.index}
                  className="group relative border border-mockup-line bg-mockup-panel p-5 transition hover:border-mockup-amber/25 hover:bg-mockup-amber/[0.015]"
                >
                  <div className="absolute left-0 top-0 h-px w-0 bg-mockup-amber transition-all duration-300 group-hover:w-full" />
                  <div className="flex items-center justify-between">
                    <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                      {card.index}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center border border-mockup-line bg-black/30 text-mockup-amber">
                      <Icon name={card.icon} className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h3 className="mt-5 font-mockup text-[17px] font-medium tracking-[-0.02em] text-mockup-text">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-mockup-muted">
                    {card.body}
                  </p>
                  <p className="mt-5 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                    {card.tag}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="architecture"
          className="scroll-mt-24 border-t border-mockup-line"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionIntro
              kicker="The Pipeline"
              title="From raw klines to risk-managed execution."
              description="Deterministic until the debate. Constrained after it."
            />

            <div className="mt-8 border border-mockup-line bg-mockup-panel p-2.5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-6">
                {pipelineSteps.map((step, index) => (
                  <div key={step.title} className="relative flex-1">
                    <div className="h-full border border-mockup-line bg-black/20 p-4 transition hover:border-mockup-amber/20">
                      <div className="flex items-center justify-between">
                        <span className="font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
                          0{index + 1}
                        </span>
                        <span className="flex h-6 w-6 items-center justify-center border border-mockup-line bg-mockup-panel text-mockup-amber">
                          <Icon name={step.icon} className="h-3 w-3" />
                        </span>
                      </div>
                      <p className="mt-4 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-amber">
                        {step.tag}
                      </p>
                      <h3 className="mt-2 font-mockup text-[14px] font-medium text-mockup-text">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[11px] leading-4 text-mockup-muted">
                        {step.body}
                      </p>
                      <p
                        className={cx(
                          "mt-4 font-mockup-mono text-[8px] uppercase tracking-[0.12em]",
                          toneText[step.tone],
                        )}
                      >
                        {step.note}
                      </p>
                    </div>

                    {index < pipelineSteps.length - 1 ? (
                      <span className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center border border-mockup-amber/30 bg-mockup-bg text-mockup-amber xl:flex">
                        <Icon name="chevronRight" className="h-3 w-3" />
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border border-mockup-line bg-mockup-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
                <Icon name="file" className="h-3 w-3 text-mockup-amber" />
                Every stage persists to Postgres. Every decision is auditable.
              </p>
              <Link
                href="/dashboard"
                className="font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-amber transition hover:text-mockup-amber-soft"
              >
                Inspect a live run →
              </Link>
            </div>
          </div>
        </section>

        <section
          id="thesis"
          className="scroll-mt-24 border-t border-mockup-line"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionIntro
              kicker="Hackathon Thesis"
              title="The one-person on-chain finance business."
              description="A self-contained fund manager with no human in the loop."
            />

            <div className="mt-8 grid gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
              <div className="relative overflow-hidden border border-mockup-line bg-mockup-panel p-6 sm:p-8">
                <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 bg-[radial-gradient(circle_at_top_right,rgba(245,166,35,0.12),transparent_70%)]" />
                <Badge tone="amber">Buildathon 2026</Badge>
                <p className="mt-6 max-w-3xl font-mockup text-[24px] font-medium leading-[1.2] tracking-[-0.03em] text-mockup-text sm:text-[30px]">
                  “Odysseus is a self-contained fund manager. It requires no
                  human intervention, custodies no funds, and executes
                  transparently on-chain.”
                </p>
                <p className="mt-5 max-w-2xl text-[12px] leading-5 text-mockup-muted">
                  The product is not a signal feed. It is an operating loop:
                  ingest the index, prove the deviation, debate the trade,
                  enforce the risk budget, and leave an audit trail.
                </p>
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 font-mockup-mono text-[9px] uppercase tracking-[0.14em] text-mockup-amber transition hover:text-mockup-amber-soft"
                >
                  Read the thesis
                  <Icon name="arrowUpRight" className="h-3 w-3" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {thesisStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="border border-mockup-line bg-mockup-panel p-4"
                  >
                    <p className="font-mockup text-[28px] font-medium tracking-[-0.04em] text-mockup-text">
                      {stat.value}
                    </p>
                    <p className="mt-1 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-muted">
                      {stat.label}
                    </p>
                    <p className="mt-4 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                      {stat.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-mockup-line">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center border border-mockup-amber/40 bg-mockup-amber/10 text-mockup-amber">
                <Icon name="activity" className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="font-mockup-mono text-[10px] font-semibold tracking-[0.24em] text-mockup-amber">
                  ODYSSEUS
                </p>
                <p className="mt-1 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  Autonomous SSI deviation agent
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.label}
                  href={link.href}
                  external={link.external}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-mockup-line pt-4 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim sm:flex-row sm:items-center sm:justify-between">
            <p>
              Built for the SoSoValue Buildathon. Powered by SoSoValue &amp;
              SoDEX.
            </p>
            <p>© 2026 Odysseus</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
