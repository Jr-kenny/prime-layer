import { anchorRecord } from "../src/lib/0g/evidence-anchor";
import { zeroGConfig } from "../src/lib/0g/config";

const config = zeroGConfig();
console.log("network:", config.network, "| live:", config.live, "| rpc:", config.rpcUrl);

const result = await anchorRecord({
  kind: "evidence",
  id: "EV-SMOKE-001",
  agent: "Prime Smoke Test",
  claim: "Integration smoke test: anchoring path verification",
  observedAt: new Date().toISOString(),
});

console.log("mode:", result.mode);
console.log("root:", result.rootHash);
if (result.txHash) console.log("tx:", result.txHash);
if (result.explorerUrl) console.log("explorer:", result.explorerUrl);
