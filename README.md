# Prime Layer

**A business tells the network what it needs to move. Specialist agents fan out across the open web and regulatory filings, and what comes back is not a lead list — it is a short readout of real companies showing live demand signals, every name carrying its evidence.**

Prime Layer is a B2B demand-intelligence marketplace running on 0G. The buyer states a question in plain language ("which hotel chains are expanding right now", or "we took in $13M of electrical stock, find us partners who need it"). The orchestrator dispatches the question to every agent on the grid. Agents research independently — news sweeps, GDELT, SEC EDGAR filings — and submit claims with verifiable source URLs. The orchestrator clusters duplicate sources, grades each claim (deterministic scoring, then an LLM pass through 0G Compute that judges relevance and evidence quality), merges everything into one company-per-recommendation readout written by a soul-driven synthesis voice, and pays contributing agents from the buyer's actual payment, split 60/40 between the contributor pool and the platform.

The core bet: five agents citing the same article count as one source, not five. Duplication never raises confidence; independent corroboration does.

## How a run flows

```
 BUYER (own Privy wallet)              THE GRID                     SETTLEMENT
 ───────────────────────              ─────────                    ──────────
 request + pay per run      ──►   dispatch to all agents   ──►   cluster + grade (LLM)
                                  │                                        │
                    ┌─────────────┴─────────────┐                          ▼
                    ▼                           ▼                synthesize (soul.md)
              Google News RSS             SEC EDGAR 8-Ks          one merged readout,
              GDELT                       primary filings         clickable sources
                    │                           │                        │
                    └──► claims + source URLs ◄─┘            60% → agents by weight
                                                             40% → platform
```

1. **Request.** A signed-in business types what it needs. Every account gets five free runs; after that each run is paid from the buyer's own Privy wallet in native 0G — one payment, one run, no balances.
2. **Dispatch.** The orchestrator sends the same command to every registered agent. Each agent decides for itself whether to answer.
3. **Research.** Agents sweep free public sources: Google News RSS and GDELT for news, SEC EDGAR full-text search for primary regulatory filings. Filing-derived claims carry the exact registrant name and link straight to the filed document.
4. **Grade.** Deterministic scoring first (source tiers, independence, recency, money-and-capacity mentions). Then the LLM pass via 0G Compute Router judges only relevance and evidence quality — it never punishes duplication, it orders reading priority.
5. **Synthesize.** A soul-driven pass (`soul.md`) merges same-company entries into single recommendations, writes why each company matters for *this* buyer's goods, attaches the sources — and when the evidence is thin, says so honestly instead of pretending.
6. **Settle.** The buyer's actual payment becomes the pot: 60% is split among contributing agents proportional to their graded weight, paid on-chain from the platform signer. Free-run pools are platform-funded so agents still earn.
7. **Persist.** Every evidence record, readout, settlement roll-up, and demand-graph opportunity is anchored to 0G Storage with a merkle root stamped back on its row. The graph survives the database.

## What's built

| Piece | Where | Status |
|---|---|---|
| Workspace app (request, readouts, demand graph, evidence ledger, supply records) | TanStack Start app under `/app` | working, all pages on live data |
| Orchestrator pipeline (dispatch → grade → synthesize → settle) | `src/lib/orchestrator/` | complete; verified end-to-end with real cycles |
| LLM grading via 0G Compute Router | `src/lib/orchestrator/llm-grade.ts` | live in `llm` mode; deterministic fallback if the router is down |
| Pay-per-run payments from the buyer's own Privy wallet | `src/lib/orchestrator/credits.ts` | verified on-chain: exact-amount check, replay rejection, tx bound to inquiry |
| Revenue split (60% contributor pool / 40% platform) from the real payment | `src/lib/0g/payments.ts` | wired into settlement; tested |
| Agent payouts in native 0G | `src/lib/0g/payouts.ts` | live; per-wallet aggregation, retry sweeper (`scripts/retry-payouts.ts`) |
| Agentic ID (ERC-7857) identity NFTs for grid agents | `src/lib/0g/agentic-id.ts` | minting against 0G's pre-deployed contract (fee 0); Prime Signals holds token 137 |
| 0G Storage anchoring (evidence, readouts, settlements, opportunities) | `src/lib/0g/evidence-anchor.ts` | live; all existing rows backfilled |
| First-party agent: Prime Signals | `agents/prime-signals/index.ts` | live on :8790 — Google News RSS + GDELT + SEC EDGAR, topic-relevance gating, cross-source claim merging |
| Soul-driven synthesis voice | `soul.md` | live; honest preambles when evidence is weak |

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
