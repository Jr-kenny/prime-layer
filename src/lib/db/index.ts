import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";

/**
 * Persistence for the orchestrator. Local dev uses an on-disk SQLite file;
 * set DATABASE_URL (e.g. a Turso libsql:// endpoint) for shared/production.
 */

const url = process.env["DATABASE_URL"]?.trim() || "file:./prime-layer.db";

const globalForDb = globalThis as unknown as { __primeLayerClient?: Client };

const authToken = process.env["DATABASE_AUTH_TOKEN"];
const client =
  globalForDb.__primeLayerClient ??
  createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

if (!process.env["VERCEL"]) globalForDb.__primeLayerClient = client;

export const db = drizzle(client);

const DDL = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    wallet TEXT NOT NULL,
    agentic_id TEXT,
    status TEXT NOT NULL DEFAULT 'online',
    reliability REAL NOT NULL DEFAULT 0.8,
    created_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS supply_records (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '[]',
    markets_json TEXT NOT NULL DEFAULT '[]',
    targets_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    category TEXT,
    geography TEXT,
    status TEXT NOT NULL DEFAULT 'dispatching',
    agents_matched INTEGER NOT NULL DEFAULT 0,
    claims_received INTEGER NOT NULL DEFAULT 0,
    sources_clustered INTEGER NOT NULL DEFAULT 0,
    contradictions INTEGER NOT NULL DEFAULT 0,
    grade_mode TEXT,
    grade_cost_og REAL,
    grade_error TEXT,
    synthesis_json TEXT,
    readout_json TEXT,
    readout_anchor_root TEXT,
    readout_anchor_tx TEXT,
    error TEXT,
    dispatched_at TEXT,
    window_closes_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    company TEXT NOT NULL,
    claim TEXT NOT NULL,
    confidence REAL NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '[]',
    tier TEXT,
    weight REAL,
    dims_json TEXT,
    grade_mode TEXT,
    llm_note TEXT,
    submitted_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    location TEXT,
    industry TEXT,
    need TEXT NOT NULL,
    summary TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    window TEXT,
    size TEXT,
    evidence_ids_json TEXT NOT NULL DEFAULT '[]',
    inquiry_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS evidence_records (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    claim TEXT NOT NULL,
    source TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'agent submission',
    agent TEXT NOT NULL,
    observed TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'verified',
    note TEXT,
    anchor_root TEXT,
    anchor_tx TEXT,
    inquiry_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dispatch_acks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    declined INTEGER NOT NULL DEFAULT 0,
    responded_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    wallet TEXT NOT NULL,
    weight REAL NOT NULL,
    amount_usd REAL NOT NULL,
    tx TEXT,
    paid_og REAL,
    payout_tx TEXT,
    payout_error TEXT,
    created_at TEXT NOT NULL
  )`,
];

let migrated = false;

/** Idempotent bootstrap — safe to call on every request path. */
export async function ensureSchema() {
  if (migrated) return;
  for (const statement of DDL) {
    await client.execute(statement);
  }
  // Tolerant migrations for DBs created before a column existed.
  const alters = [
    "ALTER TABLE inquiries ADD COLUMN readout_anchor_root TEXT",
    "ALTER TABLE inquiries ADD COLUMN readout_anchor_tx TEXT",
    "ALTER TABLE inquiries ADD COLUMN grade_mode TEXT",
    "ALTER TABLE inquiries ADD COLUMN grade_cost_og REAL",
    "ALTER TABLE inquiries ADD COLUMN grade_error TEXT",
    "ALTER TABLE inquiries ADD COLUMN synthesis_json TEXT",
    "ALTER TABLE claims ADD COLUMN grade_mode TEXT",
    "ALTER TABLE claims ADD COLUMN llm_note TEXT",
    "ALTER TABLE settlements ADD COLUMN paid_og REAL",
    "ALTER TABLE settlements ADD COLUMN payout_tx TEXT",
    "ALTER TABLE settlements ADD COLUMN payout_error TEXT",
  ];
  for (const statement of alters) {
    try {
      await client.execute(statement);
    } catch {
      // column already exists
    }
  }
  migrated = true;
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
