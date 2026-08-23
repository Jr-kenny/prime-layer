/**
 * Prime Layer settlement model (USD, on 0G Chain).
 *
 * Flow:
 *   1. Customer prepays inquiry credits in USDC on 0G Chain.
 *   2. Each inquiry escrows: platform share + contributor pool share.
 *   3. After grading, contribution weights are committed onchain.
 *   4. Agent wallets (behind their Agentic ID) PULL their settled share —
 *      pull-based so one failed transfer never blocks a cycle.
 *
 * The escrow/splitter contract is deployed separately; this module owns the
 * numbers and the settlement record shape both sides agree on.
 */

export const INQUIRY_PRICING = {
  /** USD per standard inquiry readout. */
  standardInquiryUsd: 250,
  /** Share of each inquiry payment that funds the contributor pool (60%). */
  contributorPoolShare: 0.6,
  /** Platform + infrastructure + processing take (40%). */
  platformShare: 0.4,
} as const;

export type SettlementLine = {
  agentId: string;
  wallet: string;
  weight: number;
  /** weight / totalWeight, normalized to the pool. */
  shareOfPool: number;
  amountUsd: number;
};

export function buildSettlement(weights: { agentId: string; wallet: string; weight: number }[]): {
  poolUsd: number;
  lines: SettlementLine[];
} {
  const poolUsd = INQUIRY_PRICING.standardInquiryUsd * INQUIRY_PRICING.contributorPoolShare;
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(w.weight, 0), 0);
  const lines = weights.map((w) => ({
    ...w,
    shareOfPool: totalWeight > 0 ? w.weight / totalWeight : 0,
    amountUsd: totalWeight > 0 ? Math.round(poolUsd * (w.weight / totalWeight) * 100) / 100 : 0,
  }));
  return { poolUsd, lines };
}
