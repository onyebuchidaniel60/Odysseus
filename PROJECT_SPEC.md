# PROJECT_SPEC.md — Odysseus Deviation Agent

## 1. Product Overview

Odysseus is an autonomous agent that detects mispriced deviations between SSI index constituents and their weight-implied returns, debates whether the deviation is tradeable, and executes a risk-managed relative-value trade on SoDEX — or returns `NO_TRADE` when the edge is insufficient.

**Hackathon:** SoSoValue "Build Your One-Person On-Chain Finance Business"
**Index:** MAG7.ssi (`ssimag7`)
**Execution venue:** SoDEX testnet (spot + perps)

## 2. Users

- **Operator** (single): configures strategy, triggers runs, views dashboard and audit log.
- **Agent** (system): fetches data, computes deviation, runs LLM agents, executes testnet orders.
- **Auditor** (read-only): views completed runs.

No public signup. No multi-user accounts in MVP.

## 3. Core User Flow

1. Operator triggers a run (cron or manual).
2. System fetches MAG7.ssi constituents, index klines, and constituent klines from SoSoValue.
3. Validation gate runs 5 deterministic checks. Any failure → `NO_TRADE` (data).
4. Deviation engine computes `weight_deviation = w_i × (R_i − R_index)` and rolling 30-day robust z-score.
5. If no constituent has `|z| ≥ 2.0` → `NO_TRADE` (insignificant).
6. If top candidate is lagging (`deviation < 0`) → `NO_TRADE` (no executable hedge leg).
7. Bull Agent, Bear Agent, Chief Agent run in sequence with structured JSON output.
8. Risk engine runs 5 deterministic checks. Any failure → `NO_TRADE` (risk).
9. Execution Agent places SHORT perp on constituent + LONG spot on MAG7SSI on SoDEX testnet.
10. Every stage persists to DB and appears on the dashboard.

## 4. Features (MVP)

- **F-1 Data Ingestion** — SoSoValue client for constituents, index klines, constituent klines.
- **F-2 Validation Gate** — deterministic, 5 checks, returns PASS/FAIL with reason code.
- **F-3 Deviation Engine** — weight-adjusted deviation + rolling z-score.
- **F-4 Bull Agent** — argues mispricing, cites packet numbers.
- **F-5 Bear Agent** — argues justification or execution risk.
- **F-6 Chief Agent** — constrained decision: `SHORT` or `NO_TRADE` only.
- **F-7 Risk Engine** — deterministic, 5 checks.
- **F-8 Execution Agent** — SoDEX testnet orders with idempotency.
- **F-9 Dashboard** — single-screen pipeline view.
- **F-10 Replay** — rerun saved snapshots.
- **F-11 Audit Log** — every stage persisted, exportable.

## 5. Business Rules

1. `NO_TRADE` is a valid success outcome, not an error.
2. Only **overextended** constituents can be traded (short perp + long index spot).
3. **Lagging** constituents always return `NO_TRADE` — no executable hedge leg on spot-only venue.
4. Maximum **one pipeline run per day** per index.
5. Maximum **one open position** per index at a time.
6. Weights assumed valid until next monthly rebalance; system stamps `observed_at`.
7. Leverage: 1x spot, max 2x perp.
8. LLM output invalid or timeout → `NO_TRADE`.
9. Chief returning `LONG` is overridden to `NO_TRADE` and logged.
10. Deterministic logic (validation, deviation, risk) never delegated to LLM.

## 6. Data Model

- `index_snapshot` — one per run; raw klines + constituents + validation result.
- `deviation_signal` — one per constituent per snapshot.
- `decision` — one per run; Bull/Bear/Chief outputs + final decision.
- `risk_check` — one per decision; per-check results + approval.
- `execution` — one per approved decision; order legs + status.
- `audit_log` — every event in a run.

See `ARCHITECTURE.md` §Data Model for full schema.

## 7. Authentication

Single operator. Static `OPERATOR_SECRET` required on `POST /api/run` and dashboard access. No user accounts.

## 8. API Requirements

- `POST /api/run` — trigger pipeline
- `GET /api/runs` — list runs
- `GET /api/runs/:id` — run detail
- `GET /api/health` — dependency health

## 9. UI Requirements

- **Dashboard `/`** — deviation table, agent debate, decision card, risk checklist, execution status, audit timeline.
- **Run detail `/runs/[id]`** — full raw payloads + timeline.
- **Replay `/replay`** — pick snapshot, rerun pipeline.

## 10. Security Requirements

- All API keys and private keys server-only.
- No user-supplied URLs.
- LLM context limited to numeric fields — no free-text news in MVP.
- `client_order_id` idempotency on all SoDEX orders.
- Run lock prevents concurrent runs.

## 11. Out of Scope

- Earnings data, EPS, consensus, guidance.
- Intraday klines.
- Shorting the index token.
- Mainnet execution.
- Multi-index, multi-user, payments.
- Custom index creation.
- Mobile app.

## 12. Acceptance Criteria

- One live run completes end-to-end without human intervention.
- Three demo scenarios replayable: SHORT, lagging NO_TRADE, validation NO_TRADE.
- At least one SoDEX testnet execution confirmed.
- Audit log contains every pipeline stage.
- Dashboard communicates outcome without reading raw JSON.