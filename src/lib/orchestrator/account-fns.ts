import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Client-facing account endpoints. Server-fn wrappers ONLY — every db /
 * secrets-touching module is imported dynamically inside handlers so this
 * file never drags Node-only code into the browser bundle.
 */

const identitySchema = z.object({
  identity: z.string().min(3).max(120),
  email: z.string().max(160).optional(),
  wallet: z.string().max(60).optional(),
});

export const getAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => identitySchema.parse(input))
  .handler(async ({ data }) => {
    const { getOrCreateAccount } = await import("./credits");
    return getOrCreateAccount(data.identity, data.email, data.wallet);
  });

const topupSchema = z.object({
  identity: z.string().min(3).max(120),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export const verifyTopup = createServerFn({ method: "POST" })
  .validator((input: unknown) => topupSchema.parse(input))
  .handler(async ({ data }) => {
    const { verifyTopupInternal } = await import("./credits");
    return verifyTopupInternal(data.identity, data.txHash);
  });

/** Exact wei price of one run + destination wallet (for eth_sendTransaction). */
export const runPriceInvoice = createServerFn({ method: "POST" }).handler(async () => {
  const { runPriceInvoice: invoice } = await import("./credits");
  return invoice();
});

const balanceSchema = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) });

/**
 * Live native-0G balance of any address (the signed-in buyer's own Privy
 * wallet). Read-only chain lookup — no keys involved.
 */
export const getWalletBalance = createServerFn({ method: "POST" })
  .validator((input: unknown) => balanceSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { ethers } = await import("ethers");
      const rpc = process.env["ZERO_G_RPC_URL"]?.trim() || "https://evmrpc-testnet.0g.ai";
      const provider = new ethers.JsonRpcProvider(rpc);
      const [balance, network] = await Promise.all([
        provider.getBalance(data.address),
        provider.getNetwork(),
      ]);
      return {
        ok: true as const,
        wei: balance.toString(),
        og: Number(ethers.formatEther(balance)),
      };
    } catch {
      return { ok: false as const, error: "Balance lookup failed." };
    }
  });
