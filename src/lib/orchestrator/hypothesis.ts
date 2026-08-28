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

const FALLBACK_HYPOTHESES: DemandHypothesis[] = [
  {
    id: "H-HOTEL",
    label: "Hotels and hospitality",
    demandType: "lighting, chandeliers, sockets, switches, panels, wiring, generators, HVAC electrical",
    entityTypes: ["hotel", "resort", "hospitality group", "developer"],
    signals: ["new hotel construction", "hotel renovation", "hotel expansion", "hotel furnishing"],
    searchHints: ["hotel construction announced", "hotel development", "hotel renovation project"],
    whatToVerify: ["who owns the project", "construction status", "electrical contractor", "procurement window"],
  },
  {
    id: "H-CONSTRUCTION",
    label: "Construction and real estate",
    demandType: "electrical panels, wiring, lighting, sockets, switches",
    entityTypes: ["apartment development", "mall", "hospital", "school", "office building", "estate", "industrial facility"],
    signals: ["new development announced", "estate launch", "building construction"],
    searchHints: ["apartment development construction", "mall construction", "estate development"],
    whatToVerify: ["developer", "contractor", "electrical scope", "timeline"],
  },
  {
    id: "H-INFRA",
    label: "Infrastructure and electrification",
    demandType: "streetlights, solar lights, electrical infrastructure, panels",
    entityTypes: ["government", "contractor", "infrastructure project"],
    signals: ["road construction", "street-lighting project", "solar project", "electrification contract"],
    searchHints: ["street lighting project", "solar lighting tender", "electrification project"],
    whatToVerify: ["awarding authority", "contractor", "procurement still open", "project size"],
  },
  {
    id: "H-EXPANSION",
    label: "Business expansion signals",
    demandType: "appliances, lighting, electrical equipment for new branches/facilities",
    entityTypes: ["company", "retail chain", "factory", "branch"],
    signals: ["expansion announced", "new branch", "new facility", "renovation"],
    searchHints: ["company expansion", "new branch opening", "new facility announced"],
    whatToVerify: ["company owns signal", "location", "scale", "purchasing role"],
  },
];

function deterministicHypotheses(question: string): DemandHypothesis[] {
  const lower = question.toLowerCase();
  // Very small heuristic: if question mentions a category, inject it into demandType
  const inventoryHint = question.slice(0, 80);
  return FALLBACK_HYPOTHESES.map((h) => ({
    ...h,
    demandType: `${h.demandType} — likely needs ${inventoryHint} soon`,
  }));
}

const SYSTEM = `You are the hypothesis generator for a Commercial Intelligence Network.
Given the user's objective and inventory, generate 3-5 demand hypotheses.

Each hypothesis must be:
- a plausible way the inventory could be needed (not just pages containing the product name)
- tied to entity types that could have that demand
- described by observable signals (e.g. "new hotel announced", "road awarded")
- with search hints an agent could use
- and what to verify before it becomes an opportunity

Return JSON: { "hypotheses": [{ "label": string, "demandType": string, "entityTypes": string[], "signals": string[], "searchHints": string[], "whatToVerify": string[] }] }

Rules:
- demandType should be concrete: what equipment would be needed and why
- entityTypes 2-4 items
- signals 3-5 items, observable public signals
- searchHints 2-3 short queries
- whatToVerify 3-5 items
- Keep labels short (2-4 words)
- Do not invent inventory you were not given; use what the user provided`;

export async function generateHypotheses(question: string): Promise<DemandHypothesis[]> {
  const cfg = computeRouterConfig();
  if (!cfg) return deterministicHypotheses(question);
  try {
    const { json } = await chatJson<{ hypotheses?: DemandHypothesis[] }>({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Objective: ${question.slice(0, 600)}` },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });
    const list = json?.hypotheses;
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
