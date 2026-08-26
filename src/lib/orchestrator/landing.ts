import { createServerFn } from "@tanstack/react-start";

/**
 * Public landing-page stats + recent evidence. Real data only — if the
 * network is young and numbers are small, we show the small true number.
 */
export const getLandingStats = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { db, ensureSchema } = await import("@/lib/db");
    const { agents, evidenceRecords, inquiries, opportunities } = await import("@/lib/db/schema");
    const { count, desc, eq } = await import("drizzle-orm");
    await ensureSchema();

    const [evidence] = await db
      .select({ n: count() })
      .from(evidenceRecords)
      .where(eq(evidenceRecords.status, "verified"));
    const [sources] = await db.select({ n: count() }).from(evidenceRecords);
    const [opps] = await db.select({ n: count() }).from(opportunities);
    const [runs] = await db.select({ n: count() }).from(inquiries);
    const [agentsOnline] = await db
      .select({ n: count() })
      .from(agents)
      .where(eq(agents.status, "online"));

    const recent = await db
      .select({
        company: evidenceRecords.company,
        claim: evidenceRecords.claim,
        source: evidenceRecords.source,
        confidence: opportunities.confidence,
        observed: evidenceRecords.observed,
      })
      .from(evidenceRecords)
      .leftJoin(opportunities, eq(opportunities.inquiryId, evidenceRecords.inquiryId))
      .orderBy(desc(evidenceRecords.createdAt))
      .limit(3);

    return {
      evidenceVerified: Number(evidence?.n ?? 0),
      sourcesTotal: Number(sources?.n ?? 0),
      opportunities: Number(opps?.n ?? 0),
      runs: Number(runs?.n ?? 0),
      agentsOnline: Number(agentsOnline?.n ?? 0),
      recent: recent.map((r) => ({
        company: r.company,
        claim: r.claim.length > 90 ? r.claim.slice(0, 87) + "…" : r.claim,
        source: r.source,
        confidence: r.confidence ?? null,
        observed: r.observed,
      })),
    };
  } catch {
    return {
      evidenceVerified: 0,
      sourcesTotal: 0,
      opportunities: 0,
      runs: 0,
      agentsOnline: 0,
      recent: [],
    };
  }
});
