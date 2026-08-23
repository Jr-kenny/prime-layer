import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Database, Layers3, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading, StatusPill } from "@/components/app/AppUI";
import { RequireAuth } from "@/components/app/auth-gate";
import {
  getInquiry,
  listLiveAgents,
  listSupplyRecords,
  submitInquiry,
} from "@/lib/orchestrator/fns";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Intelligence · Prime Layer" },
      {
        name: "description",
        content:
          "Ask a demand question in plain language. Prime Layer dispatches the connected agent layer, clusters evidence and ranks what is forming.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Intelligence,
});

type InquiryState = NonNullable<Awaited<ReturnType<typeof getInquiry>>>;

type ReadoutEntry = {
  company: string;
  confidence: number;
  claims: number;
  independentSources: number;
  topClaim: string;
  contributingAgents: string[];
};

const EXAMPLES = [
  "I have 5,000 TVs to sell in Nigeria. Find companies becoming likely to need them.",
  "Find African fintechs showing evidence that fraud-prevention spending may increase.",
  "Which German companies appear likely to expand warehouse capacity?",
];

function Intelligence() {
  const [query, setQuery] = useState(
    "I sell commercial solar systems worth $20k–$330k. Find Nigerian manufacturers becoming likely to need them.",
  );
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [inquiry, setInquiry] = useState<InquiryState | null>(null);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof listLiveAgents>>>([]);
  const [supply, setSupply] = useState<Awaited<ReturnType<typeof listSupplyRecords>>>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    void listLiveAgents().then(setAgents);
    void listSupplyRecords().then(setSupply);
  }, []);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const poll = useCallback((inquiryId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const state = await getInquiry({ data: inquiryId });
      if (!state) return;
      setInquiry(state);
      if (state.status === "complete") {
        window.clearInterval(pollRef.current!);
        setPhase("done");
      }
      if (state.status === "failed") {
        window.clearInterval(pollRef.current!);
        setPhase("failed");
      }
    }, 2000);
  }, []);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const { inquiryId } = await submitInquiry({ data: { question: query } });
    setSubmitting(false);
    setPhase("running");
    poll(inquiryId);
  }

  const steps = buildSteps(inquiry, agents.length);
  const readout = (inquiry?.readout as ReadoutEntry[] | null) ?? [];

  return (
    <div>
      <section className="app-overview-hero">
        <div className="app-overview-hero-inner">
          <p className="app-overview-kicker label-mono">
            <span className="app-sync-dot" aria-hidden />
            Intelligence command · {agents.length} agents on the grid
          </p>
          <h1>What are you trying to find?</h1>
          <p className="app-overview-hero-intro">
            Tell us what you need to move. We put your question to a network of independent research
            agents, separate the real signals from the noise, and come back with companies worth
            your attention, plus the evidence behind every name.
          </p>

          <RequireAuth>
            <form onSubmit={run} className="app-query-box mt-9">
              <label htmlFor="intent" className="label-mono text-ink-muted">
                Natural-language request
              </label>
              <textarea
                id="intent"
                rows={4}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="mt-3 w-full"
              />
              <div className="app-query-meta">
                <p>Give us a moment. We're checking with agents across the grid.</p>
                <button
                  type="submit"
                  className="app-signal-button shrink-0"
                  disabled={submitting || phase === "running"}
                >
                  {phase === "running" ? "Running readout" : "Run intelligence"}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </button>
              </div>
            </form>
          </RequireAuth>

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="app-filter-button text-left normal-case tracking-normal"
              >
                {example}
              </button>
            ))}
          </div>

          <dl className="app-kpi-strip mt-10">
            <div className="app-kpi">
              <dt className="app-kpi-value">{agents.length}</dt>
              <dd className="app-kpi-label">agents on the grid</dd>
            </div>
            <div className="app-kpi">
              <dt className="app-kpi-value">{supply.length}</dt>
              <dd className="app-kpi-label">supply records on file</dd>
            </div>
            <div className="app-kpi">
              <dt className="app-kpi-value">{inquiry?.sourcesClustered ?? 0}</dt>
              <dd className="app-kpi-label">sources clustered this run</dd>
            </div>
            <div className="app-kpi">
              <dt className="app-kpi-value">{inquiry?.claimsReceived ?? 0}</dt>
              <dd className="app-kpi-label">claims this run</dd>
            </div>
          </dl>
        </div>
      </section>

      {phase === "idle" && (
        <div className="app-content">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.56fr)]">
            <section className="surface p-5 sm:p-7" aria-labelledby="request-shape">
              <SectionHeading
                eyebrow="How the request is handled"
                title="Natural language in. Structured intelligence underneath."
              />
              <div className="mt-7 grid gap-5 sm:grid-cols-3">
                <div className="border-t-2 border-signal pt-3">
                  <p className="label-mono text-signal">01 · Intent</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Prime Layer reads the category, geography and business question.
                  </p>
                </div>
                <div className="border-t-2 border-signal pt-3">
                  <p className="label-mono text-signal">02 · Dispatch</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Every matching agent on the grid receives the same research command at once.
                  </p>
                </div>
                <div className="border-t-2 border-signal pt-3">
                  <p className="label-mono text-signal">03 · Readout</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Claims are graded after clustering. The answer returns with its evidence.
                  </p>
                </div>
              </div>
              <div className="mt-8 border-t border-border pt-5">
                <p className="label-mono text-muted-foreground">How your request is handled</p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed">
                  You never talk to the agents directly. They bring us what they find, we sort out
                  the overlaps, keep any disagreements visible, and hand you one clear answer with
                  its receipts.
                </p>
              </div>
            </section>

            <aside className="surface-dark p-5 sm:p-6" aria-labelledby="dispatch-model">
              <SectionHeading
                dark
                eyebrow="On-demand dispatch"
                title="Use the right intelligence for the missing question"
                action={<Bot className="size-5 text-signal" aria-hidden />}
              />
              <div className="mt-7 space-y-5">
                <div className="flex gap-3">
                  <Database className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                  <p className="text-sm leading-relaxed text-ink-muted">
                    Agents work only when dispatched. Five minutes to source, then submit.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Layers3 className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                  <p className="text-sm leading-relaxed text-ink-muted">
                    Duplicate citations collapse into one source. Independence is what earns.
                  </p>
                </div>
                <div className="flex gap-3">
                  <ScanLine className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                  <p className="text-sm leading-relaxed text-ink-muted">
                    The output is a case file, not a model transcript or a contact list.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {phase !== "idle" && (
        <div className="app-content">
          <div className="grid gap-8 xl:grid-cols-[minmax(18rem,0.6fr)_minmax(0,1.4fr)]">
            <section className="surface-dark p-5 sm:p-6" aria-label="System operations">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-mono text-signal">System operations</p>
                  <h2 className="mt-2 font-display text-2xl text-vellum">The readout in motion</h2>
                </div>
                <span className="app-sync-dot mt-1" aria-hidden />
              </div>
              <ol className="mt-7">
                {steps.map((step, index) => {
                  const state =
                    step.state === "done" ? "done" : step.state === "active" ? "active" : "idle";
                  const isCurrent = steps.findIndex((s) => s.state === "active") === index;
                  return (
                    <li key={step.label} className="app-system-step" data-state={state}>
                      <p className="app-system-step-label">{step.label}</p>
                      <ul className="app-system-step-lines">
                        {(state !== "idle" || isCurrent) &&
                          step.lines.map((line) => <li key={line}>{line}</li>)}
                      </ul>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-7 border-t border-ink-border pt-4 font-mono text-[0.66rem] leading-relaxed text-ink-muted">
                Duplicate citations do not raise confidence. Contradictions remain attached to the
                case they affect.
              </p>
            </section>

            <section aria-label="Ranked results">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="mt-2 font-display text-2xl">What came back</h2>
                </div>
                {phase === "done" && <StatusPill tone="verified" label="Evidence attached" />}
                {phase === "failed" && <StatusPill tone="flagged" label="Run failed" />}
              </div>

              {phase === "done" && readout.length > 0 ? (
                <div className="surface mt-5 overflow-hidden">
                  {readout.map((entry, index) => (
                    <div key={entry.company} className="app-list-row">
                      <div className="flex min-w-0 gap-3">
                        <span className="app-list-index">0{index + 1}</span>
                        <div className="min-w-0">
                          <p className="app-list-title">{entry.company}</p>
                          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                            {entry.topClaim}
                          </p>
                        </div>
                      </div>
                      <div className="app-list-meta">
                        <p>CLAIMS</p>
                        <p className="mt-1 text-ink">{entry.claims}</p>
                        <p className="mt-3">SOURCES</p>
                        <p className="mt-1 text-ink">{entry.independentSources} independent</p>
                      </div>
                      <div className="app-confidence">
                        <span
                          className={`app-confidence-value ${entry.confidence >= 80 ? "app-tone-verified" : "app-tone-tracking"}`}
                        >
                          {entry.confidence}%
                        </span>
                      </div>
                      <span className="app-list-action">
                        {entry.contributingAgents.length} agents
                      </span>
                    </div>
                  ))}
                </div>
              ) : phase === "done" ? (
                <div className="surface mt-5 p-8 text-center">
                  <p className="font-display text-xl">Nothing came back this time.</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    We asked everyone on the grid and, honestly, no one had anything solid for you.
                    That usually means there just isn't demand forming right now, not that something
                    broke. Try a different question, or check back soon. The moment something moves,
                    it'll show up here.
                  </p>
                </div>
              ) : (
                <div className="surface mt-5 flex min-h-72 items-center justify-center p-8 text-center">
                  <p className="max-w-sm font-mono text-xs leading-relaxed text-muted-foreground">
                    {phase === "failed"
                      ? (inquiry?.error ?? "Something went wrong on our end.")
                      : "We're on it. Agents are out checking their sources right now. This can take up to five minutes, and we'll bring everything back the moment it's ready."}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

type LiveStep = { label: string; lines: string[]; state: "idle" | "active" | "done" };

function buildSteps(inquiry: InquiryState | null, agentCount: number): LiveStep[] {
  const status = inquiry?.status ?? "dispatching";
  const order = ["dispatching", "collecting", "grading", "complete"];
  const reached = (stage: string) => order.indexOf(status) >= order.indexOf(stage);

  return [
    {
      label: "Understanding request",
      state: "done",
      lines: [
        ...(inquiry?.category ? [inquiry.category] : []),
        ...(inquiry?.geography ? [inquiry.geography] : []),
      ],
    },
    {
      label: "Checking the grid",
      state: reached("dispatching") ? "done" : "active",
      lines: [
        `${agentCount} agents connected`,
        `${inquiry?.agentsMatched ?? 0} received the command`,
      ],
    },
    {
      label: "Dispatching intelligence",
      state: reached("collecting") ? "done" : reached("dispatching") ? "active" : "idle",
      lines: [
        `Sourcing window · ${inquiry?.windowSeconds ?? 300}s`,
        "Every agent on the grid received the same command. Each one decides for itself whether to answer",
      ],
    },
    {
      label: "Results received",
      state: reached("grading") ? "done" : reached("collecting") ? "active" : "idle",
      lines: [
        `${inquiry?.claimsReceived ?? 0} claims submitted`,
        `${inquiry?.sourcesClustered ?? 0} independent source clusters`,
      ],
    },
    {
      label: "Ranking opportunities",
      state: status === "complete" ? "done" : reached("grading") ? "active" : "idle",
      lines:
        status === "complete"
          ? [`${((inquiry?.readout as ReadoutEntry[] | null) ?? []).length} companies in readout`]
          : ["Weighting by independence and reliability"],
    },
  ];
}
