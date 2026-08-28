import { chatJson, computeRouterConfig } from "@/lib/0g/compute-router";

/**
 * The LLM grading pass — the orchestrator's intelligence on top of the
 * deterministic engine in grade.ts.
 *
 * What the LLM judges (per team spec, the dimensions the deterministic engine
 * cannot see):
 *   - relevance: does this claim actually answer the buyer's inquiry?
 *   - quality:   how specific, checkable and recent is the cited evidence?
 *
 * What it deliberately does NOT judge:
 *   - duplication / independence — sources are clustered deterministically,
 *     and duplicate work is honest work that still earns.
 *   - reliability — that is the internal routing signal, drifted gently over
 *     cycles, never a public score and never an LLM opinion.
 *
 * Failure posture: the Router is an refinement, not a dependency. Any error
 * (no key, timeout, bad JSON) degrades to mode "deterministic" and the cycle
 * completes with the local engine's weights untouched.
 */

export type ClaimForLlmGrade = {
  company: string;
  claim: string;
  confidence: number;
  evidence: { item: string; source: string; observed: string }[];
};

export type ClaimVerdict = {
  relevance: number; // 0..1
  quality: number; // 0..1
  note: string;
};

export type LlmGradeOutcome = {
  mode: "llm" | "deterministic";
  model: string | undefined;
  costOg: number | undefined;
  error: string | undefined;
  /** Aligned 1:1 with the input array; entries stay undefined when ungraded. */
  verdicts: (ClaimVerdict | undefined)[];
};

const SYSTEM_PROMPT = `You are the grading engine of Prime Layer, a B2B demand-intelligence network.
Independent research agents answer a buyer's inquiry (they have stock to move) with claims plus cited evidence.
You grade each claim on two dimensions only:

- relevance (0.0-1.0): will this company's situation CREATE near-term demand for what the buyer is trying to move within ~6 months?
  Wrong company type, wrong geography, or generic news that doesn't imply a purchase = low.
  Concrete expansion, construction, tender, hiring, equipment purchase that matches the buyer's category = high.
  Example: buyer sells TVs, claim "new 200-room hotel opening in Lekki" => high (needs TVs in every room). Buyer sells electricals, claim "5km new road announced" => high (needs streetlights, solar) even though headline doesn't say "buy electricals".
- quality (0.0-1.0): how strong is the supporting evidence?
  Named companies, specific numbers, dated observations, primary sources (filings, tender boards, company X/Medium posts with link) = high. Vague restatements, no clickable URL, or stale = low.

You do NOT judge duplication: several agents citing the same source is honest, correct work — the network already clusters sources deterministically.
You do NOT score agents. You grade individual claims only.

Respond with JSON only, exactly this shape:
{"grades":[{"i":<claim index>,"relevance":<0.0-1.0>,"quality":<0.0-1.0>,"note":"<max 12 words, why this matters for the buyer>"}]}
Include every claim index. Never add prose outside the JSON.`;

/** Claims per Router call — keeps prompts small and one bad batch cheap. */
const CHUNK_SIZE = 20;
const MAX_CHUNKS = 5;

function clamp01(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : Number.NaN;
  return Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
}

function buildUserPrompt(question: string, claims: ClaimForLlmGrade[], offset: number): string {
  const lines = claims.map((c, i) =>
    JSON.stringify({
      i: i + offset,
      company: c.company,
      claim: c.claim,
      agent_confidence: c.confidence,
      evidence: c.evidence.map((ev) => ({
        item: ev.item,
        source: ev.source,
        observed: ev.observed,
      })),
    }),
  );
  return `BUYER INQUIRY:\n${question}\n\nAGENT CLAIMS:\n${lines.join("\n")}`;
}

function parseVerdicts(
  raw: string,
  expectedCount: number,
  offset: number,
): (ClaimVerdict | undefined)[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    grades?: { i?: unknown; relevance?: unknown; quality?: unknown; note?: unknown }[];
  };
  const byIndex = new Map<number, ClaimVerdict>();
  for (const g of parsed.grades ?? []) {
    const i = typeof g.i === "number" ? g.i : Number.NaN;
    if (Number.isNaN(i) || i < offset || i >= offset + expectedCount) continue;
    byIndex.set(i, {
      relevance: clamp01(g.relevance),
      quality: clamp01(g.quality),
      note: typeof g.note === "string" ? g.note.slice(0, 160) : "",
    });
  }
  // Every claim in the chunk must come back; a partial answer grades nothing
  // in that chunk (callers fall back to deterministic values per claim).
  const out: (ClaimVerdict | undefined)[] = [];
  for (let i = 0; i < expectedCount; i++) out.push(byIndex.get(i + offset));
  return out;
}

/**
 * Grades all claims for one inquiry. One Router call per ~20 claims; the
 * whole grid's cycle typically costs a single small JSON completion.
 */
export async function llmGradeClaims(
  question: string,
  claims: ClaimForLlmGrade[],
): Promise<LlmGradeOutcome> {
  const config = computeRouterConfig();
  if (!config.live || claims.length === 0) {
    return {
      mode: "deterministic",
      model: undefined,
      costOg: undefined,
      error: undefined,
      verdicts: claims.map(() => undefined),
    };
  }

  const verdicts: (ClaimVerdict | undefined)[] = [];
  let costOg: number | undefined;
  const chunks = Math.min(MAX_CHUNKS, Math.ceil(claims.length / CHUNK_SIZE));

  try {
    for (let chunk = 0; chunk < chunks; chunk++) {
      const offset = chunk * CHUNK_SIZE;
      const slice = claims.slice(offset, offset + CHUNK_SIZE);
      const result = await chatJson({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(question, slice, offset),
        maxTokens: 2000,
        temperature: 0,
      });
      verdicts.push(...parseVerdicts(result.content, slice.length, offset));
      if (result.costOg !== undefined) {
        costOg = (costOg ?? 0) + result.costOg;
      }
    }
    return { mode: "llm", model: config.model, costOg, error: undefined, verdicts };
  } catch (error) {
    // Degrade, never block: deterministic weights carry the cycle.
    const message = error instanceof Error ? error.message : "LLM grading failed";
    console.error("llm-grade degraded to deterministic:", message);
    return {
      mode: "deterministic",
      model: config.model,
      costOg,
      error: message,
      verdicts: claims.map(() => undefined),
    };
  }
}
