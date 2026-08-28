import { chatJson, computeRouterConfig } from "@/lib/0g/compute-router";

export type DemandHypothesis = {
  id: string;
  label: string;
  demandType: string;
  entityTypes: string[];
  signals: string[];
  searchHints: string[];
  whatToVerify: string[];
};

/**
 * Generic fallback hypotheses — used when the LLM is unavailable.
 * These are intentionally inventory-agnostic. The actual inventory from the
 * buyer's question is woven into demandType + searchHints at runtime so
 * no business vertical is privileged (electrical, pharma, packaging, etc. all work).
 */
const GENERIC_TEMPLATES: Omit<DemandHypothesis, "demandType" | "searchHints">[] = [
  {
    id: "H-NEW-SITES",
    label: "New sites & construction",
    entityTypes: ["developer", "contractor", "operator"],
    signals: ["new facility announced", "construction started", "project permit filed", "site under development"],
    whatToVerify: ["who owns the project", "location and scale", "construction status", "procurement window"],
  },
  {
    id: "H-EXPANSION",
    label: "Expansion & new capacity",
    entityTypes: ["company", "retail chain", "factory", "branch network"],
    signals: ["expansion announced", "new branch or store opening", "new plant or warehouse commissioned", "hiring surge for new site"],
    whatToVerify: ["company owns signal", "geography and timeline", "scale of rollout", "purchasing contact"],
  },
  {
    id: "H-PROJECTS",
    label: "Infrastructure & large projects",
    entityTypes: ["government", "project owner", "EPC contractor", "consortium"],
    signals: ["tender issued", "contract awarded", "infrastructure programme launched", "public-private partnership announced"],
    whatToVerify: ["awarding authority", "prime contractor", "budget and scope", "procurement still open"],
  },
  {
    id: "H-REFRESH",
    label: "Refurbishment & replacement",
    entityTypes: ["facility operator", "property group", "industrial plant"],
    signals: ["renovation announced", "refurbishment underway", "modernization programme", "compliance-driven upgrade"],
    whatToVerify: ["asset being refurbished", "scope of replacement", "timeline", "decision maker"],
  },
];

function inventoryHintFromQuestion(question: string): string {
  // Keep it short and human — what the buyer says they have to move.
  const cleaned = question.replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned || "the buyer's inventory";
}

function topicsFromQuestion(question: string): string[] {
  const stop = new Set(
    "a an and are as at be been by for find from has have how i in into is it its me my of on or our sell selling show that the their them they this to us want was we what which who will with you your".split(
      " ",
    ),
  );
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w) && !/^\d+$/.test(w))
    .slice(0, 4);
}

function deterministicHypotheses(question: string): DemandHypothesis[] {
  const hint = inventoryHintFromQuestion(question);
  const topics = topicsFromQuestion(question);
  const topicSuffix = topics.length ? topics.slice(0, 2).join(" ") : "";
  // Turn generic templates into inventory-aware hypotheses without hardcoding any vertical.
  return GENERIC_TEMPLATES.map((t) => {
    const baseHints = t.signals.slice(0, 2).map((s) => (topicSuffix ? `${s} ${topicSuffix}` : s));
    return {
      ...t,
      demandType: `${t.label.toLowerCase()} — likely needs ${hint} as sites expand or refurbish`,
      searchHints: baseHints,
    };
  });
}

const SYSTEM = `You are the hypothesis generator for a Commercial Intelligence Network.
Given the user's objective and inventory, generate 3-5 demand hypotheses.

Each hypothesis must be:
- a plausible way the inventory could be needed (not just pages containing the product name)
- tied to entity types that could have that demand
- described by observable signals (e.g. "new facility announced", "tender awarded", "hiring surge")
- with search hints an agent could use
- and what to verify before it becomes an opportunity

Return JSON: { "hypotheses": [{ "label": string, "demandType": string, "entityTypes": string[], "signals": string[], "searchHints": string[], "whatToVerify": string[] }] }

Rules:
- demandType should be concrete: what equipment/material/service would be needed and why — derived from the buyer's actual inventory, not a preset category
- entityTypes 2-4 items
- signals 3-5 items, observable public signals
- searchHints 2-3 short queries an agent can run verbatim
- whatToVerify 3-5 items
- Keep labels short (2-4 words)
- Do not invent inventory you were not given; use what the user provided
- Do not default to hotels/electricals — adapt to the inventory in the objective`;

export async function generateHypotheses(question: string): Promise<DemandHypothesis[]> {
  const cfg = computeRouterConfig();
  if (!cfg.live) return deterministicHypotheses(question);
  try {
    const { content } = await chatJson({
      system: SYSTEM,
      user: `Objective: ${question.slice(0, 600)}`,
      maxTokens: 2500,
      temperature: 0.4,
    });
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    const parsed = JSON.parse(content.slice(start, end + 1)) as { hypotheses?: DemandHypothesis[] };
    const list = parsed?.hypotheses;
    if (!Array.isArray(list) || list.length < 2) return deterministicHypotheses(question);
    return list.slice(0, 5).map((h, i) => ({
      id: `H-${i + 1}`,
      label: String(h.label ?? `Hypothesis ${i + 1}`).slice(0, 60),
      demandType: String(h.demandType ?? "").slice(0, 200),
      entityTypes: (Array.isArray(h.entityTypes) ? h.entityTypes : []).map((s) => String(s).slice(0, 60)).slice(0, 4),
      signals: (Array.isArray(h.signals) ? h.signals : []).map((s) => String(s).slice(0, 80)).slice(0, 5),
      searchHints: (Array.isArray(h.searchHints) ? h.searchHints : []).map((s) => String(s).slice(0, 80)).slice(0, 3),
      whatToVerify: (Array.isArray(h.whatToVerify) ? h.whatToVerify : []).map((s) => String(s).slice(0, 80)).slice(0, 5),
    }));
  } catch {
    return deterministicHypotheses(question);
  }
}
