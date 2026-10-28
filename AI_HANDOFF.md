# AI_HANDOFF.md — Odysseus

## Current status

- Current phase: **Phase 9 — Live testnet verification (blocked)**
- Completed: Phase 1 — Foundation; Phase 2 — SoSoValue client with synthesized index klines; Phase 3 — deterministic validation gate and deviation engine; Phase 4 — Bull/Bear/Chief agents via OpenRouter; Phase 5 — deterministic risk engine and SoDEX mock/signed client; Phase 6 — pipeline orchestrator and run APIs; Phase 7 — dashboard and run detail UI; Phase 8 — replay API, replay page, and audit export
- Phase 9 progress: live SoDEX auth, symbol resolution, perps sizing, mark prices, liquidity preflight, order-status reconciliation, and the `ALLOW_PAPER_SPOT` fallback are implemented and tested. Real perps fills were confirmed. A complete pipeline execution is still blocked because the Chief returns `NO_TRADE` for the current HYPE signal and the index spot book has no asks.
- Blocked by: Chief decision quality (HYPE weight is only 0.83%, so the Bear argues execution risk is unacceptable) and `vMAG7ssi_vUSDC` spot liquidity (0 asks).
- Next task: operator decision on whether to adjust the agent prompt/strategy or wait for a signal the Chief approves. Do not start Phase 10.

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

## Phase 5 findings — risk engine + SoDEX client

### Files

- `lib/pipeline/risk.ts` — deterministic risk engine.
- `lib/sodex/client.ts` — SoDEX mock fills and signed testnet REST client.
- `tests/unit/risk.test.ts` — 7 tests.
- `tests/unit/sodex.test.ts` — 5 tests (3 mock mode, 2 real-path tests with mocked `fetch`).
- `package.json` / `package-lock.json` — added `viem@^2.57.11`.

### Risk engine

`evaluateRisk(context)` returns `{ approved, checks, approvedSizeUsd?, stopLossPct? }`.
`checks` entries are `{ name, passed, value, reason? }`.

- `decision === "NO_TRADE"` short-circuits to one failed `decision` check with
  reason `Chief decided no trade`; no other checks are computed.
- `data_confidence`: fails below `0.8` with `insufficient_data_confidence`.
- `spread`: fails above `0.005` with `spread_too_wide`.
- `depth`: fails below `$10,000` with `insufficient_liquidity`.
- `ai_confidence`: fails below `0.6` with `low_ai_confidence`.
- `position_size`: `approvedSizeUsd = portfolioBalanceUsd × 0.10`, capped at
  `depthUsd × 0.10`; when capped, the check records `capped_by_depth`.
- `stop_loss`: always passes with `0.05`.
- On failure, `approvedSizeUsd` and `stopLossPct` are omitted. On approval,
  `approvedSizeUsd` is the capped size and `stopLossPct` is `0.05`.
- Risk remains fully deterministic and does not call the LLM.

### SoDEX client behavior

`placeOrders(legs, mock)` preserves leg order and returns
`{ success, orderId?, legs, error? }`.

- Mock mode: waits 500ms, returns one random UUID `orderId` per leg, each with
  `status: "filled"`, and `success: true`.
- Real mode: one signed POST per leg, processed sequentially. A batch UUID is
  generated per call, sent as `X-Client-Order-ID`, and embedded in each order's
  `clOrdID` (30 alphanumeric characters, unique per leg).
- Requests time out after 10s. HTTP errors, timeouts, invalid JSON, non-zero
  SoDEX response codes, per-order rejection codes, and signing/config errors all
  return `success: false` with a structured `error` string. No secrets are logged.
- Real mode does not retry automatically.
- Tests use a fixed test private key and mocked `fetch`; they make no network calls.
  Signatures are verified with viem's `verifyTypedData`.

### SoDEX signing and payload (verified against docs + Python SDK)

EIP-712 domain:

- Spot: `name: "spot"`, `version: "1"`, `chainId: 138565`,
  `verifyingContract: 0x0000000000000000000000000000000000000000`.
