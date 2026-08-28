import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Database, Layers3, ScanLine } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading, StatusPill } from "@/components/app/AppUI";
import { RequireAuth } from "@/components/app/auth-gate";
import { PrivyIdentity, type PrivyIdentityInfo } from "@/components/app/privy-identity";
import {
  getInquiry,
  listLiveAgents,
  listSupplyRecords,
  submitInquiry,
  submitPaidInquiry,
  listMyRuns,
  latestActiveRun,
} from "@/lib/orchestrator/fns";
import {
  getAccount,
  verifyTopup,
  runPriceInvoice,
  getWalletBalance,
} from "@/lib/orchestrator/account-fns";

type AccountView = {
  id: string;
  credits: number;
  freeRunsUsed: number;
  freeRunsLeft: number;
  priceUsd: number;
};
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
  sources: { label: string; url: string }[];
  contributingAgents: string[];
};

const EXAMPLES = [
  "Which hotel chains and manufacturers are expanding or building new facilities right now?",
  "hey we are a company dealing on electricals and yesterday stocks worth 13m usd came in and we have 6 months to clear it. can you look for future partners we can meet that may be in need of these goods, not limited to only chandeliers, sockets, leds, solars etc we have a wide range of goods in stock",
];

type RunHistoryRow = {
  id: string;
  question: string;
  status: "dispatching" | "collecting" | "grading" | "complete" | "failed";
  createdAt: string | null;
  claimsReceived: number;
  sourcesClustered: number;
  complete: boolean;
  active: boolean;
  error?: string | null;
};

