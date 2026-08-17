import { useEffect, useState } from "react";

type Entry = {
  id: string;
  signal: string;
  evidence: string;
  confidence: number;
  need: string;
  status: "verified" | "flagged" | "open";
};

const ENTRIES: Entry[] = [
  {
    id: "EV-4471",
    signal: "Lagos, hotel permit filed, 150 rooms",
    evidence: "3 independent sources, clustered",
    confidence: 82,
    need: "televisions, HVAC, networking, within 45 days",
    status: "verified",
  },
  {
    id: "EV-4472",
    signal: "Abuja, restaurant group leases 4 new sites",
    evidence: "5 agents, 2 independent sources, clustered",
    confidence: 64,
    need: "commercial refrigeration, POS terminals, within 90 days",
    status: "open",
  },
  {
    id: "EV-4473",
    signal: "Accra, developer furnishing 88 serviced apartments",
    evidence: "4 independent sources, one contradicted",
    confidence: 47,
    need: "televisions, small appliances, timing unresolved",
    status: "flagged",
  },
  {
    id: "EV-4474",
    signal: "Port Harcourt, clinic expansion, 60 beds approved",
    evidence: "3 independent sources, clustered",
    confidence: 76,
    need: "displays, networking, backup power, within 60 days",
    status: "verified",
  },
];

const statusText: Record<Entry["status"], string> = {
  verified: "text-verified",
  flagged: "text-flag",
  open: "text-signal",
};

const statusLabel: Record<Entry["status"], string> = {
  verified: "VERIFIED",
  flagged: "CONTRADICTION",
  open: "TRACKING",
};

function Row({ entry }: { entry: Entry }) {
  return (
    <li className="animate-ledger-in border-t border-ink-border px-4 py-4 first:border-t-0 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="label-mono text-ink-muted">{entry.id}</span>
        <span className={`label-mono ${statusText[entry.status]}`}>{statusLabel[entry.status]}</span>
      </div>
      <dl className="mt-3 space-y-1.5 font-mono text-[0.8125rem] leading-relaxed">
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-signal">SIGNAL</dt>
          <dd className="text-vellum">{entry.signal}</dd>
        </div>
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-ink-muted">EVIDENCE</dt>
          <dd className="text-ink-muted">{entry.evidence}</dd>
        </div>
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-ink-muted">CONFIDENCE</dt>
          <dd className={statusText[entry.status]}>{entry.confidence}%</dd>
        </div>
        <div className="flex flex-col gap-x-4 sm:flex-row">
          <dt className="w-32 shrink-0 text-ink-muted">LIKELY NEED</dt>
          <dd className="text-vellum">{entry.need}</dd>
        </div>
      </dl>
    </li>
  );
}

export function EvidenceLedger() {
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setLive(true);
    const cadence = window.innerWidth < 640 ? 7000 : 4500;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % ENTRIES.length), cadence);
    return () => window.clearInterval(t);
  }, []);

  const visible = live
    ? [ENTRIES[index], ENTRIES[(index + 1) % ENTRIES.length], ENTRIES[(index + 2) % ENTRIES.length]]
    : ENTRIES.slice(0, 3);

  return (
    <section
      aria-label="Evidence ledger"
      className="rounded-md border border-ink-border bg-slate/60"
    >
      <div className="flex items-center justify-between border-b border-ink-border px-4 py-3 sm:px-6">
        <span className="label-mono text-ink-muted">Evidence ledger — live</span>
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-signal animate-signal-pulse" aria-hidden />
          <span className="label-mono text-signal">streaming</span>
        </span>
      </div>
      <ul aria-live="polite">
        {visible.map((e, i) => (
          <Row key={`${e.id}-${i}-${index}`} entry={e} />
        ))}
      </ul>
    </section>
  );
}
