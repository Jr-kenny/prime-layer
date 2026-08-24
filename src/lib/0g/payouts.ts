import { zeroGConfig } from "./config";

/**
 * 0G Pay settlement — turns graded settlement lines into real on-chain
 * payouts. Native 0G flows from the platform signer (ZERO_G_PRIVATE_KEY,
 * already funded for storage gas) straight to each contributing agent's
 * wallet — pull-free, set-and-forget.
 *
 * Guards (all env-tunable):
 *   - PRIME_PAYOUT_BUDGET_OG     per-cycle payout budget (default 0.5 OG)
 *   - PRIME_MIN_PAYOUT_OG        skip shares smaller than this (dust guard,
 *                                default 0.001 OG) — unpaid rows stay pending
 *                                and scripts/retry-payouts.ts sweeps later
 *   - PRIME_GAS_RESERVE_OG       never spend the signer below this (gas headroom)
 *   - ZERO_G_PAY_DISABLED=true   kill-switch, rows stay pending
 *
 * Placeholder wallets (sample agents) and the platform's own address never
 * receive anything. A failed transfer marks the row with an error and keeps
 * going — one bad wallet can never stall a cycle's payroll.
 */

export type PayoutConfig = {
  live: boolean;
  budgetOg: number;
  minPayoutOg: number;
  gasReserveOg: number;
};

export function payoutConfig(): PayoutConfig {
  const num = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const disabled = process.env["ZERO_G_PAY_DISABLED"] === "true";
  const { privateKey } = zeroGConfig();
  return {
    live: Boolean(privateKey) && !disabled,
    budgetOg: num("PRIME_PAYOUT_BUDGET_OG", 0.5),
    minPayoutOg: num("PRIME_MIN_PAYOUT_OG", 0.001),
    gasReserveOg: num("PRIME_GAS_RESERVE_OG", 0.05),
  };
}

const PLACEHOLDER_LIMIT = 1000n;
export function isPlaceholderWallet(wallet: string): boolean {
  try {
    return BigInt(wallet) < PLACEHOLDER_LIMIT;
  } catch {
    return true;
  }
}

export type PayableLine = {
  /** settlements.id — the row to stamp with tx / error. */
  rowId: number;
  agentId: string;
  wallet: string;
  weight: number;
};

export type SettleResult = {
  attempted: { wallet: string; amountOg: string; txHash?: string; error?: string }[];
  skipped: { wallet: string; reason: string }[];
  totalPaidOg: number;
};

/** One signer = one nonce stream; serialise payroll exactly like uploads/mints. */
let payQueue: Promise<unknown> = Promise.resolve();
function enqueuePay<T>(task: () => Promise<T>): Promise<T> {
  const run = payQueue.then(task, task);
  payQueue = run.catch(() => undefined);
  return run;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Pays one cycle's lines, weight-proportional out of the budget.
 * Row updates are the caller's concern ONLY via the returned results —
 * this module is pure money movement + reporting.
 */
export async function settleCycle(
  lines: PayableLine[],
  opts?: { budgetOgOverride?: number },
): Promise<SettleResult> {
  const config = payoutConfig();
  const result: SettleResult = { attempted: [], skipped: [], totalPaidOg: 0 };
  if (!config.live || lines.length === 0) {
    for (const l of lines) result.skipped.push({ wallet: l.wallet, reason: "payouts not live" });
    return result;
  }

  return enqueuePay(async () => {
    const { ethers } = await import("ethers");
    const { privateKey, rpcUrl } = zeroGConfig();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey!, provider);
    const selfAddress = (await signer.getAddress()).toLowerCase();

    // Eligibility: real wallets, not us, above dust after proportional sizing.
    const budgetWei = ethers.parseEther(String(opts?.budgetOgOverride ?? config.budgetOg));
    const eligible = lines.filter((l) => {
      if (isPlaceholderWallet(l.wallet)) {
        result.skipped.push({ wallet: l.wallet, reason: "placeholder wallet" });
        return false;
      }
      if (l.wallet.toLowerCase() === selfAddress) {
        result.skipped.push({ wallet: l.wallet, reason: "platform's own signer" });
        return false;
      }
      return true;
    });
    const totalWeight = eligible.reduce((s, l) => s + Math.max(l.weight, 0), 0);
    if (totalWeight <= 0) {
      for (const l of eligible) result.skipped.push({ wallet: l.wallet, reason: "zero weight" });
      return result;
    }

    const sized = eligible.map((l) => ({
      ...l,
      amountOg: Number(
        ethers.formatEther(
          (budgetWei * BigInt(Math.round(Math.max(l.weight, 0) * 1e6))) /
            BigInt(Math.round(totalWeight * 1e6)),
        ),
      ),
    }));

    // Balance cap: never dip below the gas reserve.
    const balance = Number(
      ethers.formatEther(await provider.getBalance(await signer.getAddress())),
    );
    const spendable = Math.min(
      sized.reduce((s, l) => s + l.amountOg, 0),
      balance - config.gasReserveOg,
    );
    if (spendable <= 0) {
      for (const l of sized)
        result.skipped.push({
          wallet: l.wallet,
          reason: `signer balance too low (${balance.toFixed(4)} OG)`,
        });
      return result;
    }
    const plannedTotal = sized.reduce((s, l) => s + l.amountOg, 0);
    if (spendable < plannedTotal) {
      // Scale every share down proportionally to what we can afford.
      for (const l of sized) l.amountOg = round6(l.amountOg * (spendable / plannedTotal));
    }

    for (const l of sized) {
      if (l.amountOg < config.minPayoutOg) {
        result.skipped.push({
          wallet: l.wallet,
          reason: `share ${l.amountOg.toFixed(6)} OG below dust minimum ${config.minPayoutOg}`,
        });
        continue;
      }
      try {
        const tx = await signer.sendTransaction({
          to: l.wallet,
          value: ethers.parseEther(l.amountOg.toFixed(6)),
        });
        await tx.wait();
        result.attempted.push({
          wallet: l.wallet,
          amountOg: l.amountOg.toFixed(6),
          txHash: tx.hash,
        });
        result.totalPaidOg += l.amountOg;
      } catch (err) {
        result.attempted.push({
          wallet: l.wallet,
          amountOg: l.amountOg.toFixed(6),
          error: err instanceof Error ? err.message.slice(0, 200) : "transfer failed",
        });
      }
    }
    return result;
  });
}
