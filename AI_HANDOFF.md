# AI_HANDOFF.md — Odysseus

## Current status

- Current phase: **Phase 2 — SoSoValue client (complete)**
- Completed: Phase 1 — Foundation; Phase 2 — SoSoValue client with synthesized index klines
- Blocked by: none
- Next task: Phase 3 — Validation gate + deviation engine (see `IMPLEMENTATION_PLAN.md`)

## Project context

- Product: autonomous SSI index-deviation agent
- Index: `ssimag7` (MAG7.ssi)
- Signal: `weight_deviation = w_i × (R_i − R_index)`, rolling 30-day robust z-score, threshold |z| ≥ 2.0
- Decision: `SHORT constituent perp + LONG MAG7SSI spot` only when overextended; otherwise `NO_TRADE`
- Data: SoSoValue daily klines only (90-day window on the current API plan, no intraday)
- Execution: SoDEX testnet

## Phase 2 findings — SoSoValue API

### MAG7.ssi constituents (live, current weights)

| Client symbol | API `symbol` | `currency_id` | Weight |
| --- | --- | --- | --- |
| `btc` | `bitcoin` | `1673723677362319866` | 0.7363 |
| `eth` | `ethereum` | `1673723677362319867` | 0.1377 |
| `bnb` | `binance-coin` | `1673723677362319869` | 0.0432 |
| `xrp` | `xrp` | `1673723677362319871` | 0.0420 |
| `doge` | `dogecoin` | `1673723677362319874` | 0.0062 |
| `sol` | `solana` | `1673723677362319875` | 0.0263 |
| `hype` | `hyperliquid` | `1862702593582522369` | 0.0083 |

MAG7.ssi token `currency_id`: `1871600836616355842`.

The current basket contains **Hyperliquid (HYPE)**, not ADA. ADA is not a
MAG7.ssi constituent; no ADA kline fixture was captured.

The `/indices` list returns `ssiMAG7` (camel case). Constituents and klines
endpoints accept `ssimag7` case-insensitively. The project continues to use
`ssimag7`.

### Differences between documented and actual response shapes

- All v1 responses are wrapped in `{ code, message, data, details }`; the
  documentation shows bare arrays for several endpoints.
- Constituent `symbol` is a CoinGecko-style slug (`bitcoin`, `binance-coin`,
  `hyperliquid`), not a ticker. The client normalizes to tickers (`btc`, `bnb`,
  `hype`, …) with a deterministic alias map in `lib/sosovalue/client.ts`.
- Kline `timestamp` and `volume` are JSON strings; OHLC values are numbers.
  `parseKlines` converts all six fields to numbers, rejects inconsistent OHLC,
  and requires strictly ascending timestamps.
- Currency klines include `volume`; the documented index-kline shape does not.
  Missing volume is normalized to `0`.
- Kline history is limited to 90 days on the current API key (documentation says
  three months). `start_time` / `end_time` must be millisecond Unix timestamps;
  second-based values are rejected as exceeding the 90-day limit.
- `GET /indices/ssimag7/klines?interval=1d` returns `data: []` for all 13 indices
  and every valid range. The raw endpoint is not used.

## Known API limitation — index klines

The `/indices/ssimag7/klines` endpoint returns empty data for all valid requests.
Workaround: index klines are synthesized from constituent klines using current
weights. Empirical validation: weighted constituent return series correlates
0.99981 with the MAG7.ssi token's own return series, with ~3 bps mean absolute
daily difference.

Phase 3's validation gate must compute `R_index` from the synthesized series,
not from the raw endpoint. The `tracking_error` check in the gate becomes a
sanity check on the synthesis itself (comparing synthesized return to the token's
return), not a check on the raw endpoint.

### Fixtures

`fixtures/` contains raw, unmodified API responses:

- `indices.json`
- `ssimag7-constituents.json`
- `btc-klines.json`, `eth-klines.json`, `xrp-klines.json`, `bnb-klines.json`,
  `sol-klines.json`, `doge-klines.json`, `hype-klines.json`
- `ssimag7-token-klines.json`

Each kline fixture has 90 daily bars. `lib/sosovalue/synthesize.ts` aligns the
common timestamps, normalizes the current weights, and builds an index series
whose first close is 1000. The synthetic 30-day return is checked against the
MAG7.ssi token return using the last 30 complete daily bars (the current,
incomplete UTC day is excluded). The captured fixtures differ by 0.004175, below
the 0.5% tolerance.

## Important decisions

- Daily frequency only — SoSoValue klines are `1d` interval, 90-day window on
  the current plan
- Weights have no API timestamp — client stamps `observed_at`
- Direction constraint: lagging constituents → `NO_TRADE` (spot is cash-only,
  cannot short the index)
- LLM (`gpt-4o-mini`) only produces thesis + constrained enum;
  validation/deviation/risk are deterministic
- `NO_TRADE` is a terminal success state
- Index klines are synthesized from constituent klines because the raw endpoint
  is empty on this API key
- Constituent symbols are normalized from API slugs to tickers for downstream
  SoDEX market matching

## Known issues / open items

- **Phase 5 verification needed:** confirm which MAG7 constituents have SoDEX
  perps. BTC/ETH/SOL confirmed; BNB/XRP/DOGE/HYPE open. If a constituent lacks a
  perp, the pipeline returns `NO_TRADE — no perp market`.
- **Phase 3:** compute `R_index` from `synthesizeIndexKlines`, not from
  `/indices/ssimag7/klines`.
- **Phase 6:** the unique index on
  `(index_ticker, DATE(observed_at AT TIME ZONE 'UTC'))` will cause the second
  insert of the same day to fail with PostgreSQL error `23505`. The Phase 6
  orchestrator must catch `23505` and return the existing run / `409` instead of
  crashing.
- SoSoValue constituents endpoint returns no timestamp; weight freshness is
  assumed.
- No historical weight series — backtests would use current weights (mitigated
  by the 30-day calibration window).

## Environment

- See `ARCHITECTURE.md` §Stack and `PROJECT_SPEC.md` §Security.
- Env vars required: `DATABASE_URL`, `SOSO_API_KEY`, `SODEX_PRIVATE_KEY`,
  `SODEX_API_KEY_NAME`, `SODEX_ACCOUNT_ID`, `OPENAI_API_KEY`, `OPERATOR_SECRET`.
- Optional: `Z_SCORE_THRESHOLD` (default 2.0), `TRACKING_ERROR_TOLERANCE`
  (default 0.02), `MAX_POSITION_PCT` (default 0.10), `MOCK_SODEX` (default
  false).

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
npm run db:migrate
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

Implement **Phase 3 — Validation gate + deviation engine** from
`IMPLEMENTATION_PLAN.md`. Do not proceed to Phase 4 until Phase 3 is verified and
committed.
