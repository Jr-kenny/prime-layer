import { createHash } from "node:crypto";
import { zeroGConfig, explorerLink } from "./config";

/**
 * The canonical record Prime Layer anchors to 0G Storage.
 * Every evidence claim that survives clustering can be serialized to this
 * shape; the merkle root becomes its permanent content identifier.
 */
export type AnchorableRecord = {
  kind: "evidence" | "prediction" | "settlement";
  id: string;
  agent: string;
  claim: string;
  confidence?: number | undefined;
  evidence?: { item: string; source: string; observed: string }[] | undefined;
  inquiry?: string | undefined;
  observedAt: string;
};

export type AnchorResult = {
  mode: "live" | "sandbox";
  rootHash: string;
  txHash?: string;
  explorerUrl?: string;
};

export function serializeRecord(record: AnchorableRecord): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      schema: "prime-layer.evidence/v1",
      ...record,
      anchoredAt: new Date().toISOString(),
    }),
  );
}

/** Deterministic local pre-hash — also the sandbox root so ids are stable across modes. */
export function localRoot(record: AnchorableRecord): string {
  return `0x${createHash("sha256").update(serializeRecord(record)).digest("hex")}`;
}

/**
 * One signer = one nonce stream. Concurrent uploads collide on-chain
 * ("replacement transaction underpriced"), so uploads are serialized.
 */
let uploadQueue: Promise<unknown> = Promise.resolve();
function enqueueUpload<T>(task: () => Promise<T>): Promise<T> {
  const run = uploadQueue.then(task, task);
  uploadQueue = run.catch(() => undefined);
  return run;
}

/**
 * Anchors a record to 0G Storage via MemData upload.
 *
 * Live mode requires ZERO_G_PRIVATE_KEY (funded on the target network).
 * Without it we return a sandbox anchor: the deterministic sha256 root of
 * the exact bytes that *would* be stored — honest about being local.
 */
export async function anchorRecord(record: AnchorableRecord): Promise<AnchorResult> {
  const config = zeroGConfig();

  if (!config.live) {
    return { mode: "sandbox", rootHash: localRoot(record) };
  }

  return enqueueUpload(async () => {
    const [{ Indexer, MemData }, { ethers }] = await Promise.all([
      import("@0gfoundation/0g-storage-ts-sdk"),
      import("ethers"),
    ]);

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(config.privateKey!, provider);
    const indexer = new Indexer(config.indexerRpc);

    const memData = new MemData(serializeRecord(record));
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr !== null) throw new Error(`0G merkle tree error: ${treeErr}`);

    const [tx, uploadErr] = await indexer.upload(memData, config.rpcUrl, signer);
    if (uploadErr !== null) throw new Error(`0G upload error: ${uploadErr}`);

    const rootHash = "rootHash" in tx ? tx.rootHash : (tx.rootHashes?.[0] ?? "");
    const txHash = "txHash" in tx ? tx.txHash : undefined;

    return {
      mode: "live",
      rootHash,
      ...(txHash ? { txHash } : {}),
      explorerUrl: explorerLink(txHash ? "tx" : "root", txHash ?? rootHash, config.network),
    } satisfies AnchorResult;
  });
}
