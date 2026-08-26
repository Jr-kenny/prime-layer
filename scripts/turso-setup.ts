// One-off: create the Turso group + database using the platform token in .env.
const fs = require("node:fs");

const line = fs
  .readFileSync(".env", "utf8")
  .split("\n")
  .find((l) => l.startsWith("TURSO_PLATFORM_TOKEN"));
let token = line.split("=").slice(1).join("=").trim();
if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);

console.log("token segments:", token.split(".").length, "| len:", token.length);
const h = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
const base = "https://api.turso.tech/v1/organizations/jr-kenny";

// 1. group
let res = await fetch(`${base}/groups`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ name: "default", location: "nrt" }),
});
console.log("group create:", res.status, JSON.stringify(await res.json().catch(() => ({}))).slice(0, 200));
if (res.status >= 300 && !String(res.status).startsWith("2")) {
  // try other common locations before giving up
  for (const loc of ["sin", "fra", "ams", "iad", "lhr"]) {
    res = await fetch(`${base}/groups`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "default", location: loc }),
    });
    console.log(`retry ${loc}:`, res.status);
    if (res.ok) break;
    const err = await res.json().catch(() => ({}));
    if (!/invalid location/i.test(err.error ?? "")) {
      console.log(JSON.stringify(err).slice(0, 200));
    }
  }
}

// 2. database
await new Promise((r) => setTimeout(r, 4000));
res = await fetch(`${base}/databases`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ name: "prime-layer", group: "default" }),
});
console.log("db create:", res.status);
const db = await res.json().catch(() => ({}));
console.log(JSON.stringify(db, null, 1).slice(0, 600));

if (db?.databases?.[0] ?? db?.Name ?? db?.name) {
  const dbname = db.databases?.[0]?.Name ?? db.name;
  // 3. token for the db
  const tres = await fetch(`${base}/databases/${dbname}/auth/tokens`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ expiration: "never" }),
  });
  console.log("db token:", tres.status);
  const tbody = await tres.json().catch(() => ({}));
  if (tbody.jwt) {
    require("node:fs").appendFileSync(
      ".env",
      `\nDATABASE_URL=libsql://${tbody.databases?.prime_layer?.Hostname ?? ""}\n`,
    );
    console.log("DB URL host:", tbody.databases?.prime_layer?.Hostname);
    console.log("DB JWT saved length:", tbody.jwt.length);
    // write both to a scratch file so we can wire .env safely
    require("node:fs").writeFileSync(
      "/tmp/turso-creds.json",
      JSON.stringify({ host: tbody.databases?.prime_layer?.Hostname, jwt: tbody.jwt }),
    );
    console.log("creds written to /tmp/turso-creds.json");
  }
}
