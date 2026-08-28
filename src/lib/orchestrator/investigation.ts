import type { DemandHypothesis } from "./hypothesis";

export type InvestigationState = {
  objective: string;
  inventoryHint: string;
  hypotheses: DemandHypothesis[];
  entities: { name: string; type: string; source?: string }[];
  evidence: { company: string; claim: string; source: string; observed: string }[];
  openQuestions: string[];
  tasks: { id: string; agent: string; objective: string; dependsOn?: string }[];
  confidence: number;
  createdAt: string;
};

export function buildInitialInvestigation(question: string, hypotheses: DemandHypothesis[]): InvestigationState {
  const inventoryHint = question.slice(0, 120);
  return {
    objective: question,
    inventoryHint,
    hypotheses,
    entities: [],
    evidence: [],
    openQuestions: hypotheses.flatMap((h) => h.whatToVerify).slice(0, 10),
    tasks: hypotheses.slice(0, 4).map((h, i) => ({
      id: `T-${i + 1}`,
      agent: ["web-research", "project-intel", "social-signal", "procurement"][i % 4]!,
      objective: `Investigate: ${h.label} — ${h.signals[0] ?? h.demandType}`,
    })),
    confidence: 0,
    createdAt: new Date().toISOString(),
  };
}
