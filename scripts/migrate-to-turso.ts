// One-off: migrate core data from local SQLite to Turso (production DB).
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

async function copyTable(table, cols) {
  const rows = await local.execute(`SELECT ${cols.join(",")} FROM ${table}`);
  if (!rows.rows.length) {
    console.log(`${table}: 0 rows`);
    return;
  }
  const placeholders = cols.map((_, i) => `?${i + 1}`).join(",");
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
  for (const row of rows.rows) {
    // positional args array — libsql maps ?1..?N positionally
    await remote.execute({ sql, args: cols.map((c) => row[c]) });
  }
  console.log(`${table}: ${rows.rows.length} rows migrated`);
}

await copyTable("agents", [
  "id",
  "name",
  "specialty",
  "endpoint",
  "wallet",
  "agentic_id",
  "status",
  "reliability",
  "created_at",
  "last_seen",
]);
await copyTable("supply_records", ["id", "name", "detail_json", "markets_json", "targets_json", "created_at"]);
await copyTable("accounts", [
  "id",
  "identity",
  "email",
  "wallet",
  "credits",
  "free_runs_used",
  "created_at",
  "updated_at",
]);
console.log("core migration done");
