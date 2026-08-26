import { db, ensureSchema, nowIso, newId } from "@/lib/db";
import {
  agents,
  dispatchAcks,
  inquiries,
  claims,
  creditLedger,
  evidenceRecords,
  opportunities,
  settlements,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { INQUIRY_PRICING } from "@/lib/0g/payments";
import {
  gradeClaims,
  sourceClusterKey,
  clamp01,
  round2,
  round4,
  type SubmittedClaim,
} from "./grade";
import { llmGradeClaims } from "./llm-grade";
import { buildSettlement, splitPayment } from "@/lib/0g/payments";
import { settleCycle } from "@/lib/0g/payouts";
import { synthesizeInquiry } from "./synthesize";
import { anchorRecord } from "@/lib/0g/evidence-anchor";

/**
 * Sourcing window: how long the grid stays open for claims after dispatch.
 * Default 5 minutes for quick cycles; set PRIME_SOURCING_WINDOW_SECONDS up to
 * 3600 (1 hour) when deep research is worth waiting for. The readout is
 * anchored to 0G Storage either way, so clients always get a permanent copy.
 */
export const SOURCING_WINDOW_SECONDS = Math.min(
  3600,
  Math.max(60, Number(process.env["PRIME_SOURCING_WINDOW_SECONDS"] ?? 90)),
);

export type ResearchCommand = {
  command_id: string;
  inquiry_id: string;
  question: string;
  scope: { category?: string; geography?: string };
  window_seconds: number;
  submit_url: string;
};

/**
 * The grid has no taxonomy. Every online agent receives every command —
 * whether the inquiry fits is the agent's own intelligent decision, made
 * where its knowledge lives. Declining is normal and free.
 */
export function agentsOnGrid(all: { id: string; status: string; endpoint: string }[]) {
  return all.filter((agent) => agent.status === "online");
}

async function dispatchToAgent(endpoint: string, command: ResearchCommand): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function extractScope(question: string): { category?: string; geography?: string } {
  const geoMatch = question.match(
    /\b(nigeria|ghana|kenya|south africa|egypt|germany|africa|lagos|europe|us|usa)\b/i,
  );
  const category = question
    .replace(/^i\s+(sell|have|offer)\s+/i, "")
    .split(/[.?!]/)[0]
    ?.slice(0, 80);
  return {
    ...(category ? { category } : {}),
    ...(geoMatch?.[0] ? { geography: geoMatch[0] } : {}),
  };
}

/**
 * Full inquiry lifecycle. Fire-and-forget from the request path:
 * dispatch → collect (bounded window) → grade → synthesize → settle.
 */
export async function runInquiry(inquiryId: string, submitUrl: string) {
  try {
    const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId));
    if (!inquiry) return;

    const scope = extractScope(inquiry.question);
    await db
      .update(inquiries)
      .set({
        category: scope.category ?? null,
        geography: scope.geography ?? null,
        status: "dispatching",
        updatedAt: nowIso(),
      })
      .where(eq(inquiries.id, inquiryId));

    await ensureSchema();
    const allAgents = await db.select().from(agents);
    const dispatched = agentsOnGrid(allAgents);

    // agentsMatched now means "agents the command went out to" — the whole
    // online grid. Selection is the agents' job, not ours.
    await db
      .update(inquiries)
      .set({ agentsMatched: dispatched.length, updatedAt: nowIso() })
      .where(eq(inquiries.id, inquiryId));

    if (dispatched.length === 0) {
      await db
        .update(inquiries)
        .set({
          status: "complete",
          readoutJson: JSON.stringify([]),
          error: "No agents are on the grid yet.",
          updatedAt: nowIso(),
        })
        .where(eq(inquiries.id, inquiryId));
      return;
    }

    const dispatchedAt = nowIso();
    const windowClosesAt = new Date(Date.now() + SOURCING_WINDOW_SECONDS * 1000).toISOString();

    // Open the collection window BEFORE commands go out — fast agents may
    // submit within milliseconds of receiving the command.
    await db
      .update(inquiries)
      .set({
        status: "collecting",
        dispatchedAt,
        windowClosesAt,
        updatedAt: nowIso(),
      })
      .where(eq(inquiries.id, inquiryId));

    const command: ResearchCommand = {
      command_id: newId("CMD"),
      inquiry_id: inquiryId,
      question: inquiry.question,
      scope,
      window_seconds: SOURCING_WINDOW_SECONDS,
      submit_url: submitUrl,
    };

    const results = await Promise.allSettled(
      dispatched.map((agent) => dispatchToAgent(agent.endpoint, command)),
    );
    results.forEach((r, i) => {
      const agent = dispatched[i]!;
      const ok = r.status === "fulfilled" && r.value;
      void db
        .update(agents)
        .set({ status: ok ? "online" : "offline", lastSeen: nowIso() })
        .where(eq(agents.id, agent.id));
    });

    // Bounded collection loop — early-exit when every dispatched agent has
    // responded (claims, an explicit decline, or silence until the window closes).
    const deadline = Date.now() + SOURCING_WINDOW_SECONDS * 1000;
    const dispatchedIds = dispatched.map((a) => a.id);
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const [responded, acks] = await Promise.all([
        db.select({ agentId: claims.agentId }).from(claims).where(eq(claims.inquiryId, inquiryId)),
        db
          .select({ agentId: dispatchAcks.agentId })
          .from(dispatchAcks)
          .where(eq(dispatchAcks.inquiryId, inquiryId)),
      ]);
      const respondedIds = new Set([
        ...responded.map((r) => r.agentId),
        ...acks.map((a) => a.agentId),
      ]);
      if (dispatchedIds.every((id) => respondedIds.has(id))) break;
    }

    await gradeAndSynthesize(inquiryId);
  } catch (error) {
    await db
      .update(inquiries)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Orchestrator failure",
        updatedAt: nowIso(),
      })
      .where(eq(inquiries.id, inquiryId));
  }
}

