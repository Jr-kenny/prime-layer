import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Boxes, CheckCircle2, Clock, Plus, X } from "lucide-react";
import { PrivyIdentity, type PrivyIdentityInfo } from "@/components/app/privy-identity";
import { getInquiry, listMyRuns } from "@/lib/orchestrator/fns";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { MetricBlock, SectionHeading } from "@/components/app/AppUI";
import { listSupplyLive, type SupplyView } from "@/lib/orchestrator/workspace";
import { addSupplyRecord } from "@/lib/orchestrator/fns";
import { RequireAuth, RequireAuthAction } from "@/components/app/auth-gate";

export const Route = createFileRoute("/app/supply")({
  head: () => ({
    meta: [
      { title: "Supply · Prime Layer workspace" },
      {
        name: "description",
        content:
          "Define what you supply so Prime Layer can match newly detected demand against your capacity, markets and contract profile.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Supply,
});

function Supply() {
  const [records, setRecords] = useState<SupplyView[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [market, setMarket] = useState("Nigeria");
  const [target, setTarget] = useState("Hospitality");
  const [capacity, setCapacity] = useState("");
  const [privy, setPrivy] = useState<PrivyIdentityInfo>({
    authenticated: false,
    email: null,
    walletAddress: null,
    firstWallet: null,
  });
  const identity = privy.email ?? privy.walletAddress ?? null;
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listMyRuns>>>([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    void listSupplyLive().then(setRecords);
  }, []);

  useEffect(() => {
    if (!identity) {
      setHistory([]);
      return;
    }
    void listMyRuns({ data: { identity } }).then(setHistory);
  }, [identity]);

  async function addRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !capacity.trim() || saving) return;
    setSaving(true);
    try {
      await addSupplyRecord({
        data: {
          name: `${name.trim()} (${capacity.trim()})`,
          markets: [market],
          targets: [target.trim()],
        },
      });
      setName("");
      setCapacity("");
      setAdding(false);
      setRecords(await listSupplyLive());
    } finally {
      setSaving(false);
    }
  }

  const view = records ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Supply record"
        title="What Prime Layer knows you can sell"
        intro="This is not a public listing. It is the reference Prime Layer uses to match newly detected demand against your actual capacity, markets and contract profile."
      >
        <RequireAuthAction signInLabel="Sign in to add supply">
          <button
            type="button"
            className="app-dark-button shrink-0"
            onClick={() => setAdding((value) => !value)}
          >
            {adding ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {adding ? "Close form" : "Add supply record"}
          </button>
        </RequireAuthAction>
      </PageHeader>
      <PrivyIdentity onChange={setPrivy} />

      <div className="app-content">
        <section className="surface mb-8 p-5 sm:p-6" aria-labelledby="recent-enquiries">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="label-mono text-signal" id="recent-enquiries">
                Recent enquiries
              </p>
              <h2 className="mt-1 font-display text-xl">Your past intelligence runs</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Every run you paid for stays here. Hover a row to preview its sources, click to
                reopen the full readout in Intelligence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="rounded-sm border border-ink-border px-3.5 py-1.5 text-xs font-medium hover:border-signal hover:text-signal"
            >
              {historyOpen ? "Hide" : "Show"} {history.length > 0 ? `(${history.length})` : ""}
            </button>
          </div>

          {historyOpen && (
            <div className="mt-5">
              {!identity ? (
                <p className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Sign in to see your past enquiries — they are saved to your workspace, not this
                  browser.
                </p>
              ) : history.length === 0 ? (
                <p className="rounded-sm border border-border p-6 text-center text-sm text-muted-foreground">
                  No enquiries yet — run one from Intelligence and it will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-sm border border-border">
                  {history.slice(0, 12).map((row) => (
                    <li key={row.id} className="group">
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (!row.complete) return;
                              window.location.href = `/app?inquiry=${row.id}`;
                            }}
                            disabled={!row.complete}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors enabled:hover:bg-slate/30 disabled:opacity-50 group-hover:bg-slate/5"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-vellum group-hover:text-signal">
                                {row.question}
                              </span>
                              <span className="mt-0.5 block font-mono text-[0.65rem] text-ink-muted">
                                {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ""}
                                {row.complete
                                  ? ` · ${row.sourcesClustered} sources · ${row.claimsReceived} signals`
                                  : row.active
                                    ? " · in progress"
                                    : " · failed"}
                              </span>
                            </span>
                            <span
                              className={`flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[0.65rem] ${
                                row.complete
                                  ? "bg-verified/10 text-verified"
                                  : row.active
                                    ? "bg-signal/10 text-signal"
                                    : "bg-border text-muted-foreground"
                              }`}
                            >
                              {row.complete ? "view" : row.active ? "running" : "failed"}
                              {row.complete && <ArrowUpRight className="size-3" />}
                            </span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-3" align="start">
                          <p className="label-mono text-ink-muted">Preview</p>
                          <p className="mt-1 line-clamp-3 text-sm leading-relaxed">
                            {row.question}
                          </p>
                          <p className="mt-2 font-mono text-[0.65rem] text-ink-muted">
                            {row.complete
                              ? "Click to reopen full readout with sources in Intelligence."
                              : "Run still in progress — check back in a minute."}
                          </p>
                          {row.complete && row.sourcesClustered > 0 && (
                            <p className="mt-1 font-mono text-[0.65rem] text-signal">
                              {row.sourcesClustered} independent source clusters · click to see them
                            </p>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
        {adding && (
          <RequireAuth>
            <section className="surface-dark mb-8 p-5 sm:p-6" aria-labelledby="add-supply">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-mono text-signal">New supply record</p>
                  <h2 className="mt-2 font-display text-2xl text-vellum">
                    Give the graph something concrete to match
                  </h2>
                </div>
                <Boxes className="size-5 text-signal" aria-hidden />
              </div>
              <form onSubmit={addRecord} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label>
                  <span className="app-form-label text-ink-muted">What you sell</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="app-input mt-2 border-ink-border bg-slate text-vellum placeholder:text-ink-subtle"
                    placeholder="e.g. Backup power systems"
                  />
                </label>
                <label>
                  <span className="app-form-label text-ink-muted">Capacity / contract</span>
                  <input
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                    required
                    className="app-input mt-2 border-ink-border bg-slate text-vellum placeholder:text-ink-subtle"
                    placeholder="e.g. 10 installs / month"
                  />
                </label>
                <label>
                  <span className="app-form-label text-ink-muted">Primary market</span>
                  <select
                    value={market}
                    onChange={(event) => setMarket(event.target.value)}
                    className="app-select mt-2 border-ink-border bg-slate text-vellum"
                  >
                    <option>Nigeria</option>
                    <option>Ghana</option>
                    <option>Kenya</option>
                    <option>South Africa</option>
                  </select>
                </label>
                <label>
                  <span className="app-form-label text-ink-muted">Target demand</span>
                  <input
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                    className="app-input mt-2 border-ink-border bg-slate text-vellum placeholder:text-ink-subtle"
                    placeholder="e.g. Manufacturing"
                  />
                </label>
                <div className="sm:col-span-2 lg:col-span-4">
                  <button type="submit" className="app-signal-button">
                    Save to workspace <ArrowUpRight className="size-3.5" aria-hidden />
                  </button>
                  <p className="mt-3 font-mono text-[0.64rem] text-ink-muted">
                    Saved to your workspace and matched against live demand on the graph.
                  </p>
                </div>
              </form>
            </section>
          </RequireAuth>
        )}

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <SectionHeading eyebrow="Inventory context" title="The supply side of the graph" />
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Prime Layer uses these records to rank demand against what you can actually deliver.
              The match stays private to your workspace.
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-verified" aria-hidden />
            <span className="font-mono text-xs">{view.length} records active</span>
          </div>
        </div>

        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {records === null && (
            <li className="surface p-8 text-center text-sm text-muted-foreground">
              Loading supply records…
            </li>
          )}
          {records !== null && view.length === 0 && (
            <li className="surface p-8 text-center text-sm text-muted-foreground">
              No supply records yet — add what you sell and Prime Layer matches new demand against
              it.
            </li>
          )}
          {view.map((record, index) => (
            <li
              key={record.id}
              className={`surface overflow-hidden ${index === 0 ? "border-signal/50" : ""}`}
            >
              <div className="border-l-2 border-signal p-5 sm:p-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="label-mono text-muted-foreground">
                      Supply record · {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-2 font-display text-2xl leading-none">{record.name}</h2>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {record.markets.join(" / ")} · {record.targets.join(" / ")}
                    </p>
                  </div>
                  <Boxes className="size-5 shrink-0 text-signal" aria-hidden />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">
                  {record.detail.map((detail) => (
                    <MetricBlock key={detail.label} label={detail.label} value={detail.value} />
                  ))}
                  <MetricBlock label="Markets" value={record.markets.join(" / ")} />
                  <MetricBlock label="Target demand" value={record.targets.join(" / ")} />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">
                  <div>
                    <p className="label-mono text-muted-foreground">Current matches</p>
                    <p className="mt-2 font-mono text-2xl text-signal">{record.matches}</p>
                  </div>
                  <div>
                    <p className="label-mono text-muted-foreground">High confidence</p>
                    <p className="mt-2 font-mono text-2xl text-verified">{record.highConfidence}</p>
                  </div>
                </div>

                <Link
                  to="/app"
                  className="mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-signal hover:text-ink"
                >
                  Run a query against this record <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-5 border-t border-border pt-6 md:grid-cols-3">
          <div>
            <p className="label-mono text-muted-foreground">Private by default</p>
            <p className="mt-2 text-sm leading-relaxed">
              Supply records help rank your opportunities and are not public marketplace listings.
            </p>
          </div>
          <div>
            <p className="label-mono text-muted-foreground">Matched to movement</p>
            <p className="mt-2 text-sm leading-relaxed">
              A record becomes useful when a company situation makes the category probable.
            </p>
          </div>
          <div>
            <p className="label-mono text-muted-foreground">No static profiles</p>
            <p className="mt-2 text-sm leading-relaxed">
              The graph cares about capacity, geography, timing and the reason demand is forming.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
