import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EVIDENCE, OPPORTUNITIES, SUPPLY } from "@/lib/demo-data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/demand-graph")({
  head: () => ({
    meta: [
      { title: "Demand Graph — company change to emerging need" },
      {
        name: "description",
        content:
          "Inspect how a company's events lead to changing situations, probable needs, timing and confidence — with the evidence behind each edge.",
      },
      { property: "og:title", content: "Demand Graph" },
      {
        property: "og:description",
        content: "Movement, not static company data: events, needs, timing, confidence, evidence.",
      },
    ],
  }),
  component: DemandGraph;
});

type Selection =
  | { kind: "company" }
  | { kind: "event"; value: string }
  | { kind: "need"; value: string; confidence: number };

const COMPANIES = ["ABC Manufacturing", "Marlowe Bay Hotels", "Meridian Fintech"] as const;

const EVENT_MEANING: Record<string, string> = {
  "Opened new factory":
    "A new production site changes the company's energy, staffing and logistics baseline within a fixed construction timetable.",
  "Raised financing":
    "Capital availability converts intent into procurement, and the disclosure names where it is being spent.",
  "Manufacturing hiring ↑":
    "Hiring for line and plant roles indicates the facility is being commissioned, not merely planned.",
  "Energy reliability issues":
    "Publicly acknowledged grid problems establish an existing operational cost the company is motivated to remove.",
  "New 150-room property":
    "Room count sets a hard quantity for every in-room category once fit-out begins.",
  "Fit-out approaching":
    "Fit-out is the point at which display, HVAC and networking budgets are committed.",
  "Procurement beginning":
    "Tender preparation narrows the buying window to weeks rather than quarters.",
  "New CISO":
    "A new security owner reliably precedes a re-scoped security budget within two quarters.",
  "Security hiring":
    "Identity and risk platform roles indicate the intent to build or buy fraud infrastructure.",
  "Regulated-market expansion":
    "A new regulated market imposes controls the current stack was not scoped for.",
  "Fraud incident":
    "A disclosed incident converts a deferred security problem into a funded one.",
};

function DemandGraph() {
  const [company, setCompany] = useState<string>(COMPANIES[0]);
  const [sel, setSel] = useState<Selection>({ kind: "company" });

  const opps = OPPORTUNITIES.filter((o) => o.company === company);
  const primary = opps[0];
  const events = primary?.events ?? [];
  const needs = primary
    ? [
        { need: primary.need, confidence: primary.confidence },
        ...primary.otherNeeds,
      ]
    : [];
  const companyEvidence = EVIDENCE.filter((e) => e.company === company);

  function selectCompany(c: string) {
    setCompany(c);
    setSel({ kind: "company" });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Demand Graph"
        title="How a change becomes a probable purchase"
        intro="The graph records movement: an event changes a company's situation, the situation creates a problem, the problem implies a purchase category — each edge carrying timing, confidence and evidence."
      >
        <div className="mt-6 flex flex-wrap gap-2">
          {COMPANIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCompany(c)}
              aria-pressed={company === c}
              className={`rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                company === c
                  ? "border-signal text-signal"
                  : "border-border text-muted-foreground hover:border-signal hover:text-signal"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Graph" className="rounded-md border border-ink-border bg-ink p-6 text-vellum">
          <button
            type="button"
            onClick={() => setSel({ kind: "company" })}
            className="rounded-sm border border-ink-border px-4 py-2 text-left font-display text-lg transition-colors hover:border-signal hover:text-signal"
          >
            {company}
          </button>

          <div className="mt-4 border-l border-ink-border pl-6">
            <p className="label-mono text-ink-muted">Detected events</p>
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e}>
                  <button
                    type="button"
                    onClick={() => setSel({ kind: "event", value: e })}
                    className="w-full rounded-sm border border-ink-border px-3 py-2 text-left font-mono text-xs text-vellum transition-colors hover:border-signal hover:text-signal"
                  >
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-center label-mono text-ink-muted" aria-hidden>
            ▼ changing situation ▼
          </p>

          <div className="mt-4">
            <p className="label-mono text-ink-muted">Emerging needs</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {needs.map((n) => (
                <li key={n.need}>
                  <button
                    type="button"
                    onClick={() => setSel({ kind: "need", value: n.need, confidence: n.confidence })}
                    className="h-full w-full rounded-sm border border-ink-border p-3 text-left transition-colors hover:border-signal"
                  >
                    <span className="block text-sm text-vellum">{n.need}</span>
                    <span className="mt-2 block font-mono text-xl text-signal">{n.confidence}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside aria-live="polite" className="rounded-md border border-border bg-card p-5">
          {sel.kind === "company" && (
            <>
              <p className="label-mono text-muted-foreground">What changed in six months</p>
              <h2 className="mt-1 font-display text-lg">{company}</h2>
              <ol className="mt-4 space-y-3">
                {(primary?.timeline ?? []).map((t) => (
                  <li key={`${t.period}-${t.event}`} className="text-sm">
                    <span className="label-mono text-signal">{t.period}</span>
                    <p>{t.event}</p>
                  </li>
                ))}
              </ol>
            </>
          )}

          {sel.kind === "event" && (
            <>
              <p className="label-mono text-muted-foreground">Why this event matters</p>
              <h2 className="mt-1 font-display text-lg">{sel.value}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {EVENT_MEANING[sel.value] ??
                  "This event changes the company's operating situation in a way that creates downstream purchasing pressure."}
              </p>
              <p className="label-mono mt-5 text-muted-foreground">Supporting evidence</p>
              <ul className="mt-2 space-y-2 font-mono text-xs">
                {companyEvidence.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <span className="text-signal">{e.id}</span> {e.claim}
                  </li>
                ))}
              </ul>
            </>
          )}

          {sel.kind === "need" && (
            <>
              <p className="label-mono text-muted-foreground">Evidence supporting this need</p>
              <h2 className="mt-1 font-display text-lg">
                {sel.value} · <span className="font-mono text-signal">{sel.confidence}%</span>
              </h2>
              <ul className="mt-3 space-y-2 font-mono text-xs">
                {companyEvidence.map((e) => (
                  <li key={e.id}>
                    <span className="text-signal">{e.id}</span> {e.claim}
                  </li>
                ))}
              </ul>
              <p className="label-mono mt-5 text-muted-foreground">Matching supply on record</p>
              <ul className="mt-2 space-y-2 text-sm">
                {SUPPLY.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3">
                    <span>{s.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.highConfidence} high-conf
                    </span>
                  </li>
                ))}
              </ul>
              {primary && (
                <Link
                  to="/app/opportunities/$id"
                  params={{ id: primary.id }}
                  className="mt-5 inline-block label-mono text-signal hover:underline"
                >
                  Open dossier
                </Link>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
