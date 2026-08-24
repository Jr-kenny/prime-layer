/**
 * Retry pending 0G Pay payouts — sweeps settlement rows that were skipped
 * (dust, low balance) or failed, and re-attempts them.
 *
 *   bun run scripts/retry-payouts.ts            # sweep everything pending
 *   bun run scripts/retry-payouts.ts --dry      # preview only
 *   DRY_RUN=true bun run scripts/retry-payouts.ts
 *
 * Rows already stamped with payout_tx are never touched. Budget for the sweep
 * comes from PRIME_PAYOUT_BUDGET_OG (same as cycles) unless PRIME_RETRY_BUDGET_OG
 * is set. Each retried row is paid at its original weight share of the budget.
 */
import { db, ensureSchema } from "../src/lib/db";
import { settlements } from "../src/lib/db/schema";
import { isNull, and, eq, inArray } from "drizzle-orm";
import { payoutConfig, settleCycle, type PayableLine } from "../src/lib/0g/payouts";

await ensureSchema();

const config = payoutConfig();
if (!config.live) {
  console.error("0G Pay not live — set ZERO_G_PRIVATE_KEY; unset ZERO_G_PAY_DISABLED to enable.");
  process.exit(1);
}

const dry = process.argv.includes("--dry") || process.env.DRY_RUN === "true";

const pending = await db
  .select()
  .from(settlements)
  .where(and(isNull(settlements.paidOg), isNull(settlements.payoutTx)));
// payout_error is diagnostic, not disqualifying — failed rows are the point.
const retryable = pending;
console.log(`${pending.length} pending payout rows, ${retryable.length} retryable`);

if (retryable.length === 0 || dry) {
  if (dry) {
    for (const r of retryable) console.log(`[dry] would pay ${r.wallet} (weight ${r.weight})`);
  }
  console.log("nothing to do.");
  process.exit(0);
}

// Group by inquiry so each cycle's payroll keeps its own weight proportions.
const byInquiry = new Map<string, typeof retryable>();
for (const r of retryable) {
  const list = byInquiry.get(r.inquiryId) ?? [];
  list.push(r);
  byInquiry.set(r.inquiryId, list);
}

const budgetOg = Number(process.env.PRIME_RETRY_BUDGET_OG) || config.budgetOg;
let totalPaid = 0;

for (const [inquiryId, rows] of byInquiry) {
  const lines: PayableLine[] = rows.map((r) => ({
    rowId: r.id,
    agentId: r.agentId,
    wallet: r.wallet,
    weight: r.weight,
  }));
  const result = await settleCycle(lines, { budgetOgOverride: budgetOg });
  for (const a of result.attempted) {
    if (a.txHash) {
      await db
        .update(settlements)
        .set({ paidOg: Number(a.amountOg), payoutTx: a.txHash, payoutError: null })
        .where(inArray(settlements.id, a.rowIds));
      console.log(
        `✓ ${a.wallet} ${a.amountOg} OG (${a.rowIds.length} rows) → ${a.txHash.slice(0, 18)}…`,
      );
      totalPaid += Number(a.amountOg);
    } else {
      await db
        .update(settlements)
        .set({ payoutError: a.error ?? "unknown payout failure" })
        .where(inArray(settlements.id, a.rowIds));
      console.error(`✗ ${a.wallet}: ${a.error}`);
    }
  }
  for (const s of result.skipped) {
    console.log(`- skipped ${s.wallet}: ${s.reason}`);
  }
}

console.log(`retry sweep done — ${totalPaid.toFixed(6)} OG paid.`);
process.exit(0);
