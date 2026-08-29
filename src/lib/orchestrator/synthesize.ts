import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, ensureSchema, nowIso } from "@/lib/db";
import { claims, inquiries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { chatJson, computeRouterConfig } from "@/lib/0g/compute-router";
import { sourceClusterKey } from "./grade";

/**
 * The synthesis pass — where the orchestrator thinks out loud to the buyer.
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
 * Falls back to deterministic merged readout if the Router is unavailable.
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

const SYSTEM = `You are the Intelligence Director of Prime Layer. You brief a busy business owner — not an analyst, not a committee — in plain, warm, spoken language. Think: how you'd explain it to them over coffee, with the receipts on the table.

Research agents returned clustered evidence for the buyer's question. You turn that into a readout the buyer will actually act on.

HARD RULES:
- MERGE: multiple entries about the same real-world company are ONE recommendation with one clean name. Work out the real company from headlines ("Stock of The Day: Buy Ola Electric" is Ola Electric, not "Stock"). Never output two recommendations for one company.
- FACT vs INFERENCE: every recommendation must separate what we FOUND (source said X on date, with link) from what it SUGGESTS (because X, they likely need Y within N months). Never present a guess as a fact. Use phrases like "We found...", "The filing says...", "This suggests...", "So you'd likely..."
- HUMAN REASONING: each body is 3-5 sentences that walk the buyer through your thinking out loud:
  1) What we found — the concrete observation with how recent it is
  2) Why it matters for THIS buyer — connect the finding to the inventory they asked about (their actual goods, not a preset category)
  3) Your take — is this high confidence or needs a check, and what you'd do next (who to contact, what to verify)
  Write it like you're speaking: "We recommend checking in with..." / "Here's why this one stands out..." / "Honestly, this is thinner than the others because...". No bullet lists inside the body, no jargon, no hype.
- HONESTY: if evidence is thin, off-target, or stale, say so plainly in the preamble — "Honestly, what came back may not be exactly what you hoped — here's why — but these are the strongest threads we found." Never pad.
- SOURCES: every recommendation carries 1-4 source links from its evidence. label = site hostname or short desc, url = exact evidence URL.
- VOICE: contractions are fine. Short paragraphs. Direct and warm. No hashtags, no emoji, no corporate robot talk. If you wouldn't say it to a person, don't write it.

Respond with JSON only, exactly:
{"preamble":"<1-3 sentences setting expectations honestly, spoken style>",
 "recommendations":[{"company":"<clean company name>","title":"<one-line hook, human>","body":"<3-5 sentences: found → suggests → take, human spoken>","confidence":<0-100>,"sources":[{"label":"<site>","url":"<url>"}]}]}
Order recommendations strongest first. 1-6 recommendations. If nothing is recommendable, return empty recommendations and explain honestly in the preamble.`;

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(group|plc|ltd|limited|inc|corp|company|holdings)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deterministic fallback: merge same-named entries, attach real source URLs, but speak like a person. */
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
  // Build a short buyer phrase without dumping raw question truncated mid-word
  const buyerPhrase = (() => {
    // Prefer a short category-ish slice; fallback to generic
    const catMatch = question.match(/We (?:have|supply|took in|sell|offer|stock)[^—–.]{0,80}/i);
    if (catMatch) return catMatch[0].replace(/^We /i, "your ").slice(0, 64).replace(/\s+\S*$/, "");
    const first = question.split(/[.?!—–]/)[0]?.trim() ?? "";
    if (first.length > 12 && first.length < 70) return first.slice(0, 64);
    return "what you're moving";
  })();
  const recs = Array.from(merged.values())
    .sort((a, b) => b.confidence - a.confidence)
    .map((m) => {
      const sourceSite = m.sources[0]?.label ?? "a source";
      // Avoid "We found that We found..." — m.claim or topClaim often already starts with "We found"
      const rawFound = m.claim.trim();
      const found = /^We found/i.test(rawFound) ? rawFound : `We found ${rawFound}`;
      // Strip double prefix if present
      const foundClean = found.replace(/^We found that We found/i, "We found").replace(/^We found that /i, "We found ");
      const titleSnippet = rawFound.replace(/^We found\s+/i, "").slice(0, 86);
      // Vary suggests/take so not every card says "build-out phase"
      const suggestsPoolHigh = [
        `That move typically pulls forward demand for ${buyerPhrase} — timing could line up if they haven't bought yet.`,
        `That kind of development usually needs ${buyerPhrase} as it progresses — worth checking where they are in procurement.`,
        `If you're selling ${buyerPhrase}, this is the sort of project that creates that need in the next quarter.`,
      ];
      const suggestsPoolLow = [
        `If you sell ${buyerPhrase}, this sort of project is where that demand shows up — worth confirming their buying window.`,
        `Projects like this tend to need ${buyerPhrase} during fit-out — check if orders are already placed.`,
        `Worth a look: similar builds have needed ${buyerPhrase} within a few months of this stage.`,
      ];
      const takePoolHigh = [
        `We'd recommend reaching out to procurement and referencing the ${sourceSite} filing — you've got a concrete reason to call.`,
        `We'd suggest a direct check-in on scale and timeline before they lock in a supplier.`,
      ];
      const takePoolLow = [
        `We'd suggest a quick check-in to confirm scale and whether they've already placed orders.`,
        `Low lift to verify — ask about remaining scope and who owns purchasing.`,
      ];
      // Deterministic pick by name hash so same company varies but not random per render
      const hash = [...m.name].reduce((a, c) => a + c.charCodeAt(0), 0);
      const suggests = (m.confidence >= 75 ? suggestsPoolHigh[hash % suggestsPoolHigh.length] : suggestsPoolLow[hash % suggestsPoolLow.length])!;
      const take = (m.confidence >= 75 ? takePoolHigh[hash % takePoolHigh.length] : takePoolLow[hash % takePoolLow.length])!;
      const body = foundClean.startsWith("We found")
        ? `${foundClean} — reported via ${sourceSite}. ${suggests} ${take}`
        : `We found ${foundClean} — reported via ${sourceSite}. ${suggests} ${take}`;
      return {
        company: m.name,
        title: titleSnippet.slice(0, 90),
        body,
        confidence: m.confidence,
        sources: m.sources.slice(0, 4),
      };
    });
  const preamble =
    recs.length === 0
      ? `We ran your request through the grid but didn't pull back anything strong enough to recommend this time — the signals were either too thin or didn't connect clearly to what you're selling.`
      : recs.length < 3
        ? `Honestly, what came back was a bit thin — fewer independent signals than we'd like — but these are the strongest threads we found that actually connect to what you're selling.`
        : `Here's what the grid surfaced for you — we've clustered everything by company and kept only the threads where the evidence and timing actually line up with what you're selling.`;
  return {
    preamble,
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
        user: `BUYER QUESTION:\n${inquiry.question}\n\nCLUSTERED EVIDENCE FROM THE GRID (each entry is one company with its strongest claim and sources):\n${payload
          .map((p) => JSON.stringify(p))
          .join("\n")}\n\nWrite the readout now. Remember to speak like a person explaining to the buyer why each company matters for THEIR inventory, not generically. Facts first, then what it suggests for them.`,
        maxTokens: 2800,
        temperature: 0.35,
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