- Perps: `name: "futures"`, same version/chain/contract.
- Testnet chain ID is `138565`; mainnet is `286623`.
- Type: `ExchangeAction(bytes32 payloadHash, uint64 nonce)`.

Signing pipeline:

1. Build `{ "type": <action>, "params": <params> }`.
2. `payloadHash = keccak256(utf8(JSON.stringify(signingPayload)))` using compact
   JSON. Field order matters; it must match the Go struct order.
3. Sign the EIP-712 `ExchangeAction` with `payloadHash` and a millisecond nonce.
4. Wire signature is `0x01 || 65-byte ECDSA signature` (66 bytes total).
5. HTTP body is `params` only, **not** the `{ type, params }` signing wrapper.

Headers:

- `X-API-Key`: `SODEX_API_KEY_NAME`
- `X-API-Sign`: `0x01...` wire signature
- `X-API-Nonce`: decimal millisecond nonce
- `X-API-Chain`: `138565`
- `Content-Type: application/json`, `Accept: application/json`

Spot order:

- Endpoint: `POST /api/v1/spot/trade/orders/batch` (docs/SDK). The older
  `/api/v1/spot/trade/orders` path is not the current batch endpoint.
- Action: `batchNewOrder`.
- Params field order:
  `accountID`, `orders[]`; each order:
  `symbolID`, `clOrdID`, `side`, `type`, `timeInForce`, `price?`, `quantity?`,
  `funds?`.
- Current client uses market orders: `type: 2`, `timeInForce: 3` (IOC), and
  `funds` for the USD notional.

Perps order:

- Endpoint: `POST /api/v1/perps/trade/orders`.
- Action: `newOrder`.
- Params field order: `accountID`, `symbolID`, `orders[]`; each order:
  `clOrdID`, `modifier`, `side`, `type`, `timeInForce`, `price?`, `quantity?`,
  `funds?`, `stopPrice?`, `stopType?`, `triggerType?`, `reduceOnly`,
  `positionSide`.
- Current client uses `modifier: 1`, `type: 2`, `timeInForce: 3`,
  `reduceOnly: false`, `positionSide: 1` (BOTH), and `funds`.

Enums:

- Side: BUY=`1`, SELL=`2`.
- Type: LIMIT=`1`, MARKET=`2`.
- Time in force: GTC=`1`, FOK=`2`, IOC=`3`, GTX=`4`.
- Modifier: NORMAL=`1`.
- Position side: BOTH=`1`, LONG=`2`, SHORT=`3`.

Response:

- Envelope: `{ code, timestamp, data?, error? }`; non-zero `code` is an error.
- Order results are in `data[]`: `{ code, clOrdID, orderID?, error? }`.
- Non-zero per-order `code` means rejection. The client maps accepted orders to
  `status: "submitted"`.

### Live-mode TODOs / discrepancies

- `SODEX_ACCOUNT_ID` is validated by `lib/env.ts` as a UUID, but SoDEX signing
  expects a numeric `uint64` `accountID`. The client currently rejects a
  non-numeric value before sending. Phase 9 must reconcile the env value with the
  numeric SoDEX trading account ID.
- `OrderLeg.symbol` is a ticker (`btc`, `ssimag7`) in the pipeline, but SoDEX
  order payloads require numeric `symbolID`s. The client currently requires
  `leg.symbol` to be numeric in real mode. Phase 9 must add market metadata
  resolution (or pass numeric IDs at the call site).
- SoDEX docs allow `funds` only for market BUY. The client currently sends
  `funds` for both sides. A live perps SHORT will require `quantity` (base asset)
  derived from mark price and symbol precision. This is a Phase 9 blocker; do not
  run live SHORT orders until resolved.
- No live SoDEX call was made in Phase 5. Real-path tests use mocked `fetch`.

## Phase 6 findings — orchestrator + API routes

### Files

- `lib/pipeline/orchestrator.ts` — end-to-end pipeline and persistence store.
- `app/api/run/route.ts` — operator-authenticated pipeline trigger.
- `app/api/runs/route.ts` — last 20 runs.
- `app/api/runs/[id]/route.ts` — full run detail.
- `tests/unit/orchestrator.test.ts` — 7 tests with mocked externals and an
  in-memory store.

