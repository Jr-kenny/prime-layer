import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db, ensureSchema, nowIso, newId } from "@/lib/db";
import { inquiries, agents, supplyRecords } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { runInquiry, SOURCING_WINDOW_SECONDS } from "@/lib/orchestrator/run";

const submitSchema = z.object({ question: z.string().min(8).max(500) });

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
