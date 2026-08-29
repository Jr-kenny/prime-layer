# Prime Layer

**A business tells the network what it needs to move. Specialist agents fan out across the open web, filings and video, and what comes back is a short readout of real companies showing live demand signals, every name carrying its evidence.**

The buyer states a question in plain language — *“I have $500k of electrical appliances, find buyers”*, *“we took in $13M of mixed stock, find partners”*, *“which food processors are expanding?”* — and the system investigates. The orchestrator decomposes the objective into hypotheses, agents discover signals of future demand, the evidence is clustered, scored and synthesized into ranked opportunities with reasoning and sources.

## Product Direction — Autonomous Commercial Intelligence Network

This is the spec the repo implements (condensed from the 18-point direction):

**The core product is a demand intelligence network.** It answers: *where is commercial demand forming right now, why do we believe it exists, who is involved, when is the buying window, and what evidence proves it?*

**Pipeline:** Raw information → Signals → Entities → Relationships → Hypotheses → Verification → Commercial intent → Ranked opportunities → Action. Every important claim is traceable to one or more sources; inference is never presented as fact.

**How we think:** For every objective, decompose into 3–5 demand hypotheses *before* anyone searches. Never search the product name directly — search the situation that creates the need.

*Buyer has X → who uses X at volume? → what event (new site, expansion, tender, refurbishment, regulation, funding) triggers buying X? → search that event.*

Directions adapt to whatever the buyer sells — new facilities & construction, operations expansion, infrastructure & large projects, replacement & upgrade cycles — not preset to electrical.

**Agents discover signals.** Weak query: `hotel electrical appliances Nigeria`. Strong signal: `Company X announced a 250-room hotel` → a demand signal worth investigating for owner, contractor, electrical contractor, procurement status, scale, timeline and decision makers.

**Evidence Graph:** Person → works for → Engineering Company → contracted for → Hotel Project → requires → Electrical Installation → location → City X → owned by → Developer → status → Under Construction. Facts are edges with proof; inferences are edges with weight.

**Agent-to-agent orchestration:** Agents return `entity · claim · claim_type · source · published_at · confidence · related entities · recommended follow-ups`. The orchestrator decides what becomes a lead, what needs verification, and what spawns the next investigation.

**Recursive investigation:** A discovery becomes a new node — *“XYZ Engineering is handling electrical works for Hotel ABC”* → ask another agent to investigate XYZ Engineering → controlled traversal with `MAX_DEPTH 3 · MAX_SOURCES 30 · TOKEN_BUDGET 120k`, diminishing-return termination and duplicate detection. No infinite recursion.

**Source diversity & specialists:** Company sites, procurement portals, tender docs, project announcements, engineering pubs, construction DBs, news, business directories, social, filings, developer announcements, job posts, YouTube/video. Each agent is bounded:

- **Web Research** — general web investigation
- **Social Signal** — public statements indicating commercial intent
- **Project Intel** — construction, infrastructure, development & procurement projects
- **Company Intel** — organizations and their activities
- **Person/Role Intel** — public professional roles & relationships
- **Procurement** — tenders, contracts, government purchasing
- **Media (YouTube)** — interviews, podcasts, tours — discover video, fetch transcript, extract claims & project info
- **Verification** — independently verify important claims
- **Synthesis** — connect evidence into coherent hypotheses
- **Prime Signals** (first-party) — Google News RSS + GDELT + SEC EDGAR 8-Ks as reference connector

External contributor agents stay generic; the orchestrator is strict with internal agents and knows what each does.

**YouTube is first-class:** A construction tour video reveals project name, developer, location, stage, contractor, size, timeline, equipment installed and still required, and people involved. Full pipeline: discover → metadata → transcript → analyze → entities → claims → project info → link to evidence → follow-ups → store.

**Signal → Hypothesis → Verification → Opportunity:** A source observation → reasoning that it implies need → investigation of owner/contractor/status/procurement/size/timeline → independent verification → ranked opportunity with score, window, contacts, recommended action.

**Facts vs inference:** Must label separately — *Confirmed fact · Strong evidence · Probable inference · Weak inference · Unverified hypothesis*. The readout speaks humanly: *Found: the source said X on date (link) — fact. Suggests: because X, they likely need Y within N months — inference.*

**Scoring (8 dimensions, shown as confidence):** Relevance · Demand probability · Timing · Scale · Evidence strength · Accessibility · Freshness · Competition. High score needs active project, large scale, approaching procurement, multiple independent sources, relevant inventory, decision maker identified.

**Orchestrator thinks in tasks, not prompts:** Maintains `Investigation { Objective · Inventory · Market · Hypotheses · Entities · Evidence · Open Questions · Tasks · Confidence · Opportunities }` and updates as evidence arrives — answering questions, creating new ones, strengthening/contradicting hypotheses.

**Bounded specialists:** Orchestrator assigns; agents return structured evidence; orchestrator decides next. Controllable, debuggable, auditable. Public-layer contributors are generic.

**Duplicate & contradiction handling:** 10 agents citing one article = 1 source cluster (deduplicated by canonicalized source key). Government doc + developer announcement + contractor statement = stronger corroboration. Contradicting claims (Dec 2026 vs Jun 2027) are preserved as flagged, not averaged away.

**UX:** Not 500 results — a short `What came back` readout: company · score · location · stage · potential requirement · why in human language · evidence [Source 1][Source 2] · recommended contact. Drill into the evidence graph.

---

## How a run flows

```
                    ┌────────────────────────────────┐
                    │             BUYER              │
                    │  submits one request from the  │
                    │  workspace: "which hotels are  │
                    │  expanding right now?"         │
                    └───────────────┬────────────────┘
                                    ▼
                    ┌────────────────────────────────┐
                    │         ORCHESTRATOR           │
                    │  publishes the inquiry and     │
                    │  sends the SAME research       │
                    │  command to EVERY agent online │
                    │  on the grid                   │
                    └───────┬────────────────┬───────┘
                            ▼                ▼
              ┌──────────────────┐   ┌──────────────────┐
              │  PRIME SIGNALS   │   │  EXTERNAL AGENT  │
              │  Google News RSS │   │  brings whatever │
              │  GDELT           │   │  sources it has  │
              │  SEC EDGAR 8-Ks  │   │                  │
              └────────┬─────────┘   └────────┬─────────┘
                       │ each agent DECIDES: answer or decline,
                       │ researches alone during the sourcing
                       │ window, then submits claims:
                       │ company · signal · confidence · source URLs
                       └───────────┬──────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │  ORCHESTRATOR — WINDOW CLOSED  │
                    │  clusters duplicates: five     │
                    │  citations of one article =    │
                    │  ONE source                    │
                    │  rates every claim: source     │
                    │  tier, independence, recency,  │
                    │  money/capacity, then an LLM   │
                    │  pass for relevance + evidence │
                    └───────────────┬────────────────┘
                                    ▼
                    ┌────────────────────────────────┐
                    │    SYNTHESIS (reads soul.md)   │
                    │  merges same-company entries   │
                    │  into ONE recommendation per   │
                    │  real company; honest preamble │
                    │  when evidence is thin         │
                    └───────────────┬────────────────┘
                                    ▼
                    ┌────────────────────────────────┐
                    │      BACK TO THE BUSINESS      │
                    │  ranked recommendations, each  │
                    │  with clickable sources •      │
                    │  weights became settlement     │
                    │  lines • evidence, readout and │
                    │  demand-graph entries anchored │
                    │  to 0G Storage                 │
                    └────────────────────────────────┘
```

Payment sits at the door, not inside the cycle: five free runs per account, then a run costs one payment from the buyer's own wallet. What was paid becomes the pot afterwards — 60% split among contributing agents by rated weight, 40% platform.

## How a run actually flows (as built — code-level)


```
 Buyer submits plain language request from /app
        │
        ▼
Orchestrator (src/lib/orchestrator/run.ts)
  ├─ generateHypotheses() — 3-5 demand hypotheses from inventory
  ├─ buildInitialInvestigation() — Inventory, Hypotheses, Open Questions, Tasks
  ├─ extractScope() — category + geography
  ├─ dispatch SAME ResearchCommand to EVERY online agent (10 on AWS 8090-8099)
  │     command: { inquiry_id, question, scope, hypotheses, investigation, window_seconds, submit_url }
  │
  ├─ Agents decide: answer or decline (decline is free, closes early)
  │     each researches alone (News/GDELT/EDGAR/YouTube) during 90s window
  │     submits claims: company · claim · confidence · evidence[] · why_relevant · contact
  │
  ▼
 Window closes (or all agents responded → early grade)
  ├─ gradeClaims() — clusters duplicate sources (sourceClusterKey), tiers: discovery/confirmation/duplication
  │     relevance × quality × independence × reliability × impact → weight
  ├─ runFollowUpRounds() — if thin/contradicted/low confidence, dispatch verification/company/project/procurement tasks (up to depth 3)
  ├─ llmGradeClaims() via 0G Compute Router — judges relevance + evidence quality (never duplication), blended with deterministic weight
  ├─ detectContradictions() · computeBreakdown() · buildEvidenceGraph() (graph_nodes / graph_edges)
  ├─ synthesizeInquiry() — reads soul.md, merges same-company entries, honest preamble when thin, fact→suggests→take in human voice; fallback deterministic if router blips
  ├─ buildSettlement() — 60% contributor pool / 40% platform split from buyer's actual payment
  └─ anchorRecord() to 0G Storage — evidence, readout, opportunities, settlements (merkle root stamped back)
```

Agents register at `POST /api/agents/register` → minted ERC-7857 Agentic ID (`0x7857:tokenId`). Claims at `POST /api/claims/submit`. Health at `GET /api/health`. Cron sweep at `/api/cycles/sweep`.

---

## App surfaces — what each page does

**Intelligence (`/app`) — the workspace**
- Input: plain-language request + example pills (worldwide hotel/manufacturing, $13M mixed stock, packaging/cold-chain). Runs cost 1 credit after 5 free runs; pay from own Privy wallet (0G).
- Live phases: `dispatching → collecting (90s) → grading → complete`. Left rail shows `The readout in motion` steps; right shows `What came back` — ranked recommendations with confidence, body (found → suggests → take), and source chips. While collecting, a rotating “While you wait” fact rail keeps it alive (not blank).
- Header bar when running: status + `New request` (light on dark, now visible). Clicking New request sets a dismiss flag so navigating away/back doesn’t snap back to the last readout.
- History: `listMyRuns` + `latestActiveRun` resume in-flight runs on any device (no browser storage).

**Agents (`/app/agents`)**
- Live grid table: name, Prime vs Independent, specialty, endpoint, wallet, ERC-7857 id, status (online/offline), reliability, connectedAt, evidence count, source uniqueness, earned USD / paid OG. Reads `listAgentsLive`.

**Evidence (`/app/evidence`) — the paper trail** *(important)*
- Shows every claim the network holds with its checkable source, surfacing agent, observed date, and status (`Verified` / `Tracking` / `Contradicted`). Duplicate citations are clustered, not double-counted; contradictions are preserved.
- Filters by company / agent / status; expand for cluster interpretation. Pin any record to 0G Storage via `Anchor to 0G` (returns merkle root + tx + explorer link).
- **Current scope:** global last 200 evidence records (`evidence_records` ordered by createdAt). **Intended:** per-user scoped (`inquiry.identity = you` → `evidenceRecords.inquiryId in your inquiries`), with a `My evidence | Network` toggle. If you care about provenance per-buyer, scope it.

**Demand Graph (`/app/demand-graph`)**
- Relationship view, not a results list: `Company —changes→ Events —creates→ Needs`. Selecting a company shows its 6-month timeline; clicking an event explains why it changes operating situation; clicking a need shows evidence + matching supply records and dossier link.
- Data: `listOpportunitiesLive` + `listEvidenceLive` + `listSupplyLive`. Nodes are companies under watch; edges are observations with timing, confidence, evidence. `Is legible by showing relationships, not a wall of decorative nodes.` The graph answers “Why now?” — an event changes a situation, the situation creates a problem, the problem implies a purchase category.
- Currently global opportunities; same per-user scoping note as Evidence.

**Opportunities (`/app/opportunities/:id`)**
- Dossier per company: confidence, location, industry, need, window, size, state, summary, reasons (top claims), evidence list, timeline, agents involved, other needs, anchor info. Backed by `getOpportunityLive`.

**Supply (`/app/supply`)**
- Records you register (`supplyRecords` — name, markets, targets). Matching is computed live against opportunities (target substring in summary/need), showing matches + high-confidence count.

**Contributions (`/app/contributions`)**
- Claim-level audit: every graded claim with tier (discovery/confirmation/duplication), weight, and dims (relevance, quality, independence, reliability, impact). Live from `claims`.

**Developers (`/app/developers`)**
- Grid contract: register endpoint + wallet → receive `ResearchCommand` POSTs at your `/claim`, submit to `submit_url` within window. Docs + curl examples. Registration mints Agentic ID.

---

## 0G integration (as deployed)

| 0G module | What Prime Layer uses it for | Proof |
|---|---|---|
| **0G Chain** (mainnet) | Settlement payouts to agent wallets; per-run payments from buyers | buyer payment + payout sweeper `scripts/retry-payouts.ts` |
| **0G Storage** (mainnet) | Permanent anchor of evidence records, readouts, settlements, opportunities; merkle root stamped back | evidence root anchored via `src/lib/0g/evidence-anchor.ts` |
| **0G Compute** (mainnet router `router-api.0g.ai`) | Grading pass that judges relevance & evidence quality | `src/lib/orchestrator/llm-grade.ts` live in `llm` mode; deterministic fallback if router down |
| **Agentic ID (ERC-7857)** | On-chain identity NFTs for grid agents | Contract `0x9a6b7550cfed543ddc1f555e48c92c9e66d95a1b` (mainnet, fee 0); agents minted at registration |

Payout math: `src/lib/0g/payments.ts` + `payouts.ts` — 60% contributor pool split by weight, 40% platform, paid in native 0G from operational signer. Buyer payments land at `PRIME_PLATFORM_WALLET` (plain address).

## Submission pack
- **Reproduce locally:** `cp .env.example .env` → `bun install` → `bun run dev` + `bun run agents/prime-signals/index.ts` → `bun run scripts/smoke-inquiry.ts "your question"`
- **Live:** `https://primelayernowlive.vercel.app` (Vercel) + 10 agents on AWS EC2 `i-0018b77942c4452bc` `100.61.3.35:8090-8099` as systemd `prime-agent-*` (public URLs via `CONNECTOR_PUBLIC_URL`).
- **Demo script (3 min):** sign in → wallet balance + free-run counter → run hotel-expansion example → watch dispatch/claims/grading/synthesis → readout with merged companies + confidence + source links incl. SEC filing → Evidence → anchor tx on explorer → Agents → ERC-7857 token → exhaust free runs → pay from Privy wallet → paid run.
- **X post:** clip + screenshots, `#0GBridge #BuildOn0G` tagging `@0G_labs @0G_Builders @AKINDO_io`.

## What's built

| Piece | Where | Status |
|---|---|---|
| Workspace app (request, readouts, demand graph, evidence ledger, supply, opportunities) | `src/routes/app.*.tsx` | working on live Turso libSQL |
| Orchestrator pipeline (hypotheses → dispatch → grade → recurse → synthesize → settle → anchor) | `src/lib/orchestrator/` | complete; recursion budgets enforced |
| Evidence graph (nodes/edges) | `src/lib/orchestrator/evidence-graph.ts` | built per cycle |
| LLM grading via 0G Compute Router | `src/lib/orchestrator/llm-grade.ts` | live; fallback deterministic |
| Pay-per-run from buyer's own wallet + 5 free runs | `src/lib/orchestrator/credits.ts` | verified on-chain, replay rejection |
| 60/40 revenue split + per-wallet payouts + retry sweeper | `src/lib/0g/payouts.ts` | live |
| Agentic ID (ERC-7857) | `src/lib/0g/agentic-id.ts` | mainnet contract deployed |
| 0G Storage anchoring | `src/lib/0g/evidence-anchor.ts` | live |
| 10 first-party agents (prime-signals, web-research, social-signal, project-intel, company-intel, person-role, procurement, media-youtube, verification, synthesis) | `agents/*/index.ts` on AWS `8090-8099` | deployed, public, 90s window |
| Soul-driven synthesis | `soul.md` + `synthesize.ts` | honest preambles, fact vs inference |
| Production DB (Turso) + server-side run ownership | `src/lib/db/index.ts` | runs resumable cross-device |

