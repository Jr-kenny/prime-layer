import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Activity,
  Boxes,
  FileSearch,
  GitBranch,
  LayoutGrid,
  Menu,
  Radar,
  X,
} from "lucide-react";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/app/intelligence", label: "Intelligence", icon: Radar, exact: false },
  { to: "/app/opportunities", label: "Opportunities", icon: Activity, exact: false },
  { to: "/app/demand-graph", label: "Demand Graph", icon: GitBranch, exact: false },
  { to: "/app/supply", label: "Supply", icon: Boxes, exact: false },
  { to: "/app/evidence", label: "Evidence", icon: FileSearch, exact: false },
] as const;

const laterNav = ["Watchlists", "Agents", "Contributions", "Developer", "Settings"];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Application" className="flex flex-col gap-0.5">
      {nav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-slate/60 hover:text-vellum data-[status=active]:bg-slate/70 data-[status=active]:text-signal"
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          {item.label}
        </Link>
      ))}

      <p className="label-mono mt-6 px-3 text-ink-muted/70">Coming in this workspace</p>
      <ul className="mt-2 flex flex-col">
        {laterNav.map((l) => (
          <li
            key={l}
            className="cursor-not-allowed px-3 py-1.5 text-sm text-ink-muted/40"
            title="Not enabled yet"
          >
            {l}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-vellum text-ink">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-ink-border bg-ink px-3 py-5 text-vellum lg:flex">
        <div>
          <Link to="/" className="flex items-center gap-2.5 px-3 pb-6">
            <span className="size-2 rounded-full bg-signal animate-signal-pulse" aria-hidden />
            <span className="font-display text-sm font-semibold tracking-tight">Prime Layer</span>
          </Link>
          <NavList />
        </div>
        <div className="px-3">
          <p className="label-mono text-ink-muted/70">Workspace</p>
          <p className="mt-1 text-sm text-vellum">Halberd Supply Co.</p>
          <p className="text-xs text-ink-muted">3 supply records · Nigeria, Ghana</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-ink-border bg-ink px-4 py-3 text-vellum lg:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-signal" aria-hidden />
            <span className="font-display text-sm font-semibold">Prime Layer</span>
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>
        {open && (
          <div className="border-b border-ink-border bg-ink px-3 py-3 text-vellum lg:hidden">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
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
    <div className="border-b border-border bg-card px-5 py-8 sm:px-8">
      <p className="label-mono text-signal">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      {intro && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
      )}
      {children}
    </div>
  );
}