### Orchestrator behavior

`runPipeline(options)` returns
`{ success, runId?, decision: "SHORT" | "NO_TRADE", reason?, error? }`.
`NO_TRADE` returns `success: true`. Unexpected failures and execution failures
return `success: false` with `error`.

Flow:

1. `listIndices()` confirms `ssimag7` is available.
2. `getConstituents("ssimag7")` fetches the seven constituents.
3. `getCurrencyKlines()` fetches all constituent series plus the MAG7.ssi token
   series (`1871600836616355842`).
4. `synthesizeIndexKlines()` builds the index series.
5. Insert `index_snapshot` with `validation_status: "pending"` and run time as
   `observed_at`.
6. Run `validateData()`; update the snapshot to `passed`/`failed`.
7. On pass, run `computeDeviations()` and persist all seven signals.
8. Top signal by absolute z-score is used. `|z| < 2.0` →
   `below_z_score_threshold`; `direction === "lagging"` →
   `lagging_constituent`.
9. Run Bull, Bear, then Chief sequentially. Persist the decision row.
10. Chief `NO_TRADE` → `chief_no_trade`.
11. Run `evaluateRisk()`; persist `risk_check`. Rejection updates the decision
    row to `NO_TRADE` with the first failed check reason.
12. Approved trade places `SHORT` constituent perp + `LONG` `ssimag7` spot.
13. Persist `execution` with merged leg data (symbol, side, size, order ID,
    status). Execution failure updates the decision to `NO_TRADE` and returns
    `success: false`.

Audit events include `SNAPSHOT_CREATED`, `VALIDATION_PASSED`/`VALIDATION_FAILED`,
`DEVIATION_COMPUTED`, `NO_TRADE`, `AI_DECISION`, `RISK_APPROVED`/`RISK_REJECTED`,
`ORDER_PLACED`/`EXECUTION_FAILED`, `RUN_COMPLETED`, and `PIPELINE_FAILED`.

### Risk context defaults

No live portfolio, order-book spread, depth, or confidence source exists yet.
Phase 6 therefore uses explicit demo inputs unless the caller overrides them:

- `portfolioBalanceUsd: 100_000`
- `spreadPct: 0.001`
- `depthUsd: 200_000`
- `dataConfidence: 0.9`

`runPipeline` accepts optional `riskContext` for tests/future wiring. Phase 9
must replace these with real account/order-book values before live execution.
Do not treat the demo values as production risk data.

### Persistence and run lock

- `DrizzlePipelineStore` wraps `getDb()` and persists each stage.
- Numeric columns are written as strings because Drizzle maps `numeric` to
  `string`.
- `index_snapshot.validation_status` is `NOT NULL`, so the row is inserted as
  `"pending"` and updated after validation.
- The unique index `idx_run_per_day` on
  `(index_ticker, DATE(observed_at AT TIME ZONE 'UTC'))` enforces one run per UTC
  day. A PostgreSQL `23505` is converted to `RunAlreadyExistsError` with the
  existing `runId` when available; `POST /api/run` maps it to `409`.
- Tests inject an in-memory `PipelineStore`; no database is required.

### API contracts

`POST /api/run`

- Requires `x-operator-key` equal to `OPERATOR_SECRET`; otherwise `401`.
- Calls `runPipeline({ mockSodex: process.env.MOCK_SODEX === "true" })`.
- Returns the `PipelineResult` with `200` when `success` is true, `500` when the
  pipeline failed, and `409` with `{ error, runId? }` for a daily-run conflict.

`GET /api/runs`

- Returns `{ runs: [...] }`, newest first, limited to 20.
- Each run includes camelCase fields `id`, `observedAt`, `indexTicker`,
  `validationStatus`, and `finalDecision`.

`GET /api/runs/[id]`

- Invalid UUID → `400`; missing run → `404`.
- Returns:
  `{ snapshot, signals, decision, riskCheck, execution, auditLog }`.
- Signals are ordered by absolute z-score descending; audit entries are ordered
  oldest first. Nullable stages are returned as `null`.

### Tests

`tests/unit/orchestrator.test.ts` covers:

