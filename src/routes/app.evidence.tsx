import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, FileSearch, Layers3, Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { SectionHeading, StatusPill, type StatusTone } from "@/components/app/AppUI";
import { anchorToZeroG } from "@/lib/0g/anchor-server-fn";
import { EVIDENCE, statusLabel, type EvidenceItem } from "@/lib/demo-data";

export const Route = createFileRoute("/app/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence · Prime Layer workspace" },
      {
        name: "description",
        content:
          "Every claim Prime Layer holds, with its source, the agent that surfaced it, when it was observed and whether anything contradicts it.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EvidencePage,
});

const COMPANIES = ["All companies", ...Array.from(new Set(EVIDENCE.map((item) => item.company)))];
const AGENTS = ["All agents", ...Array.from(new Set(EVIDENCE.map((item) => item.agent)))];
const STATUSES = ["All", "Verified", "Contradicted", "Tracking"] as const;

function toneFor(status: "verified" | "flagged" | "open"): StatusTone {
  if (status === "flagged") return "flagged";
  if (status === "open") return "tracking";
  return "verified";
}

function EvidencePage() {
  const [company, setCompany] = useState(COMPANIES[0]!);
  const [agent, setAgent] = useState(AGENTS[0]!);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = EVIDENCE.filter(
    (item) =>
      (company === COMPANIES[0] || item.company === company) &&
      (agent === AGENTS[0] || item.agent === agent) &&
      (status === "All" || statusLabel[item.status] === status.toUpperCase()),
  );
  const sources = new Set(rows.map((item) => item.source)).size;
  const contradictions = rows.filter((item) => item.status === "flagged").length;

  return (
    <div>
      <PageHeader
        eyebrow="Evidence register"
        title="The record behind every conclusion"
        intro="Duplicate citations are clustered, not counted twice. Disagreement is preserved rather than averaged away. This is the paper trail beneath the opportunity register."
      >
        <div className="flex shrink-0 items-center gap-3 border-l border-border pl-5">
          <FileSearch className="size-4 text-signal" aria-hidden />
          <div>
            <p className="label-mono text-muted-foreground">Current view</p>
            <p className="mt-1 font-mono text-xs">
              {rows.length} records · {sources} sources
            </p>
          </div>
        </div>
      </PageHeader>

      <div className="app-content">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <section>
            <SectionHeading
              eyebrow="Trace every claim"
              title="Evidence ledger"
              action={
                <span className="label-mono text-muted-foreground">
                  {contradictions} contradiction visible
                </span>
              }
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <label className="min-w-44 flex-1">
                <span className="app-form-label">Company</span>
                <select
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  className="app-select mt-2"
                >
                  {COMPANIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-44 flex-1">
                <span className="app-form-label">Surfaced by</span>
                <select
                  value={agent}
                  onChange={(event) => setAgent(event.target.value)}
                  className="app-select mt-2"
                >
                  {AGENTS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="app-filter-row mt-4">
              {STATUSES.map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  data-active={status === statusOption}
                  aria-pressed={status === statusOption}
                  className="app-filter-button"
                  onClick={() => setStatus(statusOption)}
                >
                  {statusOption}
                </button>
              ))}
            </div>

            <div className="surface mt-5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
                <p className="font-mono text-[0.65rem] text-muted-foreground">
                  {rows.length} evidence items in view
                </p>
                <p className="font-mono text-[0.65rem] text-signal">
                  {sources} independent sources after clustering
                </p>
              </div>
              {rows.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  No evidence matches these filters.
                </p>
              ) : (
                <ul>
                  {rows.map((item) => {
                    const isExpanded = expanded === item.id;
                    return (
                      <li key={item.id} className="border-b border-border last:border-b-0">
                        <button
                          type="button"
                          className="w-full p-4 text-left transition-colors hover:bg-signal/5 sm:p-5"
                          aria-expanded={isExpanded}
                          onClick={() => setExpanded(isExpanded ? null : item.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="label-mono text-signal">{item.id}</span>
                                <StatusPill
                                  tone={toneFor(item.status)}
                                  label={statusLabel[item.status]}
                                  compact
                                />
                              </div>
                              <p className="mt-3 font-display text-lg">{item.company}</p>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {item.claim}
                              </p>
                            </div>
                            <ChevronDown
                              className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              aria-hidden
                            />
                          </div>
                          <div className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-3 font-mono text-[0.64rem] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                            <span>
                              <b className="font-normal text-ink">SOURCE</b> {item.source}
                            </span>
                            <span>
                              <b className="font-normal text-ink">TYPE</b> {item.sourceType}
                            </span>
                            <span>
                              <b className="font-normal text-ink">AGENT</b> {item.agent}
                            </span>
                            <span>
                              <b className="font-normal text-ink">OBSERVED</b> {item.observed}
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="mt-4 border-t border-border pt-4">
                              <p className="label-mono text-muted-foreground">
                                Cluster interpretation
                              </p>
                              <p className="mt-2 max-w-2xl text-sm leading-relaxed">
                                This record contributes one underlying source to the confidence
                                calculation. Other agents may have surfaced the same source without
                                increasing the independent-source count.
                              </p>
                              {item.note && (
                                <p
                                  className={`mt-3 font-mono text-xs ${item.status === "flagged" ? "text-flag" : "text-muted-foreground"}`}
                                >
                                  {item.note}
                                </p>
                              )}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <aside className="space-y-8">
            <section className="surface-dark p-5 sm:p-6" aria-labelledby="cluster-rule">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-mono text-signal">Scoring boundary</p>
                  <h2 className="mt-2 font-display text-2xl text-vellum">
                    Repetition is not corroboration.
                  </h2>
                </div>
                <Layers3 className="size-5 text-signal" aria-hidden />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Five agents citing one article produce one source cluster. A separate permit, filing
                or hiring signal can add independence. The interface reports both counts so the
                difference is visible.
              </p>
              <div className="mt-6 border-t border-ink-border pt-5">
                <p className="label-mono text-ink-muted">Current register</p>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="font-mono text-xs text-ink-muted">AGENT REPORTS</dt>
                    <dd className="mt-1 font-mono text-2xl text-vellum">{rows.length}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs text-ink-muted">SOURCE CLUSTERS</dt>
                    <dd className="mt-1 font-mono text-2xl text-signal">{sources}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="surface p-5 sm:p-6">
              <SectionHeading eyebrow="Chain anchor" title="Pin a record to 0G Storage" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Anchoring writes the exact record bytes to 0G and returns its merkle root: the
                content identifier anyone can later verify against. Settlement-grade records are
                anchored automatically; this control pins one manually.
              </p>
              <AnchorPanel record={rows[0]} />
            </section>

            <section className="surface p-5 sm:p-6">
              <SectionHeading
                eyebrow="What the evidence can say"
                title="Useful records have a shape"
              />
              <ul className="mt-5 space-y-3 text-sm leading-relaxed">
                <li className="border-t border-border pt-3">
                  <span className="font-medium">Claim</span> · what changed or was observed.
                </li>
                <li className="border-t border-border pt-3">
                  <span className="font-medium">Source</span> · where the observation came from.
                </li>
                <li className="border-t border-border pt-3">
                  <span className="font-medium">Agent</span> · which contributor surfaced it.
                </li>
                <li className="border-t border-border pt-3">
                  <span className="font-medium">Status</span> · verified, tracking or contradicted.
                </li>
              </ul>
              <div className="mt-6 flex items-start gap-3 border-t border-border pt-4">
                <ShieldCheck className="size-4 shrink-0 text-verified" aria-hidden />
                <p className="font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
                  Confidence is never asserted without a source behind it.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

type AnchorState =
  | { phase: "idle" }
  | { phase: "anchoring" }
  | {
      phase: "done";
      mode: "live" | "sandbox";
      rootHash: string;
      txHash?: string;
      explorerUrl?: string;
      recordId: string;
    }
  | { phase: "error"; message: string };

function AnchorPanel({ record }: { record: EvidenceItem | undefined }) {
  const [state, setState] = useState<AnchorState>({ phase: "idle" });

  async function anchor() {
    if (!record) return;
    setState({ phase: "anchoring" });
    try {
      const result = await anchorToZeroG({
        data: {
          kind: "evidence",
          id: record.id,
          agent: record.agent,
          claim: `${record.company}: ${record.claim}`,
          observedAt: record.observed,
        },
      });
      setState({
        phase: "done",
        mode: result.mode,
        rootHash: result.rootHash,
        ...(result.txHash ? { txHash: result.txHash } : {}),
        ...(result.explorerUrl ? { explorerUrl: result.explorerUrl } : {}),
        recordId: record.id,
      });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Anchoring failed.",
      });
    }
  }

  if (!record) {
    return (
      <p className="mt-4 font-mono text-[0.65rem] text-muted-foreground">
        No record in the current view to anchor.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={anchor}
        disabled={state.phase === "anchoring"}
        className="app-signal-button disabled:opacity-60"
      >
        {state.phase === "anchoring" ? (
          "Anchoring…"
        ) : (
          <>
            Anchor <span className="font-mono text-[0.7em]">{record.id}</span> to 0G
            <Link2 className="size-3.5" aria-hidden />
          </>
        )}
      </button>

      {state.phase === "anchoring" && (
        <p className="mt-3 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Writing record bytes and
          computing merkle root…
        </p>
      )}

      {state.phase === "done" && (
        <div className="mt-4 border-l-2 border-signal pl-4">
          <p className="label-mono text-signal">
            {state.mode === "live"
              ? `Anchored · ${state.recordId}`
              : `Sandbox anchor · ${state.recordId}`}
          </p>
          <p className="mt-2 break-all font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
            ROOT {state.rootHash}
          </p>
          {state.txHash && (
            <p className="mt-1 break-all font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
              TX {state.txHash}
            </p>
          )}
          {state.mode === "sandbox" && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Sandbox mode: deterministic local hash of the exact upload bytes. Add{" "}
              <code className="font-mono">ZERO_G_PRIVATE_KEY</code> to write to the network for
              real.
            </p>
          )}
          {state.explorerUrl && (
            <a
              href={state.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.65rem] text-signal hover:text-ink"
            >
              View on explorer <Link2 className="size-3" aria-hidden />
            </a>
          )}
        </div>
      )}

      {state.phase === "error" && (
        <p className="mt-4 border-l-2 border-flag pl-4 font-mono text-[0.65rem] leading-relaxed text-flag">
          {state.message}
        </p>
      )}
    </div>
  );
}
