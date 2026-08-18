import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { OPPORTUNITIES, statusLabel, statusText } from "@/lib/demo-data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/opportunities/")({
  head: () => ({
    meta: [
      { title: "Opportunities — detected demand" },
      {
        name: "description",
        content:
          "Every credible demand signal Prime Layer has detected, with confidence, buying window and evidence depth.",
      },
      { property: "og:title", content: "Opportunities — detected demand" },
      {
        property: "og:description",
        content: "Actionable demand intelligence, not a contact list.",
      },
    ],
  }),
  component: Opportunities,
});

const FILTERS = [
  "All",
  "High confidence",
  "New",
  "Watching",
  "Contradicted",
  "Expired",
  "Converted",
] as const;

type Filter = (typeof FILTERS)[number];

function match(o: (typeof OPPORTUNITIES)[number], f: Filter) {
  switch (f) {
    case "All":
      return true;
    case "High confidence":
      return o.confidence >= 80;
    case "Contradicted":
      return o.status === "flagged";
    case "New":
      return o.state === "new";
    case "Watching":
      return o.state === "watching";
    case "Expired":
      return o.state === "expired";
    case "Converted":
      return o.state === "converted";
  }
}

function Opportunities() {
  const [filter, setFilter] = useState<Filter>("All");
  const list = OPPORTUNITIES.filter((o) => match(o, filter));

  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title="Demand Prime Layer is currently tracking"
        intro="An opportunity means credible, clustered evidence that a company is forming a need — not that someone has asked to be sold to."
      >
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                filter === f
                  ? "border-signal text-signal"
                  : "border-border text-muted-foreground hover:border-signal hover:text-signal"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-5 py-8 sm:px-8">
        <p className="label-mono text-muted-foreground">
          {list.length} {list.length === 1 ? "opportunity" : "opportunities"}
        </p>
        {list.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing in this state yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((o) => (
              <li key={o.id}>
                <Link
                  to="/app/opportunities/$id"
                  params={{ id: o.id }}
                  className="group block rounded-md border border-border bg-card p-5 transition-colors hover:border-signal"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg group-hover:text-signal">{o.company}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{o.need}</p>
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {o.location.toUpperCase()} · {o.size.toUpperCase()} · BUYING WINDOW{" "}
                        {o.window.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-2xl ${statusText[o.status]}`}>{o.confidence}%</p>
                      <p className={`label-mono ${statusText[o.status]}`}>{statusLabel[o.status]}</p>
                      <p className="label-mono mt-1 text-muted-foreground">
                        {o.delta >= 0 ? `↑ ${o.delta}` : `↓ ${Math.abs(o.delta)}`} PTS · 30D
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
