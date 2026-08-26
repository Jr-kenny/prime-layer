// Verify the Turso round-trip: create probe table, write, read, drop.
import { createClient } from "@libsql/client";

let token = "";
for (const l of require("node:fs").readFileSync(".env", "utf8").split("\n")) {
  if (l.startsWith("DATABASE_AUTH_TOKEN")) token = l.split("=").slice(1).join("=").trim();
}

const db = createClient({
  url: "libsql://prime-layer-jr-kenny.aws-eu-west-1.turso.io",
  authToken: token,
});

await db.execute("CREATE TABLE IF NOT EXISTS _probe (id TEXT PRIMARY KEY, v TEXT)");
await db.execute(
  "INSERT INTO _probe (id, v) VALUES ('hello', 'turso') ON CONFLICT(id) DO UPDATE SET v = 'turso'",
);
const r = await db.execute("SELECT v FROM _probe WHERE id = 'hello'");
console.log("round-trip OK:", JSON.stringify(r.rows[0]));
await db.execute("DROP TABLE _probe");
console.log("Turso verified — write, read, clean all work.");
