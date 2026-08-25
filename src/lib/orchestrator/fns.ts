import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db, ensureSchema, nowIso, newId } from "@/lib/db";
import { inquiries, agents, supplyRecords, accounts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { runInquiry, SOURCING_WINDOW_SECONDS } from "@/lib/orchestrator/run";

const submitSchema = z.object({
  question: z.string().min(8).max(500),
  identity: z.string().min(3).max(120).optional(),
  email: z.string().max(160).optional(),
  wallet: z.string().max(60).optional(),
});

export type ReadoutEntry = {
  company: string;
  confidence: number;
  claims: number;
  independentSources: number;
  topClaim: string;
  contributingAgents: string[];
};

const readoutSchema = z.array(
  z.object({
    company: z.string(),
    confidence: z.number(),
    claims: z.number(),
    independentSources: z.number(),
    topClaim: z.string(),
    contributingAgents: z.array(z.string()),
  }),
);

export const submitInquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    await ensureSchema();
    const id = newId("INQ");
    const ts = nowIso();

    // Metering: signed-in businesses spend a free trial run or a credit.
    // Guest mode (no identity passed) is unmetered so dev keeps working.
    if (data.identity) {
      const { consumeRun } = await import("./credits");
      const spent = await consumeRun(data.identity, id);
      if (!spent.ok) return spent;
    }

    await db.insert(inquiries).values({
      id,
      question: data.question,
      status: "dispatching",
      createdAt: ts,
      updatedAt: ts,
    });
    // Fire-and-forget — the UI polls getInquiry for live progress.
    const submitUrl = process.env["PUBLIC_SUBMIT_URL"] ?? "http://localhost:8081";
    void runInquiry(id, `${submitUrl}/api/claims/submit`);
    return { inquiryId: id };
  });

export { getAccount, verifyTopup, pricingPublic } from "./credits";
export type { TopupResult } from "./credits";
export { FREE_TRIAL_RUNS, RUN_PRICE_USD } from "./credits";
export { runPriceInvoice } from "./credits";
import { getAccount } from "./credits";

const payRunSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  question: z.string().min(8).max(500),
  identity: z.string().min(3).max(120),
  email: z.string().max(160).optional(),
  wallet: z.string().max(60).optional(),
});

/**
 * Pay-per-run entry: creates the inquiry, verifies the buyer's on-chain
 * payment for THIS inquiry, then dispatches. The payment is bound to the
 * inquiry id before it ever hits the grid.
 */
export const submitPaidInquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) => payRunSchema.parse(input))
  .handler(async ({ data }) => {
    await ensureSchema();
    const id = newId("INQ");
    const ts = nowIso();

    // Ensure the account exists, then verify their payment against it.
    await getAccount({
      data: {
        identity: data.identity,
        ...(data.email ? { email: data.email } : {}),
        ...(data.wallet ? { wallet: data.wallet } : {}),
      },
    });
    const [account] = await db.select().from(accounts).where(eq(accounts.identity, data.identity));
    if (!account) return { ok: false as const, error: "Account setup failed." };

    const { verifyRunPayment } = await import("./credits");
    const paid = await verifyRunPayment(data.txHash, id, account.id);
    if (!paid.ok) return { ok: false as const, error: paid.error };

    await db.insert(inquiries).values({
      id,
      question: data.question,
      status: "dispatching",
      createdAt: ts,
      updatedAt: ts,
    });
    const submitUrl = process.env["PUBLIC_SUBMIT_URL"] ?? "http://localhost:8081";
    void runInquiry(id, `${submitUrl}/api/claims/submit`);
    return { ok: true as const, inquiryId: id };
  });

export type SynthesisSource = { label: string; url: string };

export type SynthesisView = {
  preamble: string;
  recommendations: {
    company: string;
    title: string;
    body: string;
    confidence: number;
    sources: SynthesisSource[];
  }[];
};

const synthesisSchema = z.object({
  preamble: z.string(),
  recommendations: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      body: z.string(),
      confidence: z.number(),
      sources: z.array(z.object({ label: z.string(), url: z.string() })),
    }),
  ),
});

export const getInquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.string().min(3).parse(input))
  .handler(async ({ data: id }) => {
    await ensureSchema();
    const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id));
    if (!row) return null;
    return {
      id: row.id,
      question: row.question,
      category: row.category,
      geography: row.geography,
      status: row.status as "dispatching" | "collecting" | "grading" | "complete" | "failed",
      agentsMatched: row.agentsMatched,
      claimsReceived: row.claimsReceived,
      sourcesClustered: row.sourcesClustered,
      readout: row.readoutJson ? readoutSchema.parse(JSON.parse(row.readoutJson)) : null,
      synthesis: row.synthesisJson
        ? (synthesisSchema.parse(JSON.parse(row.synthesisJson)) as SynthesisView)
        : null,
      error: row.error,
      windowSeconds: SOURCING_WINDOW_SECONDS,
    };
  });

export const listLiveAgents = createServerFn({ method: "POST" }).handler(async () => {
  await ensureSchema();
  const rows = await db.select().from(agents).orderBy(desc(agents.createdAt));
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    specialty: a.specialty,
    wallet: `${a.wallet.slice(0, 6)}…${a.wallet.slice(-4)}`,
    status: a.status,
    reliability: a.reliability,
    // ERC-7857 identity pointer ("0x7857:<tokenId>") once minted.
    agenticId: a.agenticId,
    connectedAt: a.createdAt,
  }));
});

const supplySchema = z.object({
  name: z.string().min(2),
  markets: z.array(z.string()).default([]),
  targets: z.array(z.string()).default([]),
});

export const addSupplyRecord = createServerFn({ method: "POST" })
  .validator((input: unknown) => supplySchema.parse(input))
  .handler(async ({ data }) => {
    await ensureSchema();
    const id = newId("SUP");
    await db.insert(supplyRecords).values({
      id,
      name: data.name,
      marketsJson: JSON.stringify(data.markets),
      targetsJson: JSON.stringify(data.targets),
      createdAt: nowIso(),
    });
    return { id };
  });

export const listSupplyRecords = createServerFn({ method: "POST" }).handler(async () => {
  await ensureSchema();
  const rows = await db.select().from(supplyRecords).orderBy(desc(supplyRecords.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    markets: JSON.parse(r.marketsJson) as string[],
    targets: JSON.parse(r.targetsJson) as string[],
  }));
});
