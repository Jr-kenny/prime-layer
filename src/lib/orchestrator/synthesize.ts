import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, ensureSchema, nowIso } from "@/lib/db";
import { claims, inquiries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { chatJson, computeRouterConfig } from "@/lib/0g/compute-router";
import { sourceClusterKey } from "./grade";

/**
 * The synthesis pass — where the orchestrator thinks.
 *
 * Grading weights evidence; synthesis decides what it MEANS for this buyer:
 * - several news items about one company become ONE company;
 * - a headline is not a company name ("Stock of the Day: Buy Ola Electric"
 *   is about Ola Electric);
 * - not every signal is a recommendation — the preamble says honestly when
 *   what came back is thin;
 * - every recommendation carries the source links the client can open.
 *
 * Voice and judgment rules live in soul.md at the repo root.
 * Falls back to a deterministic merged readout if the Router is unavailable —
 * the client always gets structure, never a firehose.
 */

export type SynthesisSource = {
  label: string;
  url: string;
};

export type SynthesisRecommendation = {
  company: string;
  title: string;
  body: string;
  confidence: number;
  sources: SynthesisSource[];
};

export type Synthesis = {
  preamble: string;
  recommendations: SynthesisRecommendation[];
};

type ReadoutEntry = {
  company: string;
  confidence: number;
  claims: number;
  independentSources: number;
  topClaim: string;
  contributingAgents: string[];
};

async function loadSoul(): Promise<string> {
  try {
    return await readFile(path.join(process.cwd(), "soul.md"), "utf8");
  } catch {
    return "Talk like a person. Merge duplicate companies. Be honest when evidence is thin. Always include source links.";
  }
}

const SYSTEM = `You are the synthesis mind of Prime Layer, a B2B demand-intelligence network.
Research agents returned evidence for a buyer's question. You turn that raw material into a
recommendation readout the buyer will actually read.

Rules (enforced):
- MERGE: multiple entries about the same real-world company are ONE recommendation with one
  clean company name. Work out the real company from the headlines ("Stock of The Day: Buy Ola
  Electric" is Ola Electric, not "Stock"). Never output two recommendations for one company.
- RECOMMEND, don't list: each recommendation explains in 2-4 sentences why THIS company matters
  to THIS buyer right now, based only on the evidence given. No invented facts, no numbers that
  are not in the evidence.
- HONESTY: if the evidence is weak, thin, or off-target, say so plainly in the preamble —
  "honestly, what came back may not be entirely what you hoped" energy — then still present the
  strongest threads. Never pad.
- SOURCES: every recommendation carries 1-4 source links from its evidence. label = site or
  short description, url = the exact evidence URL.
- VOICE: plain, direct, human business language. No hashtags, no emoji, no jargon, no hype.

Respond with JSON only, exactly:
{"preamble":"<1-3 sentences setting expectations honestly>",
 "recommendations":[{"company":"<clean company name>","title":"<one-line hook>","body":"<why this company, why now, connected to the buyer's goods>","confidence":<0-100>,"sources":[{"label":"<site>","url":"<url>"}]}]}
Order recommendations strongest first. 1-6 recommendations. If nothing is recommendable, return
an empty recommendations array and explain in the preamble.`;

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(group|plc|ltd|limited|inc|corp|company|holdings)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deterministic fallback: merge same-named entries, attach real source URLs. */
function fallbackSynthesis(
  question: string,
  entries: (ReadoutEntry & { sources: SynthesisSource[] })[],
): Synthesis {
  const merged = new Map<
    string,
    { name: string; confidence: number; sources: SynthesisSource[]; claim: string }
  >();
  for (const e of entries) {
    const key = normalizeCompany(e.company) || e.company.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, e.confidence);
      for (const s of e.sources) {
        if (!existing.sources.some((x) => x.url === s.url)) existing.sources.push(s);
      }
    } else {
      merged.set(key, {
        name: e.company,
        confidence: e.confidence,
        sources: [...e.sources],
        claim: e.topClaim,
      });
    }
  }
  const recs = Array.from(merged.values())
    .sort((a, b) => b.confidence - a.confidence)
    .map((m) => ({
      company: m.name,
      title: m.claim.slice(0, 90),
      body:
        `${m.claim} This is the strongest signal the grid returned for your question — ` +
        `worth a direct look before you commit stock elsewhere.`,
      confidence: m.confidence,
      sources: m.sources.slice(0, 4),
    }));
  return {
    preamble:
      `We asked the grid about your request and clustered what came back. ` +
      `The automated writer was unavailable, so these are the clustered signals rather than a ` +
      `full written assessment — every source link is live so you can verify each one yourself.`,
    recommendations: recs,
  };
}

