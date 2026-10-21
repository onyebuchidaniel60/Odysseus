# AI_HANDOFF.md — Odysseus

## Current status

- Current phase: **Phase 1 — Foundation** (not started)
- Completed: none
- Blocked by: none
- Next task: Phase 1 (see `IMPLEMENTATION_PLAN.md`)

## Project context

- Product: autonomous SSI index-deviation agent
- Index: `ssimag7` (MAG7.ssi)
- Signal: `weight_deviation = w_i × (R_i − R_index)`, rolling 30-day robust z-score, threshold |z| ≥ 2.0
- Decision: `SHORT constituent perp + LONG MAG7SSI spot` only when overextended; otherwise `NO_TRADE`
- Data: SoSoValue daily klines only (3-month window, no intraday)
- Execution: SoDEX testnet

## Important decisions

- Daily frequency only — SoSoValue klines are `1d` interval, 3-month window
- Weights have no API timestamp — client stamps `observed_at`
- Direction constraint: lagging constituents → `NO_TRADE` (spot is cash-only, cannot short index)
- LLM (`gpt-4o-mini`) only produces thesis + constrained enum; validation/deviation/risk are deterministic
- `NO_TRADE` is a terminal success state

## Known issues / open items

- **Phase 5 verification needed:** confirm which MAG7 constituents have SoDEX perps. BTC/ETH/SOL confirmed; XRP/BNB/DOGE/ADA open. If a constituent lacks a perp, the pipeline returns `NO_TRADE — no perp market`.
- SoSoValue constituents endpoint returns no timestamp; weight freshness is assumed.
- No historical weight series — backtests would use current weights (mitigated by 30-day calibration window).

## Environment

- See `ARCHITECTURE.md` §Stack and `PROJECT_SPEC.md` §Security.
- Env vars required: `DATABASE_URL`, `SOSO_API_KEY`, `SODEX_PRIVATE_KEY`, `SODEX_API_KEY_NAME`, `SODEX_ACCOUNT_ID`, `OPENAI_API_KEY`, `OPERATOR_SECRET`.
- Optional: `Z_SCORE_THRESHOLD` (default 2.0), `TRACKING_ERROR_TOLERANCE` (default 0.02), `MAX_POSITION_PCT` (default 0.10), `MOCK_SODEX` (default false).

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
npx drizzle-kit push
```

## Do NOT change without asking

- Tech stack (Next.js, Drizzle, Postgres, OpenAI `gpt-4o-mini`, viem)
- Pipeline stage order
- Direction constraint
- `NO_TRADE` as a terminal success state
- Deterministic vs LLM split
- Database schema columns
- Execution venue (testnet only in MVP)

## Next task

Implement **Phase 1 — Foundation** from `IMPLEMENTATION_PLAN.md`.
Do not proceed to Phase 2 until Phase 1 is verified and committed.