1. Happy path persists snapshot, seven signals, decision, risk check, execution,
   and audit events.
2. Captured fixtures run end-to-end and persist a `NO_TRADE` decision row
   (`below_z_score_threshold`).
3. Validation failure returns a successful `NO_TRADE` with no signals/risk/exec.
4. Chief `NO_TRADE` short-circuits before risk.
5. PostgreSQL `23505` becomes `RunAlreadyExistsError`.
6. Risk rejection updates the decision and skips execution.
7. Execution failure returns `success: false` and records the failed order.

The generated test data uses flat constituent history with one BTC shock,
producing a top overextended z-score of ~5.57 and zero tracking error. The
fixture-based test uses the captured 90-bar series. All external calls are
mocked; no network or database access occurs.

## Phase 7 findings — dashboard UI

### Files

- `tailwind.config.ts` — design tokens: background `#0A0E17`, surface
  `#131A2A`, foreground `#E6EDF7`, muted `#8B98B8`, accent `#4F8CFF`, success
  `#2ED47A`, danger `#FF5C5C`, warning `#F5A623`; Inter UI and JetBrains Mono.
- `app/globals.css` — dark terminal base, grid fade, focus and scrollbar styles.
- `app/layout.tsx` — Inter + JetBrains Mono via `next/font/google`, metadata.
- `app/page.tsx` — dashboard with run trigger and recent runs.
- `app/runs/[id]/page.tsx` — run detail view.
- `components/types.ts` — API/UI view types.
- `components/format.ts` — formatting and class helpers.
- `components/StatusBadge.tsx` — decision/validation badges.
- `components/DeviationTable.tsx` — signals table with top-signal highlighting.
- `components/AgentDebate.tsx` — Bull/Bear columns and wide Chief verdict.
- `components/RiskChecklist.tsx` — deterministic risk checks and footer.
- `components/AuditTimeline.tsx` — vertical persisted audit timeline.
- `components/Spinner.tsx` — shared loading indicator.

### Behavior

- Dashboard loads `GET /api/runs` on mount and renders the latest 20 runs.
- Operator secret is stored in `localStorage` under
  `odysseus.operator-secret` and sent as `x-operator-key`.
- Run Pipeline posts to `/api/run`, shows a loading state, refreshes the list on
  success, and shows the exact `409` message `Run already exists for today`.
- Empty state: `No runs yet. Click 'Run Pipeline' to start.`
- Run rows are keyboard-accessible and navigate to `/runs/[id]`.
- Detail page consumes the Phase 6 contract, renders snapshot metadata, status,
  signals, agent debate, risk checklist, execution legs, and audit timeline.
- Detail page has loading, error/retry, and not-found states.
- `NO_TRADE` is amber, `SHORT` is blue, and validation `FAIL` is red.
- No backend files or API response shapes were changed. No dependencies were
  added.
- Verification: `npm test` 57/57 passing, `npm run build` successful,
  `npm run lint` clean. No Playwright/E2E run in this phase.

## Phase 8 findings — replay + audit polish

### Files

- `app/api/run/replay/route.ts` — operator-authenticated replay endpoint.
- `app/replay/page.tsx` — replay page with stored snapshot table and secret input.
- `app/runs/[id]/page.tsx` — unchanged contract; now renders replay runs too.
- `lib/pipeline/orchestrator.ts` — exports `processSnapshot(data, options)` and
  delegates to it from `runPipeline()`.
- `lib/db/schema.ts` — added `constituent_klines`, `token_klines`, and
  `replay_of` to `index_snapshot`.
- `drizzle/0001_wooden_aqueduct.sql` — adds replay columns and replaces the
  daily unique index with a partial index for live runs.
- `components/mockup/Shell.tsx` — adds `Replay Engine` sidebar and top-bar links.
- `tests/unit/orchestrator.test.ts` — adds replay and same-decision tests.

### Behavior

- `processSnapshot()` owns the post-ingestion flow: snapshot persistence,
  validation, deviation, agents, risk, execution, and audit logging.
- `runPipeline()` fetches live SoSoValue data, then calls `processSnapshot()`
  with `replayOf: null`.
