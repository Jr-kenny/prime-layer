# Prime Layer

**A business tells the network what it needs to move. Specialist agents fan out across the open web and regulatory filings, and what comes back is not a lead list — it is a short readout of real companies showing live demand signals, every name carrying its evidence.**

Prime Layer is a B2B demand-intelligence marketplace running on 0G. The buyer states a question in plain language ("which hotel chains are expanding right now", or "we took in $13M of electrical stock, find us partners who need it"). The orchestrator dispatches the question to every agent on the grid. Agents research independently — news sweeps, GDELT, SEC EDGAR filings — and submit claims with verifiable source URLs. The orchestrator clusters duplicate sources, grades each claim (deterministic scoring, then an LLM pass through 0G Compute that judges relevance and evidence quality), merges everything into one company-per-recommendation readout written by a soul-driven synthesis voice, and pays contributing agents from the buyer's actual payment, split 60/40 between the contributor pool and the platform.

The core bet: five agents citing the same article count as one source, not five. Duplication never raises confidence; independent corroboration does.

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

## 0G integration

Four modules of the 0G stack carry real work in this repo, all verified with live transactions:

| 0G module | What Prime Layer uses it for | Proof |
|---|---|---|
| **0G Chain** (mainnet) | Every settlement payout to agent wallets; per-run payments from buyers | testnet-era payout [`0x47fed6c5…bd44c1`](https://chainscan-galileo.0g.ai/tx/0x47fed6c5972ecad7654dcf36e32b481c1876a097f1c9d524ce48b21c42bd44c1) · buyer payment [`0x524d4fcc…ae88f`](https://chainscan-galileo.0g.ai/tx/0x524d4fcc2e41a65f9b47ea09d97ea70d5db91d0f074e984b0ebdc5c5d2cae88f) |
| **0G Storage** (mainnet) | Permanent anchor of every evidence record, readout, settlement roll-up and demand-graph entry; merkle root stamped back on each row | evidence root `0x251e46…6632` anchored in mainnet tx [`0x373de2c2…1fe8b`](https://chainscan.0g.ai/tx/0x373de2c285ba1ce431e2e5f1705bde7f8652f1c33c6b70d2988dfa4cb8c1fe8b) · Braemar Hotels graph entry in [`0x2987b7cf…59ee1`](https://chainscan.0g.ai/tx/0x2987b7cfa25337196db3a197a0fb93c5ca8fa25105d6801d74c591f56f659ee1) |
| **0G Compute** (mainnet router) | The grading pass that judges every claim's relevance and evidence quality through the Compute Router (OpenAI-compatible) | every production cycle grades through `router-api.0g.ai`; ~1e-15 OG per graded cycle; deterministic fallback if the router blips |
| **Agentic ID (ERC-7857)** | On-chain identity NFTs for grid agents — minted at registration against 0G's pre-deployed contract | Prime Signals holds token **137** on 0G testnet ([`0x2700F6A3…EF1F`](https://chainscan-galileo.0g.ai/address/0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F)), owned by its own wallet; mainnet ERC-7857 deploy queued |

All anchors above are confirmed on **0G mainnet** (blocks 42,646,432 and 42,646,632).

The fifth leg is economic: the platform's payroll engine (`src/lib/0g/payouts.ts`) pushes native 0G to agent wallets after every cycle, weighted by contribution — the flow 0G Pay-style apps are built on, implemented directly over 0G Chain.

## Submission pack

- **Reproduce locally:** follow *Running it locally* above — one `.env`, three processes, then `bun run scripts/smoke-inquiry.ts "your question"` runs a full grid cycle.
- **Demo script (3 min):** (1) sign into the workspace, show the wallet balance + free-run counter in the sidebar; (2) run the hotel-expansion example live — watch dispatch, claims landing, grading, synthesis; (3) open the readout: merged companies, confidence weights, clickable source links incl. a real SEC filing; (4) open Evidence page → click an anchor tx on 0G Explorer; (5) Agents page: ERC-7857 token id, earnings; (6) exhaust free runs, pay from the Privy wallet, show the paid run start.
- **X post:** post the demo clip with project name + screenshots, hashtags `#0GBridge #BuildOn0G`, tagging `@0G_labs @0G_Builders @AKINDO_io`.


## What's built

| Piece | Where | Status |
|---|---|---|
| Workspace app (request, readouts, demand graph, evidence ledger, supply records) | TanStack Start app under `/app` | working, all pages on live data |
| Orchestrator pipeline (dispatch → grade → synthesize → settle) | `src/lib/orchestrator/` | complete; verified end-to-end with real cycles |
| LLM grading via 0G Compute Router | `src/lib/orchestrator/llm-grade.ts` | live in `llm` mode; deterministic fallback if the router is down |
| Pay-per-run payments from the buyer's own Privy wallet | `src/lib/orchestrator/credits.ts` | verified on-chain: exact-amount check, replay rejection, tx bound to inquiry |
| Revenue split (60% contributor pool / 40% platform) from the real payment | `src/lib/0g/payments.ts` | wired into settlement; tested |
| Agent payouts in native 0G | `src/lib/0g/payouts.ts` | live; per-wallet aggregation, retry sweeper (`scripts/retry-payouts.ts`) |
| Agentic ID (ERC-7857) identity NFTs for grid agents | `src/lib/0g/agentic-id.ts` | own contract deployed on 0G mainnet (`0x9a6b7550…5a1b`, fee 0); Prime Signals holds token 0 |
| 0G Storage anchoring (evidence, readouts, settlements, opportunities) | `src/lib/0g/evidence-anchor.ts` | live; mainnet anchors verified on chainscan |
| First-party agent: Prime Signals | `agents/prime-signals/index.ts` | deployed on AWS EC2 (systemd `prime-signals`) — Google News RSS + GDELT + SEC EDGAR, topic-relevance gating, cross-source claim merging |
| Soul-driven synthesis voice | `soul.md` | live; honest preambles when evidence is weak |
| Production DB (Turso libSQL) + server-side run ownership | `src/lib/db/index.ts` | live; runs resumable from any device via the account, no browser storage |

## Building an agent (developer integration)

Any HTTP endpoint that can receive a JSON command and return claims with evidence can join the grid
and earn from the contributor pool. Full contract lives in-app at **/app/developers**.

```bash
# 1 · register your agent (one time — an ERC-7857 Agentic ID is minted for you)
curl -X POST https://primelayerlive.vercel.app/api/agents/register \
  -H "content-type: application/json" \
  -d '{"name":"My Agent","specialty":"what it sources well","endpoint":"https://my-agent.host/claim","wallet":"0xYourPayoutWallet"}'
# → { "agent_id": "agt-…", "created": true }

# 2 · your endpoint then receives POSTs like:
#    { "command_id": "CMD-…", "inquiry_id": "INQ-…", "question": "…",
#      "scope": { … }, "window_seconds": 300,
#      "submit_url": "https://primelayerlive.vercel.app/api/claims/submit" }

# 3 · source on your own infra, then submit within the window:
curl -X POST https://primelayerlive.vercel.app/api/claims/submit \
  -H "content-type: application/json" \
  -d '{
    "command_id": "CMD-…", "inquiry_id": "INQ-…", "agent_id": "agt-…",
    "claims": [{
      "company": "ABC Manufacturing Ltd",
      "claim": "ABC Manufacturing is expanding its factory",
      "confidence": 0.78,
      "evidence": [{ "item": "Permit #4471", "source": "https://gov.example/4471", "observed": "2026-08-17" }]
    }]
  }'

# nothing found? decline explicitly so the cycle closes early:
#   { "command_id": "CMD-…", "inquiry_id": "INQ-…", "agent_id": "agt-…", "decline": true }
```

Rules that matter: every claim needs a named checkable source; duplicate same-source citations
collapse to one; fabricated evidence cuts the connection permanently; settlement posts native 0G to
your registered wallet weighted by contribution.


## Running it locally

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env        # fill in the keys below
bun run dev                 # web app (picks the first free port)
```

Three processes make a full grid:

```bash
bun run dev                                    # orchestrator + web UI
bun run agents/prime-signals/index.ts          # first-party research agent (:8790)
bun run scripts/retry-payouts.ts               # optional payroll sweeper
```

Exercise the whole loop without the UI:

```bash
bun run scripts/smoke-inquiry.ts "Which hotel chains are expanding right now?"
bun run scripts/smoke-credits.ts       # free trials + top-ups, includes a real chain payment
bun run scripts/smoke-pay-per-run.ts   # buyer-pays-from-own-wallet flow, real chain payment
```

### Configuration

Everything reads a gitignored `.env` (see `.env.example`). The keys that matter:

| Variable | Needed for | Notes |
|---|---|---|
| `ZERO_G_PRIVATE_KEY` | storage anchoring + payouts | funded signer on 0G testnet |
| `ZERO_G_NETWORK` | chain selection | `testnet` |
| `ZERO_G_COMPUTE_API_KEY` | LLM grading | sk- key from pc.0g.ai |
| `ZERO_G_COMPUTE_BASE_URL` | LLM grading | set to `https://router-api.0g.ai/v1` for mainnet-router keys |
| `PRIME_PLATFORM_WALLET` | per-run payments | plain receiving address; customers' payments land here |
| `PRIME_RUN_PRICE_USD` / `PRIME_OG_USD_RATE` | pricing | defaults `$20` / `2` |
| `EDGAR_USER_AGENT` | Prime Signals | SEC asks for a descriptive UA |

The platform wallet is deliberately just an address — customer funds land there and the 60/40 split pays out from the operational signer. No private key belongs anywhere near a storefront.

## Repo map

```
src/lib/orchestrator/    the brain: run.ts (pipeline), grade.ts (clustering),
                         llm-grade.ts (Compute Router pass), synthesize.ts (soul voice),
                         credits.ts (trials + per-run payments), fns.ts (server functions),
                         workspace.ts (live-data server fns for the UI)
src/lib/0g/              chain layer: config, compute-router client, payments (60/40 split),
                         payouts (per-cycle payroll), evidence-anchor (0G Storage),
                         agentic-id (ERC-7857 identities)
src/routes/app.*.tsx     workspace pages — intelligence, agents, evidence, contributions,
                         supply, demand graph — all reading live DB data
agents/prime-signals/    first-party research agent (news + GDELT + EDGAR)
scripts/                 smoke tests (inquiry, credits, pay-per-run), payout sweeper,
                         anchor backfills
soul.md                  the synthesizer's voice and judgment rules
```

## Status

The full loop works end to end on 0G testnet with real money movements: paid runs verified on-chain, agents settled by weight, records anchored to 0G Storage, identities minted as ERC-7857 NFTs. The honest gaps before production: deploy somewhere public (everything currently runs localhost), fund a dedicated platform wallet, and grow the grid beyond one first-party agent — every external agent that joins makes the readouts stronger.

Built for the 0G Bridge Buildathon. Current wave work: pay-per-run settlement from buyer wallets, revenue split tied to real payments, Prime Signals upgraded with SEC EDGAR primary sources + relevance gating + cross-source merging, workspace UI moved fully onto live data, Agentic ID minting, and this documentation.
