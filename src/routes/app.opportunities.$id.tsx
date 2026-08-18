import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { evidenceById, opportunityById, statusLabel, statusText } from "@/lib/demo-data";

export const Route = createFileRoute("/app/opportunities/$id")({
  loader: ({ params }) => {
    const opportunity = opportunityById(params.id);
    if (!opportunity) throw notFound();
    return { opportunity };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Opportunity unavailable" }, { name: "robots", content: "noindex" }],
      };
    }
    const o = loaderData.opportunity;
    const title = `${o.company} — ${o.need} · ${o.confidence}% confidence`;
    return {
      meta: [
        { title },
        { name: "description", content: o.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: o.summary },
      ],
    };
  },
  notFoundComponent: OpportunityNotFound,
  component: OpportunityDetail,
});

function OpportunityNotFound() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <h1 className="font-display text-2xl">This opportunity is no longer tracked</h1>
      <Link to="/app/opportunities" className="mt-4 inline-block text-sm text-signal hover:underline">
        Back to opportunities
      </Link>
    </div>
  );
}

function OpportunityDetail() {
  const { opportunity: o } = Route.useLoaderData();
  const evidence = o.evidenceIds.map(evidenceById).filter(Boolean);
  const independentSources = new Set(evidence.map((e) => e!.source)).size;

  return (
    <div>
      <header className="border-b border-ink-border bg-ink px-5 py-8 text-vellum sm:px-8">
        <Link
          to="/app/opportunities"
          className="inline-flex items-center gap-1.5 label-mono text-ink-muted hover:text-signal"
        >
          <ArrowLeft className="size-3.5" /> Opportunities
        </Link>
        <p className="label-mono mt-6 text-signal">Intelligence dossier</p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-tight sm:text-4xl">
          {o.company}
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-muted">
          {o.location.toUpperCase()} · {o.industry.toUpperCase()}
        </p>

        <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="label-mono text-ink-muted">Likely need</dt>
            <dd className="mt-1 text-base text-vellum">{o.need}</dd>
          </div>
          <div>
            <dt className="label-mono text-ink-muted">Confidence</dt>
            <dd className={`mt-1 font-mono text-3xl ${statusText[o.status]}`}>{o.confidence}%</dd>
          </div>
          <div>
            <dt className="label-mono text-ink-muted">Estimated buying window</dt>
            <dd className="mt-1 text-base text-vellum">{o.window}</dd>
          </div>
          <div>
            <dt className="label-mono text-ink-muted">Estimated opportunity</dt>
            <dd className="mt-1 text-base text-vellum">{o.size}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="why">
            <h2 id="why" className="font-display text-xl">
              Why Prime believes this
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {o.summary}
            </p>
            <ol className="mt-5 space-y-2">
              {o.reasons.map((r, i) => (
                <li key={r} className="flex gap-4 border-t border-border pt-2 text-sm">
                  <span className="font-mono text-xs text-signal">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="evidence">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="evidence" className="font-display text-xl">
                Evidence
              </h2>
              <p className="label-mono text-muted-foreground">
                {o.agents.length} agents · {independentSources} independent sources
              </p>
            </div>
            <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-card">
              {evidence.map((e) => (
                <li key={e!.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="label-mono text-signal">{e!.id}</span>
                    <span className={`label-mono ${statusText[e!.status]}`}>
                      {statusLabel[e!.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{e!.claim}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {e!.source} · {e!.sourceType} · surfaced by {e!.agent} · observed {e!.observed}
                  </p>
                  {e!.note && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{e!.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {o.contradiction && (
            <section aria-labelledby="contradiction">
              <h2 id="contradiction" className="font-display text-xl">
                Contradictions
              </h2>
              <p className="mt-3 rounded-md border-l-2 border-flag bg-card p-4 text-sm leading-relaxed">
                {o.contradiction}
              </p>
            </section>
          )}

          <section aria-labelledby="timeline">
            <h2 id="timeline" className="font-display text-xl">
              Timeline
            </h2>
            <ol className="mt-4 border-l border-border pl-5">
              {o.timeline.map((t) => (
                <li key={`${t.period}-${t.event}`} className="relative pb-5 last:pb-0">
                  <span
                    className="absolute -left-[1.4rem] top-1.5 size-1.5 rounded-full bg-signal"
                    aria-hidden
                  />
                  <p className="label-mono text-muted-foreground">{t.period}</p>
                  <p className="text-sm">{t.event}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="label-mono text-muted-foreground">Contributing agents</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {o.agents.map((a) => (
                <li key={a} className="flex items-baseline gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
              Agents return claims and evidence. Prime Layer clusters, resolves and scores. Agents
              never answer the customer directly.
            </p>
          </section>

          {o.otherNeeds.length > 0 && (
            <section className="rounded-md border border-border bg-card p-5">
              <h2 className="label-mono text-muted-foreground">Other emerging needs</h2>
              <ul className="mt-3 space-y-2">
                {o.otherNeeds.map((n) => (
                  <li key={n.need} className="flex items-baseline justify-between gap-4 text-sm">
                    <span>{n.need}</span>
                    <span className="font-mono text-signal">{n.confidence}%</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/app/demand-graph"
                className="mt-4 inline-block label-mono text-signal hover:underline"
              >
                Open in Demand Graph
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
