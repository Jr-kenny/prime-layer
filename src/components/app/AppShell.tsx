import { Link, useLocation } from "@tanstack/react-router";
import { Suspense, lazy, useState, type ReactNode } from "react";
import { Bot, Boxes, Code2, Coins, FileSearch, GitBranch, Radar, Menu, X } from "lucide-react";
import { WorkspaceAuthShell } from "@/components/app/WorkspaceAuthShell";

const workspaceNav = [
  { to: "/app", label: "Intelligence", icon: Radar, exact: true, note: "command" },
  {
    to: "/app/demand-graph",
    label: "Demand Graph",
    icon: GitBranch,
    exact: false,
    note: "live",
  },
  { to: "/app/supply", label: "Supply", icon: Boxes, exact: false, note: "3" },
  { to: "/app/evidence", label: "Evidence", icon: FileSearch, exact: false, note: "18" },
] as const;

const networkNav = [
  { to: "/app/agents", label: "Agents", icon: Bot, exact: false, note: "6" },
  { to: "/app/contributions", label: "Contributions", icon: Coins, exact: false, note: "earn" },
  { to: "/app/developers", label: "Developer", icon: Code2, exact: false, note: "spec" },
] as const;

function NavLinkList({
  items,
  onNavigate,
}: {
  items: readonly { to: string; label: string; icon: typeof Radar; exact: boolean; note: string }[];
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <nav className="app-nav-list">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          onClick={onNavigate}
          className="app-nav-link"
        >
          <span className="app-nav-icon">
            <item.icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">{item.label}</span>
          <span className="app-nav-note">{item.note}</span>
        </Link>
      ))}
    </nav>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="app-nav-stack">
      <p className="app-nav-caption">Workspace</p>
      <NavLinkList items={workspaceNav} onNavigate={onNavigate} />
      <div className="app-nav-later">
        <p className="app-nav-caption">Network layer</p>
        <NavLinkList items={networkNav} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`app-brand ${compact ? "app-brand-compact" : ""}`}>
      <span className="app-brand-mark" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span>
        <span className="app-brand-name">Prime Layer</span>
        {!compact && <span className="app-brand-subtitle">Demand intelligence network</span>}
      </span>
    </span>
  );
}

function TopbarSection() {
  const sections: [prefix: string, label: string][] = [
    ["/app/demand-graph", "Demand Graph"],
    ["/app/supply", "Supply"],
    ["/app/evidence", "Evidence"],
    ["/app/agents", "Agents"],
    ["/app/contributions", "Contributions"],
    ["/app/developers", "Developer"],
  ];
  const pathname = useLocation({ select: (l) => l.pathname });
  if (pathname.startsWith("/app/opportunities")) {
    return <span className="app-topbar-name">Case file</span>;
  }
  const hit = sections.find(([prefix]) => pathname.startsWith(prefix));
  return <span className="app-topbar-name">{hit ? hit[1] : "Intelligence"}</span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div>
          <Link to="/" className="app-rail-brand" aria-label="Prime Layer: back to landing page">
            <Brand />
          </Link>
          <div className="app-rail-rule" />
          <NavList />
        </div>

        <div className="app-rail-footer">
          <WorkspaceAuthShell />
          <Link to="/" className="app-rail-site-link">
            ← Platform overview
          </Link>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-mobile-header">
          <Link to="/" aria-label="Prime Layer: back to landing page">
            <Brand compact />
          </Link>
          <button
            type="button"
            className="app-menu-button"
            aria-expanded={open}
            aria-controls="mobile-app-navigation"
            aria-label={open ? "Close workspace menu" : "Open workspace menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>
        {open && (
          <div id="mobile-app-navigation" className="app-mobile-nav">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        )}

        <div className="app-topbar">
          <div className="app-topbar-context">
            <span className="app-topbar-kicker">Workspace</span>
            <span className="app-topbar-separator" aria-hidden />
            <TopbarSection />
          </div>
        </div>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <header className="app-page-header">
      <div className="app-page-header-inner">
        <div className="app-page-header-copy">
          <p className="label-mono app-page-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          {intro && <p className="app-page-intro">{intro}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
