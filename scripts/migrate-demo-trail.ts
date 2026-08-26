// One-off: migrate the latest complete run's full trail to Turso for the live demo.
import { createClient } from "@libsql/client";

let token = "";
for (const l of require("node:fs").readFileSync(".env", "utf8").split("\n")) {
  if (l.startsWith("DATABASE_AUTH_TOKEN")) token = l.split("=").slice(1).join("=").trim();
}
const local = createClient({ url: "file:./prime-layer.db" });
const remote = createClient({
  url: "libsql://prime-layer-jr-kenny.aws-eu-west-1.turso.io",
  authToken: token,
});

async function copyTable(table, cols, limit) {
  const rows = await local.execute(
    `SELECT ${cols.join(",")} FROM ${table}` +
      (limit ? ` ORDER BY created_at DESC LIMIT ${limit}` : ""),
  );
  const placeholders = cols.map((_, i) => `?${i + 1}`).join(",");
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
  for (const row of rows.rows) {
    await remote.execute({ sql, args: cols.map((c) => row[c]) });
  }
  console.log(`${table}: ${rows.rows.length}`);
}

await copyTable(
  "inquiries",
  [
    "id",
    "identity",
    "question",
    "category",
    "geography",
    "status",
    "agents_matched",
    "claims_received",
    "sources_clustered",
    "contradictions",
    "readout_json",
    "error",
    "created_at",
    "updated_at",
    "readout_anchor_root",
    "readout_anchor_tx",
    "grade_mode",
    "grade_cost_og",
    "grade_error",
    "synthesis_json",
  ],
  5,
);
await copyTable(
  "evidence_records",
  [
    "id",
    "company",
    "claim",
    "source",
    "source_type",
    "agent",
    "observed",
    "status",
    "note",
    "anchor_root",
    "anchor_tx",
    "inquiry_id",
    "created_at",
  ],
  80,
);
await copyTable(
  "opportunities",
  [
    "id",
    "company",
    "need",
    "summary",
    "confidence",
    "status",
    "window",
    "size",
    "evidence_ids_json",
    "inquiry_id",
    "anchor_root",
    "anchor_tx",
    "created_at",
  ],
  30,
);
await copyTable(
  "settlements",
  ["id", "inquiry_id", "agent_id", "wallet", "weight", "amount_usd", "tx", "created_at", "paid_og", "payout_tx", "payout_error"],
  20,
);
await copyTable("credit_ledger", ["id", "account_id", "delta", "kind", "tx_hash", "inquiry_id", "paid_og", "created_at"], 50);
console.log("demo data migrated");
