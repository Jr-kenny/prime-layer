import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { OPPORTUNITIES, statusLabel, statusText } from "@/lib/demo-data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/intelligence")({
  head: () => ({
    meta: [
      { title: "Intelligence — ask Prime Layer" },
      {
        name: "description",
        content:
          "Ask a demand question in plain language. Prime Layer checks the Demand Graph, dispatches only the agents it needs, clusters evidence and ranks opportunities.",
      },
      { property: "og:title", content: "Intelligence — ask Prime Layer" },
      {
        property: "og:description",
        content: "Natural language in. Structured, evidence-backed demand intelligence out.",
      },
    ],
  }),
  component: Intelligence,
});

type Step = { label: string; lines: string[] };

const STEPS: Step[] = [
  {
    label: "Understanding request",
    lines: ["Commercial solar", "Nigeria", "Manufacturing", "₦30m–₦500m contract profile"],
  },
  {
    label: "Checking demand graph",
    lines: ["412 relevant company nodes", "83 recent expansion events", "61 reusable evidence items"],
  },
  {
    label: "Dispatching intelligence",
    lines: [
      "Manufacturing Intelligence",
      "Energy Intelligence",
      "Nigeria Construction Agent",
      "Corporate Expansion",
    ],
  },
  {
    label: "Results received",
    lines: [
      "14 claims",
      "31 evidence items",
      "23 independent sources",
      "4 duplicate clusters collapsed",
      "2 contradictions preserved",
    ],
  },
  { label: "Ranking opportunities", lines: ["3 opportunities above confidence floor"] },
];

const EXAMPLES = [
  "I have 5,000 TVs to sell in Nigeria. Find companies becoming likely to need them.",
  "Find African fintechs showing evidence that fraud-prevention spending may increase.",
  "Which German companies appear likely to expand warehouse capacity?",
  "Find companies showing signs they may need senior Rust engineers.",
];

function Intelligence() {
  const [query, setQuery] = useState(
    "I sell commercial solar systems worth ₦30m–₦500m. Find Nigerian manufacturers becoming likely to need them.",
  );
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function run(e: React.FormEvent) {
    e.preventDefault();
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPhase("running");
    setStep(0);
    STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStep(i + 1), 450 * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => setPhase("done"), 450 * (STEPS.length + 1)),
    );
  }

  const results = OPPORTUNITIES.slice(0, 3);

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="What are you trying to find?"
        intro="Describe the demand you want to discover, or the supply you need to move. Prime Layer turns it into structure underneath — no query form required."
      >
        <form onSubmit={run} className="mt-6 max-w-3xl">
          <label htmlFor="intent" className="sr-only">
            Your intelligence request
          </label>
          <textarea
            id="intent"
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-sm border border-input bg-background p-4 font-mono text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-vellum transition-opacity hover:opacity-90"
            >
              {phase === "running" ? "Running…" : "Run intelligence"}
            </button>
            <p className="font-mono text-xs text-muted-foreground">
              Existing evidence is reused before any agent is dispatched.
            </p>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              className="rounded-sm border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-signal hover:text-signal"
            >
              {ex}
            </button>
          ))}
        </div>
      </PageHeader>

      {phase !== "idle" && (
        <div className="grid gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <section aria-label="System operations" className="rounded-md border border-ink-border bg-ink p-5 text-vellum">
            <p className="label-mono text-ink-muted">System operations</p>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => {
                const active = step > i;
                return (
                  <li key={s.label} className={active ? "animate-ledger-in" : "opacity-30"}>
                    <p className="label-mono text-signal">{s.label}</p>
                    <ul className="mt-1.5 space-y-0.5 font-mono text-xs text-ink-muted">
                      {active && s.lines.map((l) => <li key={l}>{l}</li>)}
                    </ul>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 border-t border-ink-border pt-4 font-mono text-[0.6875rem] leading-relaxed text-ink-muted">
              4 agents contributed · 23 independent sources after clustering. Duplicate citations do
              not raise confidence.
            </p>
          </section>

          <section aria-label="Ranked opportunities">
            {phase === "done" ? (
              <>
                <p className="label-mono text-muted-foreground">
                  3 opportunities · ranked by confidence · evidence attached
                </p>
                <ul className="mt-4 space-y-4">
                  {results.map((o) => (
                    <li key={o.id} className="rounded-md border border-border bg-card p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                        <div>
                          <h2 className="font-display text-xl">{o.company}</h2>
                          <p className="label-mono mt-1 text-muted-foreground">
                            {o.location} · {o.industry}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono text-2xl ${statusText[o.status]}`}>
                            {o.confidence}%
                          </p>
                          <p className={`label-mono ${statusText[o.status]}`}>
                            {statusLabel[o.status]}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {o.summary}
                      </p>
                      <p className="mt-3 font-mono text-xs text-muted-foreground">
                        LIKELY NEED {o.need.toUpperCase()} · WINDOW {o.window.toUpperCase()} ·{" "}
                        {o.agents.length} AGENTS · {o.evidenceIds.length} EVIDENCE ITEMS
                      </p>
                      <Link
                        to="/app/opportunities/$id"
                        params={{ id: o.id }}
                        className="mt-4 inline-block rounded-sm border border-border px-3 py-1.5 text-xs transition-colors hover:border-signal hover:text-signal"
                      >
                        Open dossier
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                Retrieving and clustering evidence…
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
