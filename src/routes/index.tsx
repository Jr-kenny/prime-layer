import { createFileRoute, Link } from "@tanstack/react-router";
import { EvidenceLedger } from "@/components/site/EvidenceLedger";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prime Intelligence Network — Detect markets moving" },
      {
        name: "description",
        content:
          "Tell us what you sell. We find the companies developing a real reason to buy it, with the evidence, confidence, and timing behind every match.",
      },
      { property: "og:title", content: "Prime Intelligence Network — Detect markets moving" },
      {
        property: "og:description",
        content:
          "B2B demand intelligence: emerging need detected from clustered evidence, before a buying request is posted.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="flex-1 bg-ink text-vellum">
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="label-mono text-signal">Demand intelligence</p>
        <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl">
          We don't find leads.
          <br />
          We detect markets moving.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Tell the system what you sell. It returns the companies developing a real reason to buy
          it — a hotel opening 150 rooms, a chain signing new sites — before they have said so
          publicly.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            to="/request-access"
            className="rounded-sm bg-signal px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            Request access
          </Link>
          <Link
            to="/product"
            className="rounded-sm border border-ink-border px-5 py-2.5 text-sm text-vellum transition-colors hover:border-signal hover:text-signal"
          >
            See a query
          </Link>
        </div>

        <div className="mt-14">
          <EvidenceLedger />
        </div>

        <div className="mt-14 grid gap-10 border-t border-ink-border pt-10 md:grid-cols-2">
          <div>
            <p className="label-mono text-ink-muted">The loop</p>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Four steps run continuously: <span className="text-vellum">Signal</span>,{" "}
              <span className="text-vellum">Evidence</span>,{" "}
              <span className="text-vellum">Prediction</span>,{" "}
              <span className="text-vellum">Outcome</span>. Each one is checked against what
              actually happened.{" "}
              <Link to="/how-it-works" className="text-signal underline underline-offset-4">
                How it works
              </Link>
              .
            </p>
          </div>
          <div>
            <p className="label-mono text-ink-muted">Proof</p>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Every prediction ships with its evidence trail. Confidence is never asserted without a
              source behind it.{" "}
              <Link to="/trust" className="text-signal underline underline-offset-4">
                Read the rigor page
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