/** Runs after grading: writes the thought-through readout onto the inquiry. */
export async function synthesizeInquiry(inquiryId: string): Promise<void> {
  await ensureSchema();
  const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId));
  if (!inquiry?.readoutJson) return;

  const readout = JSON.parse(inquiry.readoutJson) as ReadoutEntry[];
  const claimRows = await db.select().from(claims).where(eq(claims.inquiryId, inquiryId));

  // Attach every real source URL we hold to its readout entry.
  const withSources = readout.map((entry) => {
    const key = normalizeCompany(entry.company);
    const sources: SynthesisSource[] = [];
    for (const row of claimRows) {
      const rowKey = normalizeCompany(row.company);
      if (rowKey !== key) continue;
      let evidence: { item: string; source: string }[] = [];
      try {
        evidence = JSON.parse(row.evidenceJson || "[]");
      } catch {
        continue;
      }
      for (const ev of evidence) {
        if (!ev.source) continue;
        const isUrl = /^https?:\/\//.test(ev.source);
        const url = isUrl ? ev.source : "";
        let label = "source";
        if (isUrl) {
          try {
            label = new URL(ev.source).hostname.replace(/^www\./, "");
          } catch {
            label = ev.source.slice(0, 40);
          }
        } else {
          label = ev.source.slice(0, 60);
        }
        const merged: SynthesisSource = isUrl ? { label, url } : { label, url: ev.source };
        if (
          !sources.some(
            (s) =>
              sourceClusterKey(s.url || s.label) === sourceClusterKey(merged.url || merged.label),
          )
        ) {
          sources.push(merged);
        }
      }
    }
    return { ...entry, sources: sources.slice(0, 6) };
  });

  let synthesis: Synthesis;
  const router = computeRouterConfig();
  if (!router.live) {
    synthesis = fallbackSynthesis(inquiry.question, withSources);
  } else {
    try {
      const soul = await loadSoul();
      const payload = withSources.map((e, i) => ({
        i,
        company: e.company,
        confidence: e.confidence,
        claims: e.claims,
        independent_sources: e.independentSources,
        top_claim: e.topClaim,
        sources: e.sources,
      }));
      const result = await chatJson({
        system: `${SYSTEM}\n\nVOICE AND JUDGMENT GUIDE (soul.md):\n${soul}`,
        user: `BUYER QUESTION:\n${inquiry.question}\n\nCLUSTERED EVIDENCE FROM THE GRID:\n${payload
          .map((p) => JSON.stringify(p))
          .join("\n")}`,
        maxTokens: 2400,
        temperature: 0.3,
        timeoutMs: 120_000,
      });
      const start = result.content.indexOf("{");
      const end = result.content.lastIndexOf("}");
      const parsed = JSON.parse(result.content.slice(start, end + 1)) as Synthesis;
      synthesis = {
        preamble: typeof parsed.preamble === "string" ? parsed.preamble : "",
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
              .filter((r) => r && typeof r.company === "string" && typeof r.body === "string")
              .map((r) => ({
                company: r.company,
                title: typeof r.title === "string" ? r.title : r.company,
                body: r.body,
                confidence: Number.isFinite(r.confidence) ? Math.round(r.confidence) : 60,
                sources: Array.isArray(r.sources)
                  ? r.sources.filter((s) => s && typeof s.url === "string").slice(0, 4)
                  : [],
              }))
          : [],
      };
      // Never lose the receipts: if the model dropped sources, re-attach them.
      for (const rec of synthesis.recommendations) {
        if (rec.sources.length === 0) {
          const match = withSources.find(
            (e) => normalizeCompany(e.company) === normalizeCompany(rec.company),
          );
          if (match) rec.sources = match.sources.slice(0, 4);
        }
      }
    } catch (error) {
      console.error(
        "synthesis fell back to deterministic:",
        error instanceof Error ? error.message : error,
      );
      synthesis = fallbackSynthesis(inquiry.question, withSources);
    }
  }

  await db
    .update(inquiries)
    .set({ synthesisJson: JSON.stringify(synthesis), updatedAt: nowIso() })
    .where(eq(inquiries.id, inquiryId));
}
