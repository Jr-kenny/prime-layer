import { useEffect, useState } from "react";
import { getLandingStats } from "@/lib/orchestrator/landing";

type Entry = {
  company: string;
  claim: string;
  source: string;
  confidence: number | null;
  observed: string;
};

const statusFor = (c: number | null) =>
  c === null ? "TRACKING" : c >= 70 ? "VERIFIED" : c >= 50 ? "TRACKING" : "WEAK";
const classFor = (c: number | null) =>
  c === null ? "text-signal" : c >= 70 ? "text-verified" : c >= 50 ? "text-signal" : "text-flag";

function Row({ entry, id }: { entry: Entry; id: number }) {
  return (
    <li className="animate-ledger-in border-t border-ink-border px-4 py-4 first:border-t-0 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="label-mono text-ink-muted">EV-{String(id + 1).padStart(4, "0")}</span>
        <span className={`label-mono ${classFor(entry.confidence)}`}>
          {statusFor(entry.confidence)}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 font-mono text-[0.8125rem] leading-relaxed">
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-signal">COMPANY</dt>
          <dd className="text-vellum">{entry.company}</dd>
        </div>
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-ink-muted">SIGNAL</dt>
          <dd className="text-vellum">{entry.claim}</dd>
        </div>
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-ink-muted">SOURCE</dt>
          <dd className="truncate text-ink-muted" title={entry.source}>
            {entry.source}
          </dd>
        </div>
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-ink-muted">CONFIDENCE</dt>
          <dd className={classFor(entry.confidence)}>
            {entry.confidence !== null ? `${entry.confidence}%` : "pending grade"}
          </dd>
        </div>
      </dl>
    </li>
  );
}

/** Live evidence ledger — real records from the grid, no demo entries. */
export function EvidenceLedger() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLandingStats>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getLandingStats().then((s) => {
      if (cancelled) return;
      setStats(s);
      setEntries(s.recent);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="Evidence ledger"
      className="rounded-md border border-ink-border bg-slate/60"
    >
      <div className="flex items-center justify-between border-b border-ink-border px-4 py-3 sm:px-6">
        <span className="label-mono text-ink-muted">Latest evidence · live from the grid</span>
        {stats && (
          <span className="label-mono text-signal">
            {stats.evidenceVerified} verified · {stats.agentsOnline} agent
            {stats.agentsOnline === 1 ? "" : "s"} online
          </span>
        )}
      </div>
      {entries === null ? (
        <ul>
          <li className="px-4 py-6 text-center font-mono text-[0.75rem] text-ink-muted sm:px-6">
            connecting to the grid…
          </li>
        </ul>
      ) : entries.length === 0 ? (
        <ul>
          <li className="px-4 py-6 text-center font-mono text-[0.75rem] leading-relaxed text-ink-muted sm:px-6">
            The grid is young — no evidence yet.
            <br />
            Run the first intelligence request and this ledger fills with sourced signals.
          </li>
        </ul>
      ) : (
        <ul>
          {entries.slice(0, 3).map((e, i) => (
            <Row key={`${e.company}-${i}`} entry={e} id={i} />
          ))}
        </ul>
      )}
    </section>
  );
}
