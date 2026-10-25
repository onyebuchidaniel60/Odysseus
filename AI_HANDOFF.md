# AI_HANDOFF.md — Odysseus

## Current status

- Current phase: **Phase 4 — LLM agents (complete)**
- Completed: Phase 1 — Foundation; Phase 2 — SoSoValue client with synthesized index klines; Phase 3 — deterministic validation gate and deviation engine; Phase 4 — Bull/Bear/Chief agents via OpenRouter
- Blocked by: none
- Next task: Phase 5 — Risk engine + SoDEX client (see `IMPLEMENTATION_PLAN.md`)

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

## Phase 3 findings — validation + deviation

### Files

- `lib/pipeline/validation.ts` — 5-check gate returning `passed`, `reason`, `trackingError`.
- `lib/pipeline/deviation.ts` — 7 weight-deviation signals with rolling robust z-scores.
- `tests/unit/pipeline.test.ts` — 14 tests using the Phase 2 fixtures plus synthetic series.

### 30-day window convention

The final kline in every series is treated as the current, possibly incomplete
UTC day and excluded. When at least 31 complete closes are available, the gate
and deviation engine use the last 31 closes (30 daily returns). The fixtures
have 90 bars, so 89 complete closes are available and the fixture tracking error
is `0.004175`, matching Phase 2.

Edge case: the spec requires a constituent to have at least 30 klines, not 31.
A series with exactly 30 raw bars leaves 29 complete closes after the incomplete
day is removed. In that case the code uses the 29 usable closes (28 returns)
rather than rejecting an otherwise valid 30-bar series. The `insufficient_kline_history`
gate still triggers below 30 raw bars.

The validation gate aligns all constituent series to the MAG7.ssi token as the
reference and re-synthesizes the index from the aligned window. Tracking error is
`|R_token - R_synth|` over that window. The token itself must also have at least
30 klines; otherwise the gate returns `insufficient_kline_history`.

### Z-score convention

- Daily deviations are `weight_i × (R_i - R_index)` over the latest up-to-30
  complete daily returns.
- The robust z-score is computed for the latest deviation against the median and
  MAD of the same up-to-30-day deviation window:
  `z = (x - median) / (1.4826 × MAD)`.
- If `MAD === 0`, the code falls back to population standard deviation. If the
  standard deviation is also zero, `z = 0`.
- The returned `constituentReturn` and `indexReturn` are the latest complete
  daily returns, not cumulative 30-day returns. `weightDeviation` is the latest
  day's deviation.
- Signals are sorted descending by `|zScore|`. Equal absolute z-scores retain
  constituent input order.

### Notes

- No Phase 2 code was modified.
- The deviation engine throws `DeviationError` if a constituent is missing a
  timestamp present in the synthetic index or has fewer than two complete
  klines. The validation gate is expected to run first.

## Phase 4 findings — LLM agents (OpenRouter)

### Files

- `lib/pipeline/agents.ts` — Bull, Bear, and Chief agents with Zod schemas.
- `tests/unit/agents.test.ts` — 8 tests; the OpenAI SDK is mocked, no network calls.

### OpenRouter configuration

- SDK: official `openai` package (`openai@7.43.0`), used as the OpenRouter client.
- `baseURL`: `https://openrouter.ai/api/v1`
- Model ID: `openai/gpt-4o-mini`
- `temperature`: `0.2`
- `response_format`: `{ type: "json_object" }`
- `max_tokens`: `1000` (matches `ARCHITECTURE.md` §OpenAI)
- Request timeout: `30_000` ms
- API key: `process.env.OPENROUTER_API_KEY` (present in `.env.local`). Phase 1's
  `lib/env.ts` still requires `OPENAI_API_KEY`; it is unchanged and unused by the
  agents.

The client is created lazily on the first agent call. If `OPENROUTER_API_KEY`
is missing, the SDK throws, the wrapper catches it, and the safe fallback is
returned.

### Reliability behavior

- Each agent validates the response against a Zod schema.
- Any failure (network, timeout, rate limit, empty response, invalid JSON, or
  schema mismatch) is logged with `console.warn` and retried once.
- After the second failure:
  - Bull → empty argument, `confidence: 0`, direction
    `SHORT_CONSTITUENT_LONG_INDEX`.
  - Bear → `recommended: "NO_TRADE"`, `confidence: 0`.
  - Chief → `decision: "NO_TRADE"`, `confidence: 0`, thesis
    `"AI failure fallback"`.
- The Chief schema accepts a string decision so hallucinations can be detected.
  `LONG` (and any other non-`SHORT`/`NO_TRADE` value) is overridden to
  `NO_TRADE`; `LONG` appends `System override: LONG not permitted` to
  `invalidators`.
- Logs never include API keys or full prompts.

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
- LLM (`openai/gpt-4o-mini` via OpenRouter) only produces thesis + constrained
  enum; validation/deviation/risk are deterministic
- `NO_TRADE` is a terminal success state
- Index klines are synthesized from constituent klines because the raw endpoint
  is empty on this API key
- Constituent symbols are normalized from API slugs to tickers for downstream
  SoDEX market matching

## Known issues / open items

- **Phase 4 complete:** agents call OpenRouter at
  `https://openrouter.ai/api/v1` with model `openai/gpt-4o-mini`.
- **Phase 5 verification needed:** confirm which MAG7 constituents have SoDEX
  perps. BTC/ETH/SOL confirmed; BNB/XRP/DOGE/HYPE open. If a constituent lacks a
  perp, the pipeline returns `NO_TRADE — no perp market`.
- **Phase 3 complete:** `R_index` is computed from `synthesizeIndexKlines`, not
  from `/indices/ssimag7/klines`.
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
  `SODEX_API_KEY_NAME`, `SODEX_ACCOUNT_ID`, `OPENROUTER_API_KEY`,
  `OPENAI_API_KEY`, `OPERATOR_SECRET`.
- `OPENROUTER_API_KEY` is used by the Phase 4 agents. `OPENAI_API_KEY` is still
  required by the Phase 1 env schema but is not used by the agents.
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

- Tech stack (Next.js, Drizzle, Postgres, OpenRouter `openai/gpt-4o-mini`, viem)
- Pipeline stage order
- Direction constraint
- `NO_TRADE` as a terminal success state
- Deterministic vs LLM split
- Database schema columns
- Execution venue (testnet only in MVP)

## Next task

Implement **Phase 5 — Risk engine + SoDEX client** from `IMPLEMENTATION_PLAN.md`.

The Risk Engine will consume the `ChiefOutput` produced by
`runChiefAgent`. It must check `decision === "SHORT"` before proceeding; any
other value is `NO_TRADE`. The risk checks themselves remain deterministic and
must not be delegated to the LLM. Phase 5 also adds the SoDEX client and the
`MOCK_SODEX=true` simulated-fill path. Do not proceed to Phase 6 until Phase 5 is
verified and committed.
