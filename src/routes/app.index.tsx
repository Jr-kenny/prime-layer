import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Database, Layers3, ScanLine } from "lucide-react";
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
  const [account, setAccount] = useState<AccountView | null>(null);
  const [paywall, setPaywall] = useState<{ priceUsd: number; paymentWallet?: string } | null>(null);
  const [topup, setTopup] = useState<{ state: "idle" | "sent"; txHash: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [walletOg, setWalletOg] = useState<number | null>(null);
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
      // "complete" alone isn't enough — the synthesis pass writes the actual
      // readout right after. Keep polling briefly until it lands (or ~40s cap).
      if (state.status === "complete" && (state.synthesis || ticks > 20)) {
        window.clearInterval(pollRef.current!);
        setPhase("done");
      }
    }, 2000);
  }, []);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || phase === "running") return;
    setSubmitting(true);
    setPaywall(null);
    const result = await submitInquiry({
      data: {
        question: query,
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
      setPhase("running");
      poll(result.inquiryId);
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
        setPhase("running");
        refreshBalance();
        poll(result.inquiryId);
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
                readOnly={phase === "running" || submitting}
                aria-readonly={phase === "running" || submitting}
                className="mt-3 w-full"
              />
              <div className="app-query-meta">
                <p>Give us a moment. We're checking with agents across the grid.</p>
                <button
                  type="submit"
                  className="app-signal-button shrink-0"
                  disabled={submitting || phase === "running"}
                >
                  {submitting || phase === "running" ? "Running readout" : "Run intelligence"}
                  <ArrowUpRight className="size-3.5" aria-hidden />
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
                {phase === "done" && <StatusPill tone="verified" label="Evidence attached" />}
                {phase === "failed" && <StatusPill tone="flagged" label="Run failed" />}
              </div>

              {phase === "done" && synthesis && synthesis.recommendations.length > 0 ? (
                <div className="mt-5 space-y-5">
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
                <div className="surface mt-5 p-8 text-center">
                  <p className="font-display text-xl">
                    Honestly — nothing worth recommending came back.
                  </p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {synthesis.preamble ||
                      "We asked everyone on the grid and, honestly, no one had anything solid for you. That usually means there just isn't demand forming right now, not that something broke. Try a different question, or check back soon."}
                  </p>
                </div>
              ) : phase === "done" && readout.length > 0 ? (
                <div className="surface mt-5 p-8 text-center">
                  <p className="font-display text-xl">Signals are in — writing your readout…</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {readout.length} companies came back from the grid. The orchestrator is merging
                    duplicates and drafting the recommendation now. This page updates in a moment.
                  </p>
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
