# Prime Layer — Business-Grade Agent & Orchestrator Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn the hackathon readout into a business-grade intelligence product where every "4 sources" actually opens to 4 clickable URLs, every recommendation explains *why* it matches the buyer's stock, and failed runs credit trust.

**Architecture:** Hybrid grid (1-3 internal trusted agents + open external). Enforce URL evidence at submit, canonicalize + blend LLM relevance into weight, synthesize a reason (`why_relevant`) per company, anchor everything to 0G, credit failures with free runs.

**Tech Stack:** TanStack Start + Vite, Drizzle + libsql (`prime-layer.db`), 0G Storage/Compute Router, Privy + ethers, Radix HoverCard.

---

### Task 1: Create plan file (this file)

**Files:**
- Create: `.hermes/plans/2026-08-28_business-grade-agent-orchestrator.md`

**Done.**

---

### Task 2: Enforce claim contract — URL evidence required

**Objective:** Reject claims where `source` is not https, store `label` + `url` correctly.

**Files:**
- Modify: `src/lib/server/claims-submit.ts` (or wherever `POST /api/claims/submit` lives) — add zod `z.string().url().startsWith("https://")` + `evidence[].item` min 8
- Modify: `src/lib/orchestrator/run.ts:482-510` — already does label/url split, ensure it skips non-urls (log warning)
- Test: `curl -X POST http://localhost:5173/api/claims/submit` with bad source → 400

**Steps:**
1. Add validation 2. Run `bun run build` 3. Manual curl test 4. Commit `fix(claims): require https evidence`

---

### Task 3: Extend claim with why_relevant (reason)

**Files:**
- Modify: DB schema if needed `src/lib/db/schema.ts` claims `whyRelevant` text nullable
- Modify: `src/lib/orchestrator/run.ts` read `why_relevant` from submit, carry into `SubmittedClaim` + `graded` + `readout.topClaim`
- Test: submit claim with `why_relevant: "5km road -> needs streetlights -> your LEDs"` → readout `topClaim` includes it

---

### Task 4: Internal reference agent (launch trust anchor)

**Files:**
- Create: `agents/reference/agent.ts` — simple TS agent that on `ResearchCommand` does: fetch X search + news, HEAD-check URL, submit with `why_relevant`
- Modify: `src/lib/orchestrator/run.ts:53 agentsOnGrid` — seed internal agents with reliability 0.9
- Test: `bun run agents:reference -- --question "we have electricals"` → see claims in DB

---

### Task 5: Grading — URL canonicalization + LLM relevance rewrite

**Files:**
- Modify: `src/lib/orchestrator/grade.ts` `sourceClusterKey` — strip utm_, trailing /, www, lower case
- Modify: `src/lib/orchestrator/llm-grade.ts` system prompt → "Does this create demand for THIS buyer's stock in 6 months? Score relevance 0-1, quality 0-1, note = one sentence why"
- Test: `bun run build && bun run dev` + run grading on fixture → weight reflects relevance

---

### Task 6: Readout — always attach sources + use why_relevant

**Files:**
- Modify: `src/lib/orchestrator/run.ts:504-513` — already slices 6, ensure retro-fill from `evidenceRecords` for old inquiries where `readoutJson.sources = []` but `sourcesClustered >0`
- Modify: `src/lib/orchestrator/synthesize.ts` fallback — use `why_relevant` not generic filler
- Test: re-run previous inquiry, see chips + mini card show 4 links, no "Sources — 4 independent" header

---

### Task 7: Failure credit — +1 free run on failed

**Files:**
- Modify: `src/lib/orchestrator/run.ts:196` catch → after setting `failed`, insert `creditLedger: {kind:"failure_credit", amount:1}`
- Modify: `src/lib/orchestrator/fns.ts` `getAccount` to count failure_credit
- Modify: `src/routes/app.index.tsx` failed UI → "1 free retry added" (minimal, no slop)
- Test: trigger failed inquiry (no agents) → check ledger +1

---

### Task 8: Contact extraction (if sure)

**Files:**
- Modify: `src/lib/orchestrator/synthesize.ts` — if evidence ties to single individual (heuristic: company == person name, source is profile), add `contact: {name, url}` to recommendation, only when confidence >0.85
- Test: manual claim with individual source → see contact line

---

**Verification:**
- `bun run build` passes each task
- One live E2E: submit question → see 8 companies with 4 chips each, hover shows 4 URLs opening in new tab, failed run gives credit

**Risks:**
- Strict URL reject may block good agents — add allowlist for X t.co short links
- LLM prompt change may lower scores — keep floor weight 0.05
- Retro-fill may be slow — limit to 25 recent inquiries

**Open:** none — proceed task by task.
