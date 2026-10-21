# IMPLEMENTATION_PLAN.md — Odysseus

Each phase is one coding-agent task. The agent must stop after each phase,
run tests, report results, and wait for verification before the next phase.

## Phase 1 — Foundation

**Objective:** Next.js scaffold + DB + env + health.
**Tasks:**
- Scaffold Next.js 14 App Router + TypeScript + Tailwind.
- Install `drizzle-orm`, `postgres`, `zod`, `vitest`.
- Add `lib/env.ts` with Zod validation of all env vars.
- Create `lib/db/schema.ts` with all 6 tables.
- Generate + run migration.
- Add `GET /api/health`.

**Tests:** `npm test` includes one trivial test; `npm run build` succeeds.
**Acceptance:** App runs locally; all tables exist; `/api/health` returns 200.
**Checkpoint:** `feat: foundation`

---

## Phase 2 — SoSoValue client

**Objective:** Typed client + fixtures.
**Tasks:**
- `lib/sosovalue/client.ts` — typed wrapper for the 4 endpoints.
- `lib/sosovalue/types.ts` — response types.
- Save one raw response per endpoint to `fixtures/`.
- Tests parse fixtures; assert constituents sum ≈ 1.0; klines ≥ 30 bars.

**Tests:** `tests/unit/sosovalue.test.ts`.
**Acceptance:** Client returns typed data; fixture tests pass.
**Checkpoint:** `feat: sosovalue client`

---

## Phase 3 — Validation gate + deviation engine

**Objective:** Deterministic pipeline stages.
**Tasks:**
- `lib/pipeline/validation.ts` — 5 checks returning PASS/FAIL + reason.
- `lib/pipeline/deviation.ts` — weight deviation + rolling 30-day robust z-score.
- Unit tests with synthetic data.

**Tests:** Lagging → negative deviation; overextended → positive; tracking error check.
**Acceptance:** Gate returns PASS/FAIL; deviation math correct on synthetic data.
**Checkpoint:** `feat: validation + deviation`

---

## Phase 4 — LLM agents

**Objective:** Bull/Bear/Chief with structured JSON.
**Tasks:**
- `lib/pipeline/agents.ts` — three functions, Zod schemas, retry-once, safe fallback.
- Chief override: `LONG` → `NO_TRADE`, logged.
- Prompts exactly as in `ARCHITECTURE.md` §Agents.

**Tests:** Mock OpenAI valid/invalid JSON; override test.
**Acceptance:** Invalid LLM output falls back to `NO_TRADE`.
**Checkpoint:** `feat: ai agents`

---

## Phase 5 — Risk engine + SoDEX client

**Objective:** Deterministic risk + testnet order placement.
**Tasks:**
- `lib/pipeline/risk.ts` — 5 checks.
- `lib/sodex/client.ts` — REST + EIP-712 signing via `viem`.
- `MOCK_SODEX=true` mode returns simulated fills.
- Verify which MAG7 constituents have perps (BTC/ETH/SOL confirmed; XRP/BNB/DOGE/ADA to check).

**Tests:** Risk rejects on wide spread; mock execution writes record.
**Acceptance:** Mock run writes `execution` row.
**Checkpoint:** `feat: risk + sodex`

---

## Phase 6 — Orchestrator + API routes

**Objective:** End-to-end pipeline.
**Tasks:**
- `lib/pipeline/orchestrator.ts` — runs stages, persists each.
- `POST /api/run` — operator auth, run lock, returns run_id.
- `GET /api/runs`, `GET /api/runs/:id`.
- Run lock via unique index `(index_ticker, DATE(observed_at))`.

**Tests:** Integration test with fixtures → decision row exists.
**Acceptance:** One full run completes; all rows persisted.
**Checkpoint:** `feat: pipeline orchestrator`

---

## Phase 7 — Dashboard

**Objective:** Single-screen pipeline view.
**Tasks:**
- `app/page.tsx` — deviation table, agent debate, decision card, risk checklist, execution status, audit timeline.
- Components: `DeviationTable`, `AgentDebate`, `DecisionCard`, `RiskChecklist`, `AuditTimeline`, `StatusBadge`.
- Loading, empty, error states.
- `NO_TRADE` badge in amber, not red.

**Tests:** Playwright: replay overextended fixture → `SHORT`; replay lagging → `NO_TRADE`.
**Acceptance:** Operator understands outcome without raw JSON.
**Checkpoint:** `feat: dashboard`

---

## Phase 8 — Replay + audit polish

**Objective:** Historical replay + full audit.
**Tasks:**
- `app/replay/page.tsx`.
- `app/runs/[id]/page.tsx`.
- Export JSON button.
- Audit timeline shows every stage with timestamps.

**Tests:** Replay produces same decision as original run.
**Acceptance:** Three demo scenarios replayable.
**Checkpoint:** `feat: replay + audit`

---

## Phase 9 — Live testnet verification

**Objective:** One real testnet order.
**Tasks:**
- Fund testnet account.
- Set `MOCK_SODEX=false`.
- Run live; reconcile order status; record.
- Screenshot for demo.

**Tests:** Order ID confirmed; `execution.status = 'filled'`.
**Acceptance:** At least one real testnet execution logged.
**Checkpoint:** `feat: live testnet execution`