/**
 * Anchors one demand-graph opportunity to 0G Storage (fire-and-forget) and
 * stamps the merkle root / tx back onto its row. The dossier's permanent copy.
 */
function anchorOpportunity(opportunityId: string) {
  void (async () => {
    const [row] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId));
    if (!row) return;
    const result = await anchorRecord({
      kind: "opportunity",
      id: row.id,
      agent: "prime-orchestrator",
      claim: `${row.company}: ${row.need} @ ${Math.round(row.confidence)}% (${row.status})`,
      confidence: row.confidence,
      evidence: [
        {
          item: row.summary,
          source: `prime-layer://opportunity/${row.id}`,
          observed: nowIso().slice(0, 10),
        },
      ],
      ...(row.inquiryId ? { inquiry: row.inquiryId } : {}),
      observedAt: nowIso().slice(0, 10),
    });
    await db
      .update(opportunities)
      .set({
        anchorRoot: result.rootHash,
        ...(result.txHash ? { anchorTx: result.txHash } : {}),
      })
      .where(eq(opportunities.id, opportunityId));
  })().catch((err) => console.error(`opportunity anchor failed (${opportunityId}):`, err));
}

export async function gradeAndSynthesize(inquiryId: string) {
  await ensureSchema();
  const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId));
  if (!inquiry) return;

  await db
    .update(inquiries)
    .set({ status: "grading", updatedAt: nowIso() })
    .where(eq(inquiries.id, inquiryId));

  const rawRows = await db.select().from(claims).where(eq(claims.inquiryId, inquiryId));
  const agentRows = await db
    .select()
    .from(agents)
    .where(
      inArray(
        agents.id,
        rawRows.map((r) => r.agentId),
      ),
    );

  const agentMap = Object.fromEntries(
    agentRows.map((a) => [a.id, { id: a.id, reliability: a.reliability }]),
  );

  const submitted = rawRows.map((row) => ({
    agentId: row.agentId,
    company: row.company,
    claim: row.claim,
    confidence: row.confidence,
    evidence: JSON.parse(row.evidenceJson) as SubmittedClaim["evidence"],
  }));

  const { graded, totalClusters } = gradeClaims({ claims: submitted, agents: agentMap });

  // The orchestrator's intelligence pass: an LLM through the 0G Compute Router
  // judges relevance (does this claim answer THIS buyer?) and evidence quality
  // (specific, dated, checkable sources?). It never judges duplication —
  // clusters already handled that deterministically — and never scores agents:
  // reliability stays an internal routing signal drifted gently over cycles.
  // Without a router key — or if the Router errors — the cycle completes on
  // local weights alone and nothing blocks.
  const llm = await llmGradeClaims(
    inquiry.question,
    graded.map((g) => ({
      company: g.company,
      claim: g.claim,
      confidence: g.confidence,
      evidence: g.evidence,
    })),
  );
  if (llm.mode === "llm") {
    graded.forEach((g, i) => {
      const v = llm.verdicts[i];
      if (!v) return;
      // Blend, don't replace: the agent's own confidence stays half of the
      // quality dimension, and the recomputed weight carries a small floor so
      // one model's opinion can never zero out honest work outright.
      g.dims.relevance = round2(clamp01(v.relevance));
      g.dims.quality = round2(Math.min(1, (clamp01(g.dims.quality) + clamp01(v.quality)) / 2));
      g.weight = round4(
        Math.max(
          0.05,
          g.dims.relevance *
            g.dims.quality *
            g.dims.independence *
            g.dims.reliability *
            g.dims.impact,
        ),
      );
    });
  }
  const llmNotes = new Map<string, string>(
    llm.mode === "llm"
      ? graded.flatMap((g, i) => {
          const v = llm.verdicts[i];
          return v?.note ? [[`${g.agentId}:${g.claim}`, v.note] as const] : [];
        })
      : [],
  );

  // Reliability is an INTERNAL routing signal — how the orchestrator decides
  // whose results to read first when the grid is large. It is never a public
  // score and never a trust gate: every agent is equal on the grid, and
  // duplication is honest work, not an offence. Drift is gentle (±0.01 per
  // cycle) and bounded so no agent is ever degraded into a second class.
  const tierByAgent = new Map<
    string,
    { discovery: number; confirmation: number; duplication: number }
  >();
  for (const g of graded) {
    const entry = tierByAgent.get(g.agentId) ?? { discovery: 0, confirmation: 0, duplication: 0 };
    entry[g.tier] += 1;
    tierByAgent.set(g.agentId, entry);
  }
  for (const [agentId, tiers] of tierByAgent) {
    const current = agentMap[agentId]?.reliability ?? 0.8;
    const total = tiers.discovery + tiers.confirmation + tiers.duplication;
    const discoveryRatio = total > 0 ? tiers.discovery / total : 0;
    const delta = discoveryRatio > 0.5 ? 0.01 : discoveryRatio === 0 && total > 0 ? -0.01 : 0;
    const next = Math.min(0.99, Math.max(0.5, current + delta));
    if (next !== current) {
      await db.update(agents).set({ reliability: next }).where(eq(agents.id, agentId));
    }
  }

  // Persist grades + canonical evidence records, each anchored to 0G Storage.
  for (const g of graded) {
    await db
      .update(claims)
      .set({
        tier: g.tier,
        weight: g.weight,
        dimsJson: JSON.stringify(g.dims),
        gradeMode: llm.mode,
        llmNote: llmNotes.get(`${g.agentId}:${g.claim}`) ?? null,
      })
      .where(
        eq(claims.id, rawRows.find((r) => r.agentId === g.agentId && r.claim === g.claim)!.id),
      );

    for (const ev of g.evidence) {
      const evidenceId = newId("EV");
      const agentName = agentRows.find((a) => a.id === g.agentId)?.name ?? g.agentId;
      await db
        .insert(evidenceRecords)
        .values({
          id: evidenceId,
          company: g.company,
          claim: ev.item,
          source: ev.source,
          sourceType: "agent submission",
          agent: agentName,
          observed: ev.observed,
          status: "verified",
          inquiryId,
          createdAt: nowIso(),
        })
        .onConflictDoNothing();

      // Fire-and-forget anchor — DB row keeps the pointer once settled.
      void anchorRecord({
        kind: "evidence",
        id: evidenceId,
        agent: agentName,
        claim: `${g.company}: ${ev.item}`,
        confidence: g.confidence,
        evidence: [ev],
        ...(inquiry?.id ? { inquiry: inquiry.id } : {}),
        observedAt: ev.observed,
      })
        .then((result) =>
          db
            .update(evidenceRecords)
            .set({
              anchorRoot: result.rootHash,
              ...(result.txHash ? { anchorTx: result.txHash } : {}),
            })
            .where(eq(evidenceRecords.id, evidenceId)),
        )
        .catch((err) => console.error("anchor failed:", err));
    }
  }

  // Synthesize the readout: group by company, weight-scaled confidence.
  const byCompany = new Map<string, typeof graded>();
  for (const g of graded) {
    if (!byCompany.has(g.company)) byCompany.set(g.company, []);
    byCompany.get(g.company)!.push(g);
  }

  const readout = Array.from(byCompany.entries())
    .map(([company, list]) => {
      const totalWeight = list.reduce((sum, c) => sum + c.weight, 0);
      const confidence =
        totalWeight > 0
          ? Math.round(
              (list.reduce((sum, c) => sum + c.confidence * c.weight, 0) / totalWeight) * 100,
            )
          : 0;
      const clusters = new Set(
        list.flatMap((c) => c.evidence.map((e) => sourceClusterKey(e.source))),
      );
      return {
        company,
        confidence,
        claims: list.length,
        independentSources: clusters.size,
        topClaim: list.sort((a, b) => b.weight - a.weight)[0]!.claim,
        contributingAgents: Array.from(new Set(list.map((c) => c.agentId))),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  // Upsert opportunities so dossiers resolve for real companies. One living
  // record per company: later cycles refresh confidence, need and status
  // instead of piling up duplicate rows. Every write is anchored to 0G
  // Storage — the demand graph survives the database.
  for (const entry of readout) {
    const existing = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.company, entry.company))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      const best = Math.max(row.confidence, entry.confidence);
      await db
        .update(opportunities)
        .set({
          need: entry.topClaim,
          summary: entry.topClaim,
          confidence: best,
          status: best >= 80 ? "verified" : row.status === "verified" ? "verified" : "open",
          inquiryId,
        })
        .where(eq(opportunities.id, row.id));
      void anchorOpportunity(row.id);
      continue;
    }

    const oppId = newId("OPP");
    await db.insert(opportunities).values({
      id: oppId,
      company: entry.company,
      need: entry.topClaim,
      summary: entry.topClaim,
      confidence: entry.confidence,
      status: entry.confidence >= 80 ? "verified" : "open",
      inquiryId,
      evidenceIdsJson: JSON.stringify([]),
      createdAt: nowIso(),
    });
    void anchorOpportunity(oppId);
  }

  // The contributor pool is the REAL payment the buyer made for this
  // inquiry (from the credit_ledger run_payment row), split 60/40. Free and
  // guest runs have no payment row — the platform funds their pool at the
  // standard price so agents still earn.
  let poolUsd = INQUIRY_PRICING.standardInquiryUsd * INQUIRY_PRICING.contributorPoolShare;
  const [payment] = await db
    .select()
    .from(creditLedger)
    .where(and(eq(creditLedger.inquiryId, inquiryId), eq(creditLedger.kind, "run_payment")));
  if (payment && Number(payment.paidOg ?? 0) > 0) {
    poolUsd = splitPayment(Number(payment.paidOg)).poolUsd;
  }
  const weightTotal = graded.reduce((s, g) => s + g.weight, 0);
  const settlementLines: { agentId: string; wallet: string; weight: number; amountUsd: number }[] =
    [];
  if (weightTotal > 0 && poolUsd > 0) {
    const insertedRowIds: number[] = [];
    for (const g of graded) {
      const wallet = agentRows.find((a) => a.id === g.agentId)?.wallet;
      if (!wallet) continue;
      const amountUsd = Math.round(poolUsd * (g.weight / weightTotal) * 100) / 100;
      settlementLines.push({ agentId: g.agentId, wallet, weight: g.weight, amountUsd });
      const [row] = await db
        .insert(settlements)
        .values({
          inquiryId,
          agentId: g.agentId,
          wallet,
          weight: g.weight,
          amountUsd,
          createdAt: nowIso(),
        })
        .returning({ id: settlements.id });
      if (row) insertedRowIds.push(row.id);
    }

    // 0G Pay — real native-token payouts from the platform signer, split by
    // weight within the per-cycle budget. Fire-and-forget: a slow or failed
    // payroll never delays the readout; rows keep the state (paid_og /
    // payout_tx / payout_error) and scripts/retry-payouts.ts sweeps stragglers.
    if (insertedRowIds.length > 0) {
      void settleCycle(
        settlementLines.map((l, i) => ({
          rowId: insertedRowIds[i]!,
          agentId: l.agentId,
          wallet: l.wallet,
          weight: l.weight,
        })),
      )
        .then(async (result) => {
          for (const a of result.attempted) {
            await db
              .update(settlements)
              .set(
                a.txHash
                  ? { paidOg: Number(a.amountOg), payoutTx: a.txHash, payoutError: null }
                  : { payoutError: a.error ?? "unknown payout failure" },
              )
              .where(inArray(settlements.id, a.rowIds));
          }
          const skippedNote = result.skipped.length ? ` (${result.skipped.length} skipped)` : "";
          console.log(
            `payouts settled for ${inquiryId}: ${result.totalPaidOg.toFixed(6)} OG across ` +
              `${result.attempted.filter((a) => a.txHash).length} transfers${skippedNote}`,
          );
        })
        .catch((err) => console.error("payout pass failed:", err));
    }
  }

  if (settlementLines.length > 0) {
    void anchorRecord({
      kind: "settlement",
      id: inquiryId,
      agent: "prime-orchestrator",
      claim: `Cycle settlement · ${settlementLines.length} agents · ${settlementLines
        .reduce((s, l) => s + l.amountUsd, 0)
        .toFixed(2)} USD distributed`,
      evidence: settlementLines.map((l) => ({
        item: `${l.agentId} weight ${l.weight.toFixed(4)} → $${l.amountUsd.toFixed(2)}`,
        source: "prime-layer://settlements",
        observed: nowIso().slice(0, 10),
      })),
      observedAt: nowIso().slice(0, 10),
    })
      .then((result) =>
        db
          .update(settlements)
          .set({ tx: result.txHash ?? result.rootHash })
          .where(eq(settlements.inquiryId, inquiryId)),
      )
      .catch((err) => console.error("settlement anchor failed:", err));
  }

  await db
    .update(inquiries)
    .set({
      status: "complete",
      claimsReceived: graded.length,
      sourcesClustered: totalClusters,
      gradeMode: llm.mode,
      gradeCostOg: llm.costOg ?? null,
      gradeError: llm.error ?? null,
      readoutJson: JSON.stringify(readout),
      updatedAt: nowIso(),
    })
    .where(eq(inquiries.id, inquiryId));

  // Synthesis — the orchestrator thinks before the client sees anything:
  // merges the same company into one entry, decides what is actually a
  // recommendation, writes the readout in the soul's voice with source links.
  try {
    await synthesizeInquiry(inquiryId);
  } catch (err) {
    console.error("synthesis failed (readout kept):", err);
  }

  // Anchor the cycle snapshot — the public, verifiable record of this run.
  void anchorRecord({
    kind: "prediction",
    id: inquiryId,
    agent: "prime-orchestrator",
    claim: `Cycle readout · ${readout.length} companies · ${totalClusters} source clusters`,
    evidence: readout.map((entry) => ({
      item: `${entry.company} @ ${entry.confidence}% (${entry.independentSources} sources)`,
      source: `prime-layer://inquiry/${inquiryId}`,
      observed: nowIso().slice(0, 10),
    })),
    observedAt: nowIso().slice(0, 10),
  })
    .then((result) =>
      db
        .update(inquiries)
        .set({
          readoutAnchorRoot: result.rootHash,
          ...(result.txHash ? { readoutAnchorTx: result.txHash } : {}),
        })
        .where(eq(inquiries.id, inquiryId)),
    )
    .catch((err) => console.error("readout anchor failed:", err));
}
