# Commercial Intelligence Network — Full Build Plan
Date: 2026-08-28
Status: r1 in progress — repos cloned, distilling
Source: user 18-point direction + 4 open-source refs

## Thesis
Raw information → Signals → Entities → Relationships → Hypotheses → Verification → Commercial intent → Ranked opportunities → Action
The system transforms public information into structured intelligence answering: where demand is forming, why, who is involved, when purchase is likely, what evidence proves it.

## What we already have (still fits)
- Dispatch-or-poll orchestrator with early-exit when all agents responded (run.ts tryGradeIfReady)
- Source canonicalization keeping tender ids, stripping utm/fbclid/hash
- Grading weight = relevance×quality×independence×reliability×impact with LLM 6-month demand re-scoring
- Readout always attaches up to 6 deduped https sources + why_relevant per company
- Failure credit +1 free run on failed (recursive)
- Contact passthrough when individual==business (X/Medium etc.)

## Gaps vs 18-point direction
- No hypothesis generator (inventory → A/B/C/D hypotheses)
- No evidence graph (entity→relation→entity)
- No task-based investigation state
- Single-shot dispatch, no recursive traversal with budgets
- Prime-signals is monolithic (needs 9 specialists)
- No YouTube pipeline
- No facts vs inference labels in human language
- Single confidence vs multi-dimension scoring
- No contradiction surfacing

## Patterns to steal (from 4 repos — subagents distilling)

### YashNuhash/Deep-Research-Agent — Hierarchical + Evidence Graph
- TaskGraph DAG with dependencies, budgets, model hints (src/planning/task_graph.py)
- Hierarchical Planner that builds DAG from objective (src/agents/hierarchical_planner.py)
- Evidence Graph linking claims↔sources with confidence (src/evidence/graph.py)
- Source Validator LLM-as-Judge (src/agents/source_validator.py)
- Claim Extractor normalizing claims (src/agents/claim_extractor.py)
- Reflexion loop that re-plans when gaps detected (src/agents/reflexion.py)
→ Steal: DAG shape, evidence edge type, validator prompt shape, reflexion gap → new tasks.

### obinopaul/DeepResearchAgent (Morgana) — LangGraph + Middleware
- LangGraph deep agent with deep_research / podcast graphs (langgraph.json, src/workflow.py)
- FilesystemMiddleware + SubAgentMiddleware (task tool) for specialist crew
- Checkpointed plans via LangGraph checkpoint saver
→ Steal: sub-agent task tool pattern, checkpoint idea (adapt to 0G), filesystem persistence thought.

### jolovicdev/shandu v3 — Lead Orchestrator iterative loop
- Engine → Orchestrator → Lead + Parallel Search subagents + Citation agent (ARCH.md)
- Iterative loop: Lead plans → fanout parallel tasks (semaphore-bounded) → Lead synthesizes → decision continue?
- Citation ledger merges URL variants, sanitizes titles, excludes low-credibility
- Scrape service: trafilatura→readability→BS4, LRU cache, per-domain rate limit, publication-date extraction
- SQLite memory for run context
→ Steal: bounded parallelism, citation ledger merge, scraper layered extraction.

### arcodergh/miroflow — Multi-stage agentic flow
- Hydra config per agent (provider/model/temp) + tool MCP servers (searching-serper, browsing, code)
- Main agent + sub-workers via manager, tool call limits per turn
→ Steal: config-per-specialist, tool MCP abstraction, boxed answer pattern.

## Planned architecture — mapping your 18 points

### 1. Orchestrator (Intelligence Director)
- Receives objective + inventory (from app.supply).
- Generates hypotheses via LLM (hypothesis generator) — not just forwarding question.
- Maintains InvestigationState:
  Investigation { objective, inventory, market, hypotheses[], entities[], evidence[], openQuestions[], tasks[], confidence, opportunities[] }
- Decides: what to discover, what sources could contain signals, follow-ups, verification, when enough to produce opportunity.
- Loose analog: Yash hierarchical planner + shandu lead agent.

### 2. Hypothesis generator
- Input: inventory text + question.
- Output: 3-6 hypotheses like your A-D, each with: label, what signal would indicate demand, what entity types, what sources.
- For $500k electricals → hotels, construction, infrastructure, expansion signals with specific facility types.
- Implemented as LLM call with few-shot examples (your A-D).

### 3+4+5. Evidence graph + agent orchestration
- Schema: nodes (Entity: company, project, person, location), edges (Relationship: works_for, contracted_for, requires, owns, announced, status), observations (Signal with source, published_at, confidence).
- Agents return Findings { entity, claim, claim_type, source (https), published_at, discovered_at, confidence, related_entities[], recommended_tasks }.
- Orchestrator ingests findings into graph, dedups sources via canonicalization, decides next tasks.
- Every claim traceable to ≥1 observation+source.

### 6. Recursive investigation (controlled)
- Each inquiry gets budgets: token budget, time budget (sourcing window), depth limit (e.g. 2-3 hops), source limit (e.g. 30), duplicate detection via evidence graph, confidence threshold.
- New discoveries (e.g. "XYZ Engineering handles electrics") become new investigation nodes enqueued as tasks if budget remains.
- Termination: budgets exhausted, diminishing returns (no new independent source in last hop), or confidence threshold met.

### 7. Source diversity (now)
- Internal specialists cover: same 9 you listed. Each knows which source categories it owns.
- External contributors remain generic — they just submit claims, we grade them.

### 8. YouTube first-class
- YouTube Agent: discover videos via search, fetch metadata + transcript/captions, analyze, extract entities/claims/project info, link to graph, recommend follow-ups.
- Same architecture extensible to podcasts.

### 9. Pipeline Signal→Hypothesis→Verification→Opportunity
- Implemented as: Signal (source observation) → Hypothesis (commercial reasoning) → Investigation tasks → Verification (independent corroboration) → Commercial interpretation (facts vs inference) → Ranked Opportunity.

### 10. Facts vs inference
- Each opportunity exposes: Confirmed fact (with source), Strong evidence, Probable inference, Weak inference, Unverified hypothesis — but rendered in human language, not robot labels. E.g. "Developer announced project [fact] — so it will likely need lighting [probable inference, why: hotels need electrical per room]."

### 11. Scoring
- Dimensions: relevance, demand probability, timing, scale, evidence strength, decision-maker accessibility, freshness, competition, confidence.
- Example rendering already in readout: score + human reason list. Weighted combination, stored per opportunity.

### 12+13+14. Task state + specialists + result contract
- Orchestrator task state persisted (investigation_json on inquiries).
- 9 internal specialist agents: Web Research, Social Signal, Project Intelligence, Company Intelligence, Person/Role, Procurement, Media/YouTube, Verification, Synthesis.
- Each specialist has bounded responsibility, hydra-like config, tool MCP (search, scrape, youtube).
- Result contract evolves to the JSON you sketched (task_id, findings[], new_entities, new_questions, recommended_tasks).

### 15+16. Distillation + contradiction
- Keep current duplicate distillation (canonicalization). Extend to same press release = one source.
- Contradiction detection: when two claims about same entity/field conflict, create contradiction record with both claims, sources, dates, weight toward newer/authoritative — surface to user.

### 17+18. UX + thesis
- Keep current readout UX (ranked, evidence chips, contact) but add: evidence graph drill-down, facts vs inference labeling, score breakdown.

## Implementation order (build entire app)
r1 clone+distill (now)
r2 plan finalization (this doc)
r3 hypothesis generator + investigation state
r4 evidence graph + facts vs inference
r5 9 specialists + source diversity
r6 YouTube pipeline
r7 expanded scoring + contradiction + budgets