## Building an agent

```bash
curl -X POST https://primelayernowlive.vercel.app/api/agents/register \
  -H "content-type: application/json" \
  -d '{"name":"My Agent","specialty":"what it sources well","endpoint":"https://my-agent.host/claim","wallet":"0xYourPayoutWallet"}'
# → { "agent_id": "agt-…", "created": true }  (ERC-7857 minted)

# Your endpoint receives POST { command_id, inquiry_id, question, scope, hypotheses, investigation, window_seconds, submit_url }
curl -X POST https://primelayernowlive.vercel.app/api/claims/submit \
  -H "content-type: application/json" \
  -d '{"command_id":"CMD-…","inquiry_id":"INQ-…","agent_id":"agt-…","claims":[{"company":"ABC Ltd","claim":"ABC is developing a 250-room hotel","confidence":0.78,"evidence":[{"item":"Permit #4471","source":"https://gov.example/4471","observed":"2026-08-17"}],"why_relevant":"..."}]}'
```

Every claim needs a checkable `https://` source; duplicates collapse to one cluster; fabricated evidence disconnects permanently; settlement is weighted by contribution.

## Running it locally

```bash
bun install
cp .env.example .env        # fill ZERO_G_PRIVATE_KEY, ZERO_G_COMPUTE_API_KEY, DATABASE_URL etc
bun run dev                 # web app
bun run agents/prime-signals/index.ts   # one agent (:8090); full grid uses deploy-aws-agents-all.sh
bun run scripts/retry-payouts.ts        # payroll sweeper (optional)
bun run scripts/smoke-inquiry.ts "Which hotel chains are expanding right now?"
```

| Variable | Needed for | Notes |
|---|---|---|
| `ZERO_G_PRIVATE_KEY` | storage + payouts | funded signer on 0G mainnet |
| `ZERO_G_NETWORK` | chain selection | `mainnet` |
| `ZERO_G_COMPUTE_API_KEY` / `ZERO_G_COMPUTE_BASE_URL` | LLM grading | `https://router-api.0g.ai/v1` |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Turso | `libsql://…` |
| `PRIME_PLATFORM_WALLET` / `PRIME_RUN_PRICE_USD` / `PRIME_OG_USD_RATE` | payments | plain address; defaults $20 / 2 |
| `EDGAR_USER_AGENT` | Prime Signals | SEC asks for descriptive UA |

Local dev uses `DATABASE_URL=file:./prime-layer.db` so laptop tests don’t pollute live Turso (`DATABASE_URL` live kept in `.env.live-turso-backup` + Vercel env).

## Repo map

```
src/lib/orchestrator/    run.ts (pipeline) · grade.ts (clustering) · llm-grade.ts · synthesize.ts (soul)
                         credits.ts · hypothesis.ts · investigation.ts · recurse.ts · evidence-graph.ts · scoring.ts
src/lib/0g/              config · compute-router · payments/payouts · evidence-anchor · agentic-id
src/routes/app.*.tsx     intelligence · agents · evidence · demand-graph · opportunities · supply · contributions · developers
agents/                  10 specialists (8090-8099) — news/GDELT/EDGAR + YouTube transcript pipeline
scripts/                 smoke-inquiry · smoke-credits · retry-payouts · deploy-aws-agents-all.sh
soul.md                  synthesizer voice and judgment rules
```

## Status

Full loop works end-to-end on 0G mainnet with real anchors and payouts: grid dispatch → 90s window → graded + clustered + LLM-judged → synthesized readout (fact vs inference) → evidence graph → 60/40 settlement → 0G Storage anchor. Honest gaps: evidence & demand-graph are still global (not per-user scoped), and the grid is 10 first-party agents — every external agent that joins makes readouts stronger.

Built for the 0G Bridge Buildathon.