- `POST /api/run/replay` validates `x-operator-key`, accepts
  `{ snapshotId }`, loads the stored snapshot, and calls `processSnapshot()`
  with the stored `constituents`, `index_klines`, `constituent_klines`, and
  `token_klines`. It never calls SoSoValue.
- Replay creates a new `index_snapshot` row with `replay_of` set to the source
  snapshot and returns `{ success: true, runId }`.
- Replay execution is forced to `mockSodex: true` so Phase 8 cannot place live
  SoDEX orders.
- The daily unique index now applies only where `replay_of IS NULL`, so replays
  can share the original `observed_at` without hitting the live run lock.
- The existing pre-Phase-8 snapshot was backfilled with constituent and token
  klines from SoSoValue and re-synthesized index klines. Legacy snapshots
  without those columns return HTTP `422` with a clear error.
- Replay page reads the operator secret from
  `odysseus.operator-secret`, lists `GET /api/runs`, posts to
  `/api/run/replay`, shows a spinner, and routes to `/runs/[newRunId]` on
  success. Empty and error states link back to `/dashboard`.
- Verified with a real replay: new run ID
  `6743d413-74c4-461a-985f-52ad863bc17a`, decision `NO_TRADE` /
  `below_z_score_threshold`, matching the original run.
- Verification: `npm test` 59/59 passing, `npm run build` successful,
  `npm run lint` clean.

## Phase 9 findings — live testnet verification

### Files changed

- `lib/sodex/client.ts` — live market-symbol resolution, mark-price sizing,
  normalized EIP-712 signatures, spot-ask preflight, order-status
  reconciliation, and the zero-ask paper spot fallback.
- `lib/env.ts` — `SODEX_API_KEY_PRIVATE_KEY` rename, numeric `uint64`
  `SODEX_ACCOUNT_ID`, and `ALLOW_PAPER_SPOT` flag.
- `.env.example` — updated env names, numeric account example, paper-spot flag.
- `app/api/run/route.ts` — uses validated `getEnv().MOCK_SODEX`.
- `lib/pipeline/orchestrator.ts` — persists `execution_mode`, marks paper legs,
  logs `PAPER_SPOT_FILL`, and only reports `filled` when every leg is filled.
- `lib/db/schema.ts`, `drizzle/0002_demonic_wilson_fisk.sql` — nullable
  `execution.execution_mode` column.
- `components/types.ts`, `components/mockup/DashboardView.tsx`,
  `components/mockup/RunDetailView.tsx` — display `PAPER SPOT` and per-leg
  `PAPER` badges.
- `register-api-key.ts` — operator-only `UserSignedAddAPIKeyAction` registration
  script. Reads both private keys from the environment; no keys are committed.
- `tests/unit/env.test.ts`, `tests/unit/sodex.test.ts`,
  `tests/unit/orchestrator.test.ts` — updated and expanded coverage.

### SoDEX configuration

- Base URL: `https://testnet-gw.sodex.dev`
- Chain ID: `138565`
- Master wallet: `0x69461740214a68d34157b3A14f513fA47f9a08E0`
- Trading account ID: `60504` (numeric `uint64`, not a UUID)
- Registered API key name: `odysseus-live`
- API key public address:
  `0xf08613ee86cF9bCCCdDD361BB89116680C05f942`
- The API key is visible in both spot and perps.
- Private keys live only in `.env.local`; `.env.*` is gitignored.

### Live execution fixes

- Ticker resolution maps pipeline tickers to SoDEX markets:
  `ssimag7` → `vMAG7ssi_vUSDC` (spot), `btc` → `BTC-USD`, and so on.
- Perps SHORT orders are sized by mark price and symbol precision, then bumped
  to `minNotional` when needed. Spot LONG orders continue to use `funds`.
- Mark prices come from `/perps/markets/mark-prices`; the older tickers endpoint
  omitted XRP and DOGE.
- Before any live order, every LONG spot leg is checked against the spot ask
  book. If ask notional is below the intended size, the whole batch aborts so a
  naked perp short is never placed.
- After submission, each order is reconciled through
  `/accounts/{address}/orders/history`. Terminal `canceled`, `expired`, and
  `rejected` statuses make execution fail. `new` is normalized to `submitted`.

