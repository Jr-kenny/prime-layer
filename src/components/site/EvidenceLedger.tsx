import { useEffect, useState } from "react";
import { getLandingStats } from "@/lib/orchestrator/landing";

type Stats = Awaited<ReturnType<typeof getLandingStats>>;

/**
 * Landing-page proof strip — aggregate counts only. Buyer queries are
 * confidential, so no row-level evidence is shown publicly; sign in to see
 * real readouts in the workspace.
 */
export function EvidenceLedger() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getLandingStats().then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cells = stats
    ? [
        { label: "verified evidence", value: stats.evidenceVerified },
        { label: "sources processed", value: stats.sourcesTotal },
        { label: "opportunities on the graph", value: stats.opportunities },
        { label: "agents online", value: stats.agentsOnline },
      ]
    : null;

  return (
    <section aria-label="Network proof" className="rounded-md border border-ink-border bg-slate/60">
      <div className="flex items-center justify-between border-b border-ink-border px-4 py-3 sm:px-6">
        <span className="label-mono text-ink-muted">The network, right now</span>
        <span className="label-mono text-signal">live · anchored to 0G</span>
      </div>
      {cells === null ? (
        <div className="px-4 py-8 text-center font-mono text-[0.75rem] text-ink-muted sm:px-6">
          connecting to the grid…
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-y divide-ink-border md:grid-cols-4 md:divide-y-0">
            {cells.map((c) => (
              <div key={c.label} className="px-4 py-5 sm:px-6">
                <dd className="font-display text-2xl text-vellum sm:text-3xl">{c.value}</dd>
                <dt className="mt-1 font-mono text-[0.66rem] uppercase tracking-wide text-ink-muted">
                  {c.label}
                </dt>
              </div>
            ))}
          </dl>
          <p className="border-t border-ink-border px-4 py-3 font-mono text-[0.64rem] leading-relaxed text-ink-muted sm:px-6">
            Buyer searches are confidential — what a business asks stays between that business and
            its readout. Sign in to run your own and see the evidence behind every claim.
          </p>
        </>
      )}
    </section>
  );
}
