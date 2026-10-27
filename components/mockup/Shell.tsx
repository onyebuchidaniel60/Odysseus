import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";
import { Badge, cx } from "./primitives";

type ActiveView = "dashboard" | "run" | "replay";

const repoUrl = "https://github.com/onyebuchidaniel60/Odysseus";
const docsUrl = `${repoUrl}#readme`;

interface NavItem {
  label: string;
  href: string | null;
  icon: IconName;
  external?: boolean;
  active?: boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNavGroups(
  active: ActiveView,
  latestRunId: string | null,
): NavGroup[] {
  const runHref = latestRunId ? `/runs/${latestRunId}` : null;

  return [
    {
      label: "Overview",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: "dashboard",
          active: active === "dashboard",
        },
        {
          label: "Replay Engine",
          href: "/replay",
          icon: "clock",
          active: active === "replay",
        },
        {
          label: "Run Detail",
          href: runHref,
          icon: "activity",
          active: active === "run",
          badge: latestRunId ? "LIVE" : undefined,
        },
      ],
    },
    {
      label: "Intelligence",
      items: [
        {
          label: "Signals",
          href: runHref ? `${runHref}#signals` : null,
          icon: "signals",
        },
        {
          label: "Agent Debate",
          href: runHref ? `${runHref}#debate` : null,
          icon: "sparkles",
        },
        {
          label: "Risk Engine",
          href: runHref ? `${runHref}#risk` : null,
          icon: "shield",
        },
        {
          label: "Execution",
          href: runHref ? `${runHref}#execution` : null,
          icon: "bolt",
        },
      ],
    },
    {
      label: "Workspace",
      items: [
        { label: "Landing", href: "/", icon: "external" },
        { label: "Docs", href: docsUrl, icon: "file", external: true },
        { label: "GitHub", href: repoUrl, icon: "external", external: true },
      ],
    },
  ];
}

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-gradient-to-br from-mockup-amber-soft to-mockup-amber shadow-mockup-glow">
        <Icon name="activity" className="h-4 w-4 text-black" />
      </span>
      <span className={cx("leading-none", compact && "hidden sm:block")}>
        <span className="block font-mockup text-[13px] font-semibold tracking-[0.2em] text-mockup-text">
          ODYSSEUS
        </span>
        <span className="mt-1 block font-mockup-mono text-[7px] uppercase tracking-[0.22em] text-mockup-dim">
          SSI deviation agent
        </span>
      </span>
    </Link>
  );
}

function SidebarItem({ item }: { item: NavItem }) {
  const className = cx(
    "group flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left font-mockup text-[11px] transition-colors",
    item.active
      ? "border-mockup-amber bg-mockup-amber/[0.06] text-mockup-text"
      : item.href
        ? "border-transparent text-mockup-muted hover:bg-white/[0.02] hover:text-mockup-text"
        : "cursor-not-allowed border-transparent text-mockup-dim/50",
  );

  const content = (
    <>
      <Icon
        name={item.icon}
        className={cx(
          "h-3.5 w-3.5 shrink-0",
          item.active
            ? "text-mockup-amber"
            : item.href
              ? "text-mockup-dim group-hover:text-mockup-muted"
              : "text-mockup-dim/40",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="rounded-[1px] border border-mockup-amber/30 bg-mockup-amber/10 px-1 py-0.5 font-mockup-mono text-[7px] font-medium uppercase tracking-[0.12em] text-mockup-amber">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title="Available after the first run"
        className={className}
      >
        {content}
      </span>
    );
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

export function AppSidebar({
  active,
  latestRunId,
}: {
  active: ActiveView;
  latestRunId: string | null;
}) {
  const groups = buildNavGroups(active, latestRunId);

  return (
    <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-mockup-line bg-[#070707] lg:flex">
      <div className="flex h-14 items-center border-b border-mockup-line px-4">
        <AppLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-3 pb-2 pt-2 font-mockup-mono text-[8px] font-medium uppercase tracking-[0.24em] text-mockup-dim">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-mockup-line px-4 py-3">
        <div className="flex items-center justify-between font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
          <span>v0.1.0</span>
          <span className="flex items-center gap-1.5 text-mockup-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mockup-green shadow-[0_0_8px_rgba(46,212,122,0.7)]" />
            Live API
          </span>
        </div>
      </div>
    </aside>
  );
}

export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-mockup-line bg-mockup-bg/95 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <AppLogo compact />
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <span className="flex items-center gap-2 font-mockup-mono text-[9px] uppercase tracking-[0.16em] text-mockup-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mockup-green shadow-[0_0_8px_rgba(46,212,122,0.7)]" />
            System online
          </span>
          <span className="h-3 w-px bg-mockup-line-strong" />
          <span className="font-mockup-mono text-[9px] uppercase tracking-[0.16em] text-mockup-dim">
            MAG7.SSI
          </span>
          <span className="font-mockup-mono text-[9px] uppercase tracking-[0.16em] text-mockup-dim">
            SoDEX testnet
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge tone="green" className="hidden sm:inline-flex">
            Live API
          </Badge>
          <Link
            href="/replay"
            className="flex h-8 items-center gap-1.5 rounded-[2px] border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text"
          >
            <Icon name="clock" className="h-3 w-3" />
            Replay
          </Link>
          <Link
            href="/"
            className="hidden h-8 items-center rounded-[2px] border border-mockup-line bg-mockup-panel px-3 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text sm:flex"
          >
            Landing
          </Link>
          <Link
            href="/dashboard"
            className="flex h-8 items-center rounded-[2px] border border-mockup-amber/30 bg-mockup-amber/10 px-3 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-amber transition hover:bg-mockup-amber/15"
          >
            Console
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  active,
  latestRunId,
  children,
}: {
  active: ActiveView;
  latestRunId: string | null;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-mockup-bg font-mockup text-mockup-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(245,166,35,0.10),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(245,166,35,0.05),transparent_30%)]" />

      <div className="relative flex min-h-screen">
        <AppSidebar active={active} latestRunId={latestRunId} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />

          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1500px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
