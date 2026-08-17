import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/request-access")({
  head: () => ({
    meta: [
      { title: "Request access — Prime Intelligence Network" },
      {
        name: "description",
        content:
          "Request access to the demand intelligence platform. Tell us who you are and what you're looking to move.",
      },
      { property: "og:title", content: "Request access — Prime Intelligence Network" },
      {
        property: "og:description",
        content: "Access is granted by request. No self-serve sign-up.",
      },
    ],
  }),
  component: RequestAccess,
});

const fields = [
  { id: "name", label: "Name", type: "text", autoComplete: "name" },
  { id: "company", label: "Company", type: "text", autoComplete: "organization" },
  { id: "email", label: "Work email", type: "email", autoComplete: "email" },
] as const;

function RequestAccess() {
  const [sent, setSent] = useState(false);

  return (
    <div className="bg-vellum text-ink">
      <section className="mx-auto max-w-xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="label-mono text-signal">Access</p>
        <h1 className="mt-5 font-display text-4xl leading-[1.05]">Request access</h1>

        {sent ? (
          <p className="mt-8 border-l-2 border-verified pl-4 text-base text-muted-foreground">
            Request received. We'll reply from contact@primeintelligence.net within two business
            days.
          </p>
        ) : (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            {fields.map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="label-mono text-muted-foreground">
                  {f.label}
                </label>
                <input
                  id={f.id}
                  name={f.id}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  required
                  className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm text-foreground"
                />
              </div>
            ))}
            <div>
              <label htmlFor="moving" className="label-mono text-muted-foreground">
                What are you looking to move?
              </label>
              <input
                id="moving"
                name="moving"
                type="text"
                required
                placeholder="e.g. 5,000 TVs in Nigeria, minimum order 20 units"
                className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              className="rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-vellum transition-opacity hover:opacity-90"
            >
              Send request
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
