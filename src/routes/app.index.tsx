import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { OPPORTUNITIES, SUPPLY, statusText } from "@/lib/demo-data";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Overview — Prime Layer workspace" },
      {
        name: "description",
        content:
          "What moved in your markets: new demand opportunities, confidence movements and fresh evidence clusters.",
      },
      { property: "og:title", content: "Overview — Prime Layer workspace" },
      {
        property: "og:description",
        content: "Continuous understanding of demand forming around your business.",
      },
    ],
  }),
  component: Overview,
});

const counters = [
  { value: "7", label: "new demand opportunities" },
  { value: "3", label: "watchlist changes" },
  { value: "2", label: "high-confidence movements" },
  { value: "18", label: "new evidence clusters" },
  { value: "4", label: "agents contributed" },
];

const watched = [
  { name: "ABC Manufacturing", note: "3 new signals" },
  { name: "XYZ Logistics", note: "New warehouse expansion evidence" },
  { name: "Meridian Fintech", note: "Security demand confidence increased" },
];

function Overview() {
  const movements = OPPORTUNITIES.slice(0, 3);

  return (
    <div>
      <div className="border-b border-ink-border bg-ink px-5 py-8 text-vellum sm:px-8">
        <p className="label-mono text-signal">Since your last visit — 3 days</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-vellum sm:text-4xl">
          Demand is forming in four of your markets
        </h1>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {counters.map((c) => (
            <div key={c.label}>
              <dt className="font-mono text-3xl text-signal">{c.value}</dt>
              <dd className="mt-1 text-xs leading-snug text-ink-muted">{c.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="px-5 py-10 sm:px-8">
        <section aria-labelledby="movements">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="movements" className="font-display text-xl">
              Strongest movements
            </h2>
            <Link to="/app/opportunities" className="label-mono text-signal hover:underline">
              All opportunities
            </Link>
          </div>
          <ul className="mt-4 grid gap-4 lg:grid-cols-3">
            {movements.map((o) => (
              <li key={o.id} className="rounded-md border border-border bg-card p-5">
                <Link
                  to="/app/opportunities/$id"
                  params={{ id: o.id }}
                  className="group block"
                >
                  <p className="label-mono text-muted-foreground">{o.industry}</p>
                  <h3 className="mt-1 font-display text-lg group-hover:text-signal">{o.company}</h3>
                  <p className="mt-3 label-mono text-muted-foreground">Likely need</p>
                  <p className="text-sm">{o.need}</p>
                  <div className="mt-4 flex items-baseline gap-3">
                    <span className={`font-mono text-3xl ${statusText[o.status]}`}>
                      {o.confidence}%
                    </span>
                    <span className="label-mono text-verified">
                      {o.delta >= 0 ? `↑ ${o.delta} pts` : `↓ ${Math.abs(o.delta)} pts`}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    WINDOW {o.window.toUpperCase()} · {o.evidenceIds.length} EVIDENCE ITEMS
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="supply" className="rounded-md border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="supply" className="font-display text-xl">
                Your supply
              </h2>
              <Link to="/app/supply" className="label-mono text-signal hover:underline">
                Manage
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {SUPPLY.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {s.detail.map((d) => `${d.label.toUpperCase()} ${d.value}`).join(" · ")}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    <span className="text-signal">{s.matches}</span> matches ·{" "}
                    <span className="text-verified">{s.highConfidence}</span> high confidence
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="watched" className="rounded-md border border-border bg-card p-5">
            <h2 id="watched" className="font-display text-xl">
              Watched companies and categories
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {watched.map((w) => (
                <li key={w.name} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="text-sm font-medium">{w.name}</span>
                  <span className="text-sm text-muted-foreground">{w.note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Continuous monitoring is opt-in per company. Everything else is retrieved on demand.
            </p>
          </section>
        </div>

        <Link
          to="/app/intelligence"
          className="mt-10 inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-vellum transition-opacity hover:opacity-90"
        >
          Ask Prime Layer something <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