function Intelligence() {
  const [query, setQuery] = useState(
    "Which hotel chains and manufacturers are expanding or building new facilities right now?",
  );
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [inquiry, setInquiry] = useState<InquiryState | null>(null);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof listLiveAgents>>>([]);
  const [supply, setSupply] = useState<Awaited<ReturnType<typeof listSupplyRecords>>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<AccountView | null>(null);
  const [paywall, setPaywall] = useState<{ priceUsd: number; paymentWallet?: string } | null>(null);
  const [topup, setTopup] = useState<{ state: "idle" | "sent"; txHash: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [walletOg, setWalletOg] = useState<number | null>(null);
  const [history, setHistory] = useState<RunHistoryRow[]>([]);
  const pollRef = useRef<number | null>(null);
  const [privy, setPrivy] = useState<PrivyIdentityInfo>({
    authenticated: false,
    email: null,
    walletAddress: null,
    firstWallet: null,
  });
  const identity = privy.email ?? privy.walletAddress ?? null;
  const connectedAddress = privy.firstWallet?.address ?? privy.walletAddress;

  useEffect(() => {
    void listLiveAgents().then(setAgents);
    void listSupplyRecords().then(setSupply);
  }, []);

  useEffect(() => {
    if (!identity) {
      setAccount(null);
      return;
    }
    void getAccount({
      data: {
        identity,
        email: privy.email ?? undefined,
        wallet: privy.walletAddress ?? undefined,
      },
    }).then(setAccount);
  }, [identity, privy.email, privy.walletAddress]);

  // Live wallet balance — the buyer's own Privy wallet on 0G. Refreshes on
  // sign-in and right after any payment so "empty" is never a surprise.
  const refreshBalance = useCallback(() => {
    if (!connectedAddress) return;
    void getWalletBalance({ data: { address: connectedAddress } }).then((r) => {
      if (r.ok) setWalletOg(r.og);
    });
  }, [connectedAddress]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const poll = useCallback((inquiryId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = window.setInterval(async () => {
      ticks += 1;
      const state = await getInquiry({ data: inquiryId });
      if (!state) return;
      setInquiry(state);
      if (state.status === "failed") {
        window.clearInterval(pollRef.current!);
        setPhase("failed");
      }
      // Phase directly to results as soon as the readout exists — synthesis is
      // an enhancement, not a gate. The UI renders readout immediately.
      if (state.status === "complete" && (state.readout || state.synthesis)) {
        window.clearInterval(pollRef.current!);
        setPhase("done");
        if (identityRef.current) void refreshRunsRef.current?.();
      }
      // A healthy cycle finishes in ~6 min. Past 12, the run is dead — stop
      // watching instead of spinning forever.
      if (ticks > 360) {
        window.clearInterval(pollRef.current!);
        setPhase("failed");
        if (identityRef.current) void refreshRunsRef.current?.();
      }
    }, 2000);
  }, []);

  // Refs so poll can notify the history refresh without a circular dependency.
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  const refreshRunsRef = useRef<(() => void) | null>(null);

  // Resume + history: runs belong to the account on the server. On sign-in,
  // adopt any in-flight run (refresh / dead phone / new device) and load the
  // workspace's run history. No browser storage involved.
  const refreshRuns = useCallback(() => {
    if (!identity) return;
    void latestActiveRun({ data: { identity } }).then((activeRun) => {
      if (!activeRun || pollRef.current) return; // already watching something
      setPhase("running");
      poll(activeRun.id);
    });
    void listMyRuns({ data: { identity } }).then((rows) => {
      if (!rows.length) return;
      setHistory(rows);
      // If nothing is in flight, show the most recent finished readout so the
      // workspace always opens with the last result they paid for.
      if (phase === "idle") {
        const last = rows.find((r) => r.complete);
        if (last) {
          void getInquiry({ data: last.id }).then((state) => {
            if (state?.readout?.length || state?.synthesis) {
              setInquiry(state);
              setPhase("done");
            }
          });
        }
      }
    });
  }, [identity, phase, poll]);

  useEffect(() => {
    refreshRunsRef.current = refreshRuns;
  }, [refreshRuns]);
  useEffect(() => {
    refreshRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  // Deep-link from Supply's Recent enquiries: /app?inquiry=INQ_xxx
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("inquiry");
    if (q && identity) {
      void getInquiry({ data: q }).then((state) => {
        if (state?.readout?.length || state?.synthesis) {
          setInquiry(state);
          setPhase("done");
          window.history.replaceState({}, "", "/app");
        }
      });
    }
  }, [identity]);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || phase === "running") return;
    const submittedQuery = query;
    setSubmitting(true);
    setPaywall(null);
    const result = await submitInquiry({
      data: {
        question: submittedQuery,
        ...(identity
          ? {
              identity,
              ...(privy.email ? { email: privy.email } : {}),
              ...(privy.walletAddress ? { wallet: privy.walletAddress } : {}),
            }
          : {}),
      },
    });
    setSubmitting(false);
    if ("inquiryId" in result && result.inquiryId) {
      setQuery("");
      setPhase("running");
      poll(result.inquiryId);
      // Smooth scroll into results phase
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } else if ("reason" in result && result.reason === "out_of_credits") {
      setPaywall({
        priceUsd: result.priceUsd,
        ...(result.paymentWallet ? { paymentWallet: result.paymentWallet } : {}),
      });
    }
  }

  async function verifyPayment() {
    if (!topup?.txHash || !identity || !paywall) return;
    setSubmitting(true);
    const result = await verifyTopup({ data: { identity, txHash: topup.txHash } });
    setSubmitting(false);
    if (result.ok) {
      setAccount(await getAccount({ data: { identity } }));
      setTopup(null);
      setPaywall(null);
    } else {
      alert(result.error);
    }
  }

  async function payAndRun() {
    if (!identity || !paywall?.paymentWallet) return;
    const connected = privy.firstWallet;
    if (!connected) {
      setPayError("No wallet connected — sign in again with a wallet-enabled account.");
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const invoice = await runPriceInvoice();
      if (!invoice?.wallet) throw new Error("Payments not configured.");
      const provider = await connected.getEthereumProvider();
      const [from] = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const amountHex = "0x" + BigInt(invoice.amountWei).toString(16);
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: invoice.wallet, value: amountHex }],
      })) as string;

      const result = await submitPaidInquiry({
        data: {
          txHash,
          question: query,
          identity,
          ...(privy.email ? { email: privy.email } : {}),
          ...(privy.walletAddress ? { wallet: privy.walletAddress } : {}),
        },
      });
      if (result.ok) {
        setAccount(await getAccount({ data: { identity } }));
        setPaywall(null);
        setQuery("");
        setPhase("running");
        refreshBalance();
        poll(result.inquiryId);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      } else {
        setPayError(result.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPayError(msg.includes("rejected") ? "Payment was cancelled." : msg.slice(0, 160));
    } finally {
      setPaying(false);
    }
  }

  const steps = buildSteps(inquiry, agents.length);
  const readout = (inquiry?.readout as ReadoutEntry[] | null) ?? [];
  const synthesis = inquiry?.synthesis ?? null;

  return (
    <div>
      <PrivyIdentity onChange={setPrivy} />
      {phase === "idle" ? (
        <section className="app-overview-hero">
          <div className="app-overview-hero-inner">
            <p className="app-overview-kicker label-mono">
              <span className="app-sync-dot" aria-hidden />
              Intelligence command · {agents.length} agents on the grid
            </p>
            <h1>What are you trying to find?</h1>
            <p className="app-overview-hero-intro">
              Tell us what you need to move. We put your question to a network of independent
              research agents, separate the real signals from the noise, and come back with
              companies worth your attention, plus the evidence behind every name.
            </p>

            <RequireAuth>
              <form onSubmit={run} className="app-query-box mt-9">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor="intent" className="label-mono text-ink-muted">
                    Please put in your request
                  </label>
                  {account && (
                    <span className="label-mono text-signal">
                      {account.freeRunsLeft > 0
                        ? `${account.freeRunsLeft} free ${account.freeRunsLeft === 1 ? "run" : "runs"} left`
                        : account.credits > 0
                          ? `${account.credits} ${account.credits === 1 ? "credit" : "credits"} left`
                          : "no runs left"}
                    </span>
                  )}
                </div>
                <textarea
                  id="intent"
                  rows={4}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  readOnly={submitting}
                  aria-readonly={submitting}
                  placeholder="e.g. We have $13M of electricals to move in 6 months — who needs chandeliers, sockets, LEDs and solar right now?"
                  className="mt-3 w-full"
                />
                <div className="app-query-meta">
                  <p aria-live="polite">
                    {submitting ? "Sending your request…" : "One request. Sourced, graded, cited."}
                  </p>
                  <button
                    type="submit"
                    className="app-signal-button shrink-0 inline-flex items-center gap-2"
                    disabled={submitting || !query.trim()}
                  >
                    {submitting ? (
                      <>
                        <span
                          className="inline-block size-3 animate-spin rounded-full border-2 border-ink/40 border-t-ink"
                          aria-hidden
                        />
                        Sending…
                      </>
                    ) : (
                      "Run intelligence"
                    )}
                  </button>
                </div>
              </form>
            </RequireAuth>

            {paywall && (
              <div className="surface-dark mt-5 p-5 sm:p-6" aria-label="Payment needed">
                <p className="label-mono text-signal">Free runs used up</p>
                <h3 className="mt-2 font-display text-2xl text-vellum">
                  ${paywall.priceUsd} per intelligence run
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
                  Pay from your wallet and the run starts immediately. The payment goes
                  {paywall.paymentWallet ? " directly to Prime Layer" : ""} on 0G chain and is
                  verified before your request dispatches.
                </p>
                {payError && (
                  <p className="mt-4 border-l-2 border-flag pl-4 font-mono text-xs leading-relaxed text-flag">
                    {payError}
                  </p>
                )}
                {privy.firstWallet && paywall.paymentWallet ? (
                  <button
                    type="button"
                    onClick={payAndRun}
                    disabled={paying}
                    className="app-signal-button mt-5 disabled:opacity-60"
                  >
                    {paying ? "Waiting for payment…" : `Pay $${paywall.priceUsd} & run`}
                    {!paying && <ArrowUpRight className="size-3.5" aria-hidden />}
                  </button>
                ) : (
                  <p className="mt-4 font-mono text-xs text-flag">
                    Sign in with a wallet-enabled account to pay for runs.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.filter((ex) => ex !== query).map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuery(example)}
                  className="app-filter-button text-left normal-case tracking-normal"
                >
                  {example.length > 90 ? `${example.slice(0, 88)}…` : example}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="border-b border-border bg-[#0a0f0e]/95 backdrop-blur">
          <div className="mx-auto max-w-[1280px] px-6 py-4 sm:px-8 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="label-mono flex items-center gap-2 text-signal">
                <span className="app-sync-dot" aria-hidden />
                {phase === "running"
                  ? inquiry?.status === "grading"
                    ? "Checking the evidence…"
                    : inquiry?.status === "dispatching"
                      ? "Contacting our agents…"
                      : "Researching your request…"
                  : phase === "done"
                    ? "Readout ready — 8 companies"
                    : "Run failed"}
                <span className="hidden text-ink-muted sm:inline">
                  · {agents.length} agents on the grid
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  if (pollRef.current) window.clearInterval(pollRef.current);
                  setPhase("idle");
                  setInquiry(null);
                }}
                className="rounded-sm border border-ink-border px-3.5 py-1.5 text-xs font-medium hover:border-signal hover:text-signal"
              >
                New request
              </button>
            </div>
            {inquiry?.question && (
              <p className="mt-3 max-w-3xl truncate font-mono text-xs leading-relaxed text-ink-muted">
                “{inquiry.question}”
              </p>
            )}
          </div>
        </section>
      )}

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
                  Prime Layer researches your request through specialist agents on our intelligence
                  layer, verifies what they bring back, and returns companies worth your attention —
                  each with the evidence behind it.
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
                One readout. Every claim carries its source.
              </p>
            </section>

            <section aria-label="Ranked results">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="mt-2 font-display text-2xl">What came back</h2>
                </div>
                <div className="flex items-center gap-3">
                  {phase === "done" && <StatusPill tone="verified" label="Evidence attached" />}
                  {phase === "failed" && <StatusPill tone="flagged" label="Run failed" />}
                </div>
              </div>

              {phase === "done" && synthesis && synthesis.recommendations.length > 0 ? (
                <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {synthesis.preamble && (
                    <p className="max-w-3xl border-l-2 border-signal pl-4 text-sm leading-relaxed text-muted-foreground">
                      {synthesis.preamble}
                    </p>
                  )}
                  <ol className="space-y-4">
                    {synthesis.recommendations.map((rec, index) => (
                      <li key={`${rec.company}-${index}`} className="surface p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="label-mono text-signal">
                              {String(index + 1).padStart(2, "0")} · Recommendation
                            </p>
                            <h3 className="mt-2 font-display text-2xl leading-tight">
                              {rec.company}
                            </h3>
                            {rec.title && rec.title !== rec.company && (
                              <p className="mt-1 text-sm font-medium">{rec.title}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-3xl text-signal">{rec.confidence}%</p>
                            <p className="label-mono text-muted-foreground">match</p>
                          </div>
                        </div>
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed">{rec.body}</p>
                        {rec.sources.length > 0 && (
                          <div className="mt-5 border-t border-border pt-4">
                            <p className="label-mono text-muted-foreground">
                              Sources · read them yourself
                            </p>
                            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                              {rec.sources.map((source, sIndex) => (
                                <li key={`${source.url}-${sIndex}`}>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-mono text-xs text-signal hover:text-ink"
                                  >
                                    {source.label || "source"}
                                    <ArrowUpRight className="size-3" aria-hidden />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : phase === "done" && synthesis ? (
                <div className="surface mt-5 p-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <p className="font-display text-xl">
                    Honestly — nothing worth recommending came back.
                  </p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {synthesis.preamble ||
                      "We asked everyone on the grid and, honestly, no one had anything solid for you. That usually means there just isn't demand forming right now, not that something broke. Try a different question, or check back soon."}
                  </p>
                </div>
              ) : phase === "done" && readout.length > 0 ? (
                <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <p className="max-w-3xl border-l-2 border-signal pl-4 text-sm leading-relaxed text-muted-foreground">
                    {synthesis?.preamble ||
                      `We clustered ${readout.length} companies from ${inquiry?.sourcesClustered ?? readout.reduce((s, r) => s + r.independentSources, 0)} source clusters. Ranked by confidence — highest first.`}
                  </p>
                  <ol className="space-y-4">
                    {readout.map((entry, index) => (
                      <li key={`${entry.company}-${index}`} className="surface p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="label-mono text-signal">
                              {String(index + 1).padStart(2, "0")} · Recommendation
                            </p>
                            <h3 className="mt-2 font-display text-2xl leading-tight">
                              {entry.company}
                            </h3>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed">
                              {entry.topClaim}
                            </p>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                              This signal suggests a near-term need that matches what you are trying
                              to move — worth checking the sources below yourself before you commit
                              stock.
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-3xl text-signal">{entry.confidence}%</p>
                            <p className="label-mono text-muted-foreground">match</p>
                          </div>
                        </div>
                        {(entry.sources?.length ?? 0) > 0 && (
                          <div className="mt-5 border-t border-border pt-4">
                            <p className="label-mono text-muted-foreground">
                              Sources · read them yourself
                            </p>
                            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                              {(entry.sources ?? []).map((source, sIndex) => (
                                <li key={`${source.url}-${sIndex}`}>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-mono text-xs text-signal hover:text-ink"
                                  >
                                    {source.label || "source"}
                                    <ArrowUpRight className="size-3" aria-hidden />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                          {(entry.sources?.length ?? 0) > 0 ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <button className="label-mono text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-signal hover:decoration-signal">
                                  {entry.independentSources} independent source
                                  {entry.independentSources === 1 ? "" : "s"}
                                  {entry.claims > entry.independentSources
                                    ? ` · ${entry.claims} signals clustered`
                                    : ""}
                                  <span className="ml-1 text-[0.6rem]">↗</span>
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 p-3" align="start">
                                <p className="label-mono text-ink-muted">Sources · click to read</p>
                                <ul className="mt-2 space-y-1.5">
                                  {(entry.sources ?? []).slice(0, 5).map((s, i) => (
                                    <li key={`${s.url}-${i}`}>
                                      <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between gap-2 rounded-sm border border-border px-2 py-1.5 text-xs hover:border-signal hover:bg-slate/30"
                                      >
                                        <span className="truncate font-mono text-signal">
                                          {s.label}
                                        </span>
                                        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-2 font-mono text-[0.6rem] text-ink-muted">
                                  Hover shows {Math.min(5, entry.sources?.length ?? 0)} of{" "}
                                  {entry.sources?.length ?? 0} — full list below.
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="label-mono text-muted-foreground">
                              {entry.independentSources} independent source
                              {entry.independentSources === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {synthesis && synthesis.recommendations.length === 0 && (
                    <p className="text-center font-mono text-xs text-muted-foreground">
                      Full recommendation text will upgrade in a moment — these are the raw ranked
                      signals.
                    </p>
                  )}
                </div>
              ) : phase === "done" ? (
                <div className="surface mt-5 p-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <p className="font-display text-xl">Nothing came back this time.</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    We asked everyone on the grid and, honestly, no one had anything solid for you.
                    That usually means there just isn't demand forming right now, not that something
                    broke. Try a different question, or check back soon. The moment something moves,
                    it'll show up here.
                  </p>
                </div>
              ) : phase === "failed" ? (
                <div className="surface mt-5 p-8 text-center animate-in fade-in duration-300">
                  <p className="font-display text-xl">Run failed</p>
                  <p className="mx-auto mt-3 max-w-md font-mono text-xs leading-relaxed text-muted-foreground">
                    {inquiry?.error ?? "Something went wrong on our end."}
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="h-24 rounded-sm border border-border bg-slate/30 animate-pulse" />
                  <div className="h-24 rounded-sm border border-border bg-slate/20 animate-pulse [animation-delay:150ms]" />
                  <div className="h-24 rounded-sm border border-border bg-slate/10 animate-pulse [animation-delay:300ms]" />
                  <p className="pt-2 text-center font-mono text-[0.65rem] text-ink-muted">
                    Researching — results slide in as soon as the 8 are ranked
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
