import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  endpoint: text("endpoint").notNull(),
  wallet: text("wallet").notNull(),
  agenticId: text("agentic_id"),
  status: text("status").notNull().default("online"),
  reliability: real("reliability").notNull().default(0.8),
  createdAt: text("created_at").notNull(),
  lastSeen: text("last_seen").notNull(),
});

export const supplyRecords = sqliteTable("supply_records", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  detailJson: text("detail_json").notNull().default("[]"),
  marketsJson: text("markets_json").notNull().default("[]"),
  targetsJson: text("targets_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  category: text("category"),
  geography: text("geography"),
  status: text("status").notNull().default("dispatching"),
  agentsMatched: integer("agents_matched").notNull().default(0),
  claimsReceived: integer("claims_received").notNull().default(0),
  sourcesClustered: integer("sources_clustered").notNull().default(0),
  contradictions: integer("contradictions").notNull().default(0),
  readoutJson: text("readout_json"),
  readoutAnchorRoot: text("readout_anchor_root"),
  readoutAnchorTx: text("readout_anchor_tx"),
  gradeMode: text("grade_mode"),
  gradeCostOg: real("grade_cost_og"),
  gradeError: text("grade_error"),
  synthesisJson: text("synthesis_json"),
  error: text("error"),
  dispatchedAt: text("dispatched_at"),
  windowClosesAt: text("window_closes_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inquiryId: text("inquiry_id").notNull(),
  agentId: text("agent_id").notNull(),
  company: text("company").notNull(),
  claim: text("claim").notNull(),
  confidence: real("confidence").notNull(),
  evidenceJson: text("evidence_json").notNull().default("[]"),
  tier: text("tier"),
  weight: real("weight"),
  dimsJson: text("dims_json"),
  gradeMode: text("grade_mode"),
  llmNote: text("llm_note"),
  submittedAt: text("submitted_at").notNull(),
});

export const opportunities = sqliteTable("opportunities", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  location: text("location"),
  industry: text("industry"),
  need: text("need").notNull(),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(),
  status: text("status").notNull().default("open"),
  window: text("window"),
  size: text("size"),
  evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
  inquiryId: text("inquiry_id").notNull(),
  anchorRoot: text("anchor_root"),
  anchorTx: text("anchor_tx"),
  createdAt: text("created_at"),
});

export const evidenceRecords = sqliteTable("evidence_records", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  claim: text("claim").notNull(),
  source: text("source").notNull(),
  sourceType: text("source_type").notNull().default("agent submission"),
  agent: text("agent").notNull(),
  observed: text("observed").notNull(),
  status: text("status").notNull().default("verified"),
  note: text("note"),
  anchorRoot: text("anchor_root"),
  anchorTx: text("anchor_tx"),
  inquiryId: text("inquiry_id"),
  createdAt: text("created_at").notNull(),
});

export const dispatchAcks = sqliteTable("dispatch_acks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inquiryId: text("inquiry_id").notNull(),
  agentId: text("agent_id").notNull(),
  declined: integer("declined").notNull().default(0),
  respondedAt: text("responded_at").notNull(),
});

export const settlements = sqliteTable("settlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inquiryId: text("inquiry_id").notNull(),
  agentId: text("agent_id").notNull(),
  wallet: text("wallet").notNull(),
  weight: real("weight").notNull(),
  amountUsd: real("amount_usd").notNull(),
  tx: text("tx"),
  paidOg: real("paid_og"),
  payoutTx: text("payout_tx"),
  payoutError: text("payout_error"),
  createdAt: text("created_at").notNull(),
});
