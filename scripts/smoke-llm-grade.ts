/**
 * LLM grading pass smoke test — verifies both grading modes end to end:
 *
 *   bun run scripts/smoke-llm-grade.ts
 *
 * Run 1: no router key → deterministic mode (local weights, cycle completes).
 * Run 2: mocked Router response → llm mode (weights re-blended, cost recorded).
 *
 * Set ZERO_G_COMPUTE_API_KEY in .env and pass --live to hit the real Router.
 */
import { db, ensureSchema, nowIso, newId } from "../src/lib/db";
import { inquiries, agents, claims } from "../src/lib/db/schema";
import { gradeAndSynthesize } from "../src/lib/orchestrator/run";
import { eq, inArray } from "drizzle-orm";

await ensureSchema();

const QUESTION =
  "I have 5,000 flat-screen TVs to move. Which hotel chains are renovating properties this quarter?";

const AGENTS = [
  { id: "AGT-smoke-a", name: "Hospitality Scout", reliability: 0.8 },
  { id: "AGT-smoke-b", name: "Permit Watcher", reliability: 0.8 },
];

const CLAIMS = [
  {
    agentId: AGENTS[0]!.id,
    company: "Meridian Hotels Group",
    claim: "Meridian is renovating 40 lobbies across Europe this quarter.",
    confidence: 0.9,
    evidence: [
      {
        item: "40 lobby renovation permits filed",
        source: "https://city-planning.example.org/meridian",
        observed: "2026-08-20",
      },
    ],
  },
  {
    agentId: AGENTS[1]!.id,
    company: "Meridian Hotels Group",
    claim: "Meridian is renovating 40 lobbies across Europe this quarter.",
    confidence: 0.85,
    evidence: [
      {
        item: "Renovation mentioned in Q2 earnings call",
        source: "https://investors.meridianhotels.example.com/q2-call",
        observed: "2026-08-12",
      },
    ],
  },
  {
    agentId: AGENTS[0]!.id,
    company: "Bob's Sandwich Cart",
    claim: "Bob's Sandwich Cart is popular downtown.",
    confidence: 0.7,
    evidence: [
      {
        item: "Long queue observed",
        source: "https://social.example.com/post/123",
        observed: "2026-08-01",
      },
    ],
  },
];

async function seedInquiry(): Promise<string> {
  const id = newId("INQ");
  const ts = nowIso();
  await db.insert(inquiries).values({
    id,
    question: QUESTION,
    status: "grading",
    createdAt: ts,
    updatedAt: ts,
  });
  for (const agent of AGENTS) {
    await db
      .insert(agents)
      .values({
        id: agent.id,
        name: agent.name,
        specialty: "smoke-test",
        endpoint: "http://localhost:9",
        wallet: `0x${"0".repeat(40)}`,
        status: "online",
        reliability: agent.reliability,
        createdAt: ts,
        lastSeen: ts,
      })
      .onConflictDoNothing();
  }
  for (const c of CLAIMS) {
    await db.insert(claims).values({
      inquiryId: id,
      agentId: c.agentId,
      company: c.company,
      claim: c.claim,
      confidence: c.confidence,
      evidenceJson: JSON.stringify(c.evidence),
      submittedAt: ts,
    });
  }
  return id;
}

async function report(id: string, label: string) {
  const [iq] = await db.select().from(inquiries).where(eq(inquiries.id, id));
  const rows = await db.select().from(claims).where(eq(claims.inquiryId, id));
  console.log(`\n=== ${label} ===`);
  console.log("status:", iq?.status, "| grade_mode:", iq?.gradeMode, "| cost_og:", iq?.gradeCostOg);
  if (iq?.gradeError) console.log("grade_error:", iq.gradeError);
  for (const r of rows) {
    console.log(
      `· [${r.agentId}] "${r.claim.slice(0, 44)}…" weight=${r.weight} tier=${r.tier}` +
        (r.llmNote ? ` note="${r.llmNote}"` : ""),
    );
  }
}

// ---- Run 1: deterministic (no router key on PATH for this process) ----
const live = process.argv.includes("--live");
if (live) {
  console.log("--live set: using real Router key from env for BOTH runs is not supported;");
  console.log("run 1 below still exercises the deterministic fallback only if key is absent.");
}

const realFetch = globalThis.fetch;
// Force deterministic mode for run 1 by making the Router unreachable.
(globalThis as { fetch: typeof fetch }).fetch = (async () => {
  throw new Error("simulated router outage");
}) as typeof fetch;

const idA = await seedInquiry();
await gradeAndSynthesize(idA);
(globalThis as { fetch: typeof fetch }).fetch = realFetch;
await report(idA, "Run 1 — Router down → deterministic fallback");

// ---- Run 2: mocked Router → llm mode ----
if (!live) {
  (globalThis as { fetch: typeof fetch }).fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const userMsg: string = body.messages?.[1]?.content ?? "";
    const grades = [];
    if (userMsg.includes("Bob's Sandwich Cart")) {
      grades.push({ i: 2, relevance: 0.05, quality: 0.1, note: "off-topic for buyer" });
    }
    if (userMsg.includes("Meridian")) {
      grades.push({ i: 0, relevance: 0.95, quality: 0.9, note: "primary permit records" });
      grades.push({ i: 1, relevance: 0.95, quality: 0.6, note: "secondary earnings call" });
    }
    const payload = {
      id: "chatcmpl-mock",
      choices: [
        {
          message: {
            content: JSON.stringify({ grades }),
          },
        },
      ],
      x_0g_trace: {
        request_id: "mock-req-1",
        billing: { total_cost: "7300000000000" },
      },
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const idB = await seedInquiry();
  await gradeAndSynthesize(idB);
  (globalThis as { fetch: typeof fetch }).fetch = realFetch;
  await report(idB, "Run 2 — mocked Router → llm blend");
}

// cleanup smoke agents so the grid stays clean
await db.delete(agents).where(
  inArray(
    agents.id,
    AGENTS.map((a) => a.id),
  ),
);

console.log("\nsmoke-llm-grade done.");
process.exit(0);