### Paper spot fallback

`ALLOW_PAPER_SPOT` defaults to `false`. When it is `true` and a spot leg has
**zero asks**, the client:

1. Logs `Spot leg has no liquidity. Simulating paper fill.`
2. Generates `paper_spot_<uuid>` with status `filled`.
3. Continues to execute the real constituent perps leg.

The execution row records `execution_mode = "PAPER_SPOT"`, the paper leg records
`mode: "paper"`, and the audit log records a `PAPER_SPOT_FILL` event. The run
detail UI shows `PAPER SPOT` and a `PAPER` badge on the leg. If asks exist but
notional is insufficient, the batch still aborts; paper mode is only for a truly
empty book. With the flag off, the safe behavior is
`NO_TRADE — insufficient_spot_liquidity`.

### Real testnet evidence

Direct smoke orders against SoDEX testnet:

| Leg | Order ID | Result |
| --- | --- | --- |
| ETH perp SHORT | `3148777249` | filled |
| SOL perp SHORT | `3148777325` | filled |
| HYPE perp SHORT | `3148778098` | filled |
| BNB perp SHORT | `3148777533` | canceled |
| Index spot LONG | `1301098655` | canceled, `executedQty: "0"` |

Current testnet positions after the smoke tests: ETH `-0.0044`, SOL `-0.1`,
HYPE `-0.13`; perps equity about `19.22 vUSDC`; spot balance about
`68.01 vUSDC`.

### Live pipeline runs

- `743fe821-cab6-429e-9273-55d706dfe29d` (Oct 28): validation passed with
  tracking error `0.004153308874498163`; top signal HYPE, z-score
  `2.5761850246333817`; Chief returned `NO_TRADE` / `chief_no_trade`.
- `2a073430-3654-49e4-8115-58e957d6ea35` (replay of the same snapshot, live
  execution enabled): also `NO_TRADE` / `chief_no_trade`.
- No `execution` row was created for either run. No trade was forced.

The Bear argued that HYPE's weight (`0.0083`) makes the execution risk
unacceptable, and the Chief agreed at confidence `0.85`. The Bull's argument was
strong but its live `confidence` field was `0`, which weakens the Bull case. This
is an agent-quality issue, not an execution-path failure.

### Spot market state

- `vMAG7ssi_vUSDC` (symbol ID `3`): 2 bids, 0 asks at the time of the run.
- `tMAG7ssi_vUSDC` and `tsMAG7ssi_vUSDC`: no book.
- `vUSSI_vUSDC`: no asks.
- Spot account holds only `vUSDC` and a small `vBTC` balance; no `vMAG7.ssi`
  tokens are available to seed the book.

### Verification

- `npm run typecheck` — passed.
- `npm test` — 69 tests passing.
- `npm run build` — passed.
- `npm run lint` — clean.
- `npm run db:migrate` — applied `0002_demonic_wilson_fisk.sql`.



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
- **Phase 5 complete:** risk engine and SoDEX mock/signed client are implemented.
  No live SoDEX call was made.
- **Phase 6 complete:** orchestrator and run APIs are implemented. The default
  risk context uses demo values until live account/order-book data is wired in
  Phase 9.
- **Phase 7 complete:** dashboard and run detail UI are implemented against the
  Phase 6 contracts. `npm test`, `npm run build`, and `npm run lint` pass. No
  backend or API changes were made. No browser E2E was run in this phase.
- **Phase 9 partial:** live SoDEX auth, market resolution, perps sizing, mark
  prices, spot preflight, order-status reconciliation, and the paper spot
  fallback are implemented. Real perps fills: ETH `3148777249`, SOL `3148777325`,
  HYPE `3148778098`. A complete two-leg pipeline execution is still blocked.
- **Phase 9 decision blocker:** on the Oct 28 snapshot the top signal was HYPE
  (z `2.576`), but the Chief returned `NO_TRADE` because the Bear argued HYPE's
  `0.0083` weight makes execution risk unacceptable. The Bull's live confidence
  was `0`, which weakens its case. Do not force a trade to satisfy the demo.
- **Phase 9 liquidity blocker:** `vMAG7ssi_vUSDC` has 0 asks. With
  `ALLOW_PAPER_SPOT="true"` the spot leg becomes a paper fill and the real perps
  leg can run; with the flag off the batch aborts safely.
- **Phase 9 UI:** run detail shows `execution_mode` and per-leg `PAPER` badges.
  No live run has reached execution yet, so the mixed real/paper UI has only
  been exercised by unit tests, not by a persisted live run.
- **Phase 3 complete:** `R_index` is computed from `synthesizeIndexKlines`, not
  from `/indices/ssimag7/klines`.
- **Phase 6 run lock:** the partial unique index on
  `(index_ticker, DATE(observed_at AT TIME ZONE 'UTC')) WHERE replay_of IS NULL`
  is handled as `RunAlreadyExistsError` / HTTP `409`. A live run that fails after
  the snapshot insert still occupies that UTC day; retries must wait until the
  next day. Replay runs are exempt.
- **Phase 8 complete:** replay API, replay page, sidebar navigation, and
  replay-capable snapshot storage are implemented. Replay uses stored klines,
  skips SoSoValue ingestion, and runs mock execution only. Legacy snapshots
  without replay columns return HTTP `422`.
- SoSoValue constituents endpoint returns no timestamp; weight freshness is
  assumed.
- No historical weight series — backtests would use current weights (mitigated
  by the 30-day calibration window).

## Environment

- See `ARCHITECTURE.md` §Stack and `PROJECT_SPEC.md` §Security.
- Env vars required: `DATABASE_URL`, `SOSO_API_KEY`,
  `SODEX_API_KEY_PRIVATE_KEY`, `SODEX_API_KEY_NAME`, `SODEX_ACCOUNT_ID`,
  `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `OPERATOR_SECRET`.
- `OPENROUTER_API_KEY` is used by the Phase 4 agents. `OPENAI_API_KEY` is still
  required by the Phase 1 env schema but is not used by the agents.
- `SODEX_BASE_URL` should be the gateway host
  (`https://testnet-gw.sodex.dev`); the client appends `/api/v1/...`.
- `SODEX_ACCOUNT_ID` is a numeric `uint64` string (`60504` on testnet), not a
  UUID. `SODEX_API_KEY_PRIVATE_KEY` is the registered API key's private key, not
  the master wallet key.
- `viem@^2.57.12` and `tsx@^4.23.15` are installed.
- Optional: `Z_SCORE_THRESHOLD` (default 2.0), `TRACKING_ERROR_TOLERANCE`
  (default 0.02), `MAX_POSITION_PCT` (default 0.10), `MOCK_SODEX` (default
  false), `ALLOW_PAPER_SPOT` (default false). `placeOrders` receives the mock
  flag from its caller; it does not read `MOCK_SODEX` directly. Paper spot is
  read inside `placeOrders` via `getEnv()`.
- The operator-only `register-api-key.ts` script expects `ACCOUNT_ID`,
  `SODEX_API_KEY_NAME`, `SODEX_MASTER_PRIVATE_KEY`, and
  `SODEX_API_KEY_PRIVATE_KEY` in the environment. Never commit those values.

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
- Phase 6 API response shapes (`{ runs }` and the run-detail object)
- Execution venue (testnet only in MVP)

## Next task

Phase 9 remains **blocked** pending an operator decision.

The live execution path is ready, but the Oct 28 pipeline run returned
`NO_TRADE` / `chief_no_trade` before execution. The index spot market also has
0 asks, so `ALLOW_PAPER_SPOT="true"` is required for a demo run. Do not force a
trade, lower the z-score threshold, or change agent prompts without explicit
approval. Do not start Phase 10.

Options for the operator:

1. Accept the `NO_TRADE` run as the Phase 9 pipeline evidence and treat the
   direct perps fills plus unit-tested paper fallback as sufficient.
2. Approve an agent-prompt fix for the Bull's `confidence` field and re-run on a
   future day/snapshot.
3. Wait for a snapshot whose top signal the Chief approves, then run the full
   pipeline with `ALLOW_PAPER_SPOT="true"`.
