import { createFileRoute, Link } from "@tanstack/react-router";
import { SUPPLY } from "@/lib/demo-data";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/supply")({
  head: () => ({
    meta: [
      { title: "Supply — what Prime Layer knows you can sell" },
      {
        name: "description",
        content:
          "Define what you supply so Prime Layer can match newly detected demand against it automatically.",
      },
      { property: "og:title", content: "Supply — what Prime Layer knows you can sell" },
      {
        property: "og:description",
        content: "Your supply record, matched continuously against detected demand.",
      },
    ],
  }),
  component: Supply,
});

function Supply() {
  return (
    <div>
      <PageHeader
        eyebrow="Supply"
        title="What Prime Layer knows you can sell"
        intro="This is not a public listing. It is the reference Prime Layer uses to match newly detected demand against your actual capacity, markets and contract profile."
      />

      <div className="px-5 py-8 sm:px-8">
        <ul className="grid gap-4 lg:grid-cols-2">
          {SUPPLY.map((s) => (
            <li key={s.id} className="rounded-md border border-border bg-card p-5">
              <h2 className="font-display text-lg">{s.name}</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                {s.detail.map((d) => (
                  <div key={d.label}>
                    <dt className="label-mono text-muted-foreground">{d.label}</dt>
                    <dd className="mt-0.5 font-mono text-sm">{d.value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="label-mono text-muted-foreground">Markets</dt>
                  <dd className="mt-0.5 text-sm">{s.markets.join(", ")}</dd>
                </div>
                <div>
                  <dt className="label-mono text-muted-foreground">Target demand</dt>
                  <dd className="mt-0.5 text-sm">{s.targets.join(", ")}</dd>
                </div>
              </dl>
              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border pt-4">
                <p className="font-mono text-xs text-muted-foreground">
                  <span className="text-signal">{s.matches}</span> current demand matches ·{" "}
                  <span className="text-verified">{s.highConfidence}</span> high confidence
                </p>
                <Link
                  to="/app/opportunities"
                  className="label-mono text-signal hover:underline"
                >
                  Review
                </Link>
              </div>
            </li>
          ))}
          <li className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border p-5">
            <button
              type="button"
              className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-signal hover:text-signal"
            >
              Add a supply record
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
