import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EVIDENCE, statusLabel, statusText } from "@/lib/demo-data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence — the record behind every conclusion" },
      {
        name: "description",
        content:
          "Every claim Prime Layer holds, with its source, the agent that surfaced it, when it was observed and whether anything contradicts it.",
      },
      { property: "og:title", content: "Evidence — the record behind every conclusion" },
      {
        property: "og:description",
        content: "Clustered, attributed, contradiction-preserving evidence records.",
      },
    ],
  }),
  component: EvidencePage,
});

const COMPANIES = ["All companies", ...Array.from(new Set(EVIDENCE.map((e) => e.company)))];
const AGENTS = ["All agents", ...Array.from(new Set(EVIDENCE.map((e) => e.agent)))];
const STATUSES = ["All", "Verified", "Contradicted", "Tracking"] as const;

function EvidencePage() {
  const [company, setCompany] = useState(COMPANIES[0]!);
  const [agent, setAgent] = useState(AGENTS[0]!);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");

  const rows = EVIDENCE.filter(
    (e) =>
      (company === COMPANIES[0] || e.company === company) &&
      (agent === AGENTS[0] || e.agent === agent) &&
      (status === "All" || statusLabel[e.status] === status.toUpperCase()),
  );
  const sources = new Set(rows.map((r) => r.source)).size;

  return (
    <div>
      <PageHeader
        eyebrow="Evidence"
        title="The record behind every conclusion"
        intro="Duplicate citations are clustered, not counted twice. Disagreement is preserved rather than averaged away."
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <label className="label-mono text-muted-foreground">
            <span className="sr-only">Company</span>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="rounded-sm border border-input bg-background px-3 py-1.5 font-mono text-xs"
            >
              {COMPANIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="label-mono text-muted-foreground">
            <span className="sr-only">Agent</span>
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="rounded-sm border border-input bg-background px-3 py-1.5 font-mono text-xs"
            >
              {AGENTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                  status === s
                    ? "border-signal text-signal"
                    : "border-border text-muted-foreground hover:border-signal hover:text-signal"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="px-5 py-8 sm:px-8">
        <p className="label-mono text-muted-foreground">
          {rows.length} evidence items · {sources} independent sources after clustering
        </p>
        <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-card">
          {rows.map((e) => (
            <li key={e.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <span className="label-mono text-signal">{e.id}</span>
                <span className={`label-mono ${statusText[e.status]}`}>{statusLabel[e.status]}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{e.company}</p>
              <p className="text-sm text-muted-foreground">{e.claim}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="inline text-foreground">SOURCE </dt>
                  <dd className="inline">{e.source}</dd>
                </div>
                <div>
                  <dt className="inline text-foreground">TYPE </dt>
                  <dd className="inline">{e.sourceType}</dd>
                </div>
                <div>
                  <dt className="inline text-foreground">SURFACED BY </dt>
                  <dd className="inline">{e.agent}</dd>
                </div>
                <div>
                  <dt className="inline text-foreground">OBSERVED </dt>
                  <dd className="inline">{e.observed}</dd>
                </div>
              </dl>
              {e.note && (
                <p
                  className={`mt-2 font-mono text-xs ${
                    e.status === "flagged" ? "text-flag" : "text-muted-foreground"
                  }`}
                >
                  {e.note}
                </p>
              )}
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="mt-6 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No evidence matches these filters.
          </p>
        )}
      </div>
    </div>
  );
}
