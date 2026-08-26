import { createServerFn } from "@tanstack/react-start";

/**
 * Public landing-page stats. AGGREGATE ONLY — no row-level data, no recent
 * activity, nothing that reveals what buyers are searching for. Buyer
 * queries are confidential; detailed evidence lives behind sign-in in the
 * workspace, where it belongs.
 */
export const getLandingStats = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { db, ensureSchema } = await import("@/lib/db");
    const { agents, evidenceRecords, inquiries, opportunities } = await import("@/lib/db/schema");
    const { count, eq } = await import("drizzle-orm");
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

    return {
      evidenceVerified: Number(evidence?.n ?? 0),
      sourcesTotal: Number(sources?.n ?? 0),
      opportunities: Number(opps?.n ?? 0),
      runs: Number(runs?.n ?? 0),
      agentsOnline: Number(agentsOnline?.n ?? 0),
    };
  } catch {
    return { evidenceVerified: 0, sourcesTotal: 0, opportunities: 0, runs: 0, agentsOnline: 0 };
  }
});
