import { mockTickers } from "./data";
import { Icon, type IconName } from "./Icon";
import { Badge, cx } from "./primitives";

type MockView = "dashboard" | "detail";

interface NavItem {
  label: string;
  icon: IconName;
  view?: MockView;
  badge?: string;
}

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: "dashboard", view: "dashboard" },
      { label: "Run Detail", icon: "activity", view: "detail", badge: "LIVE" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Signals", icon: "signals" },
      { label: "Constituents", icon: "layers" },
      { label: "Agent Debate", icon: "sparkles" },
    ],
  },
  {
    label: "Action",
    items: [
      { label: "Risk Engine", icon: "shield" },
      { label: "Execution", icon: "bolt" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Reports", icon: "file" },
      { label: "Settings", icon: "settings" },
    ],
  },
];

export function MockupLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
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
    </div>
  );
}

export function MockupSidebar({
  view,
  onViewChange,
}: {
  view: MockView;
  onViewChange: (view: MockView) => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-mockup-line bg-[#070707] lg:flex">
      <div className="flex h-14 items-center border-b border-mockup-line px-4">
        <MockupLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-3 pb-2 pt-2 font-mockup-mono text-[8px] font-medium uppercase tracking-[0.24em] text-mockup-dim">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.view === view;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.view) {
                        onViewChange(item.view);
                      }
                    }}
                    className={cx(
                      "group flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left font-mockup text-[11px] transition-colors",
                      active
                        ? "border-mockup-amber bg-mockup-amber/[0.06] text-mockup-text"
                        : "border-transparent text-mockup-muted hover:bg-white/[0.02] hover:text-mockup-text",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      className={cx(
                        "h-3.5 w-3.5 shrink-0",
                        active
                          ? "text-mockup-amber"
                          : "text-mockup-dim group-hover:text-mockup-muted",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-[1px] border border-mockup-amber/30 bg-mockup-amber/10 px-1 py-0.5 font-mockup-mono text-[7px] font-medium uppercase tracking-[0.12em] text-mockup-amber">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-mockup-line px-4 py-3">
        <div className="flex items-center justify-between font-mockup-mono text-[8px] uppercase tracking-[0.18em] text-mockup-dim">
          <span>v0.1.0</span>
          <span className="flex items-center gap-1.5 text-mockup-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mockup-green shadow-[0_0_8px_rgba(46,212,122,0.7)]" />
            Connected
          </span>
        </div>
      </div>
    </aside>
  );
}

export function MockupTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-mockup-line bg-mockup-bg/95 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <MockupLogo compact />
        </div>

        <div className="hidden h-8 w-[300px] items-center gap-2 rounded-[2px] border border-mockup-line bg-mockup-panel px-2.5 md:flex">
          <Icon name="search" className="h-3.5 w-3.5 text-mockup-dim" />
          <span className="flex-1 truncate font-mockup text-[11px] text-mockup-dim">
            Search runs, symbols, agents...
          </span>
          <span className="rounded-[1px] border border-mockup-line-strong px-1.5 py-0.5 font-mockup-mono text-[8px] text-mockup-dim">
            ⌘K
          </span>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-4 xl:flex">
          {mockTickers.map((ticker) => (
            <div
              key={ticker.symbol}
              className="flex items-center gap-1.5 font-mockup-mono text-[9px] tracking-[0.02em]"
            >
              <span className="text-mockup-dim">{ticker.symbol}</span>
              <span className="text-mockup-text">{ticker.price}</span>
              <span className="text-mockup-green">{ticker.change}</span>
            </div>
          ))}
          <span className="h-3 w-px bg-mockup-line-strong" />
          <div className="flex items-center gap-1.5 font-mockup-mono text-[9px]">
            <span className="text-mockup-dim">F&amp;G</span>
            <span className="text-mockup-amber">68</span>
            <span className="text-mockup-green">GREED</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge tone="amber" className="hidden sm:inline-flex">
            Static mockup
          </Badge>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-mockup-line bg-mockup-panel text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text"
            aria-label="Notifications"
          >
            <Icon name="bell" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-mockup-line bg-mockup-panel text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text"
            aria-label="Settings"
          >
            <Icon name="settings" className="h-3.5 w-3.5" />
          </button>
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-mockup-amber-soft to-[#9b4d00] ring-1 ring-white/10" />
        </div>
      </div>
    </header>
  );
}
