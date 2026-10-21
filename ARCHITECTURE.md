# ARCHITECTURE.md — Odysseus

## 1. System Diagram

```
Next.js 14 (App Router)
  ├── /                    Dashboard
  ├── /runs/[id]           Run detail
  ├── /replay              Replay UI
  └── /api/*               Server routes
        │
        ▼
Pipeline Orchestrator (server-only TS)
        │
  ┌─────┼─────────┬──────────┬──────────┐
  ▼     ▼         ▼          ▼          ▼
SoSoValue  Validation  Deviation  LLM Agents  SoDEX Client
Client     Gate        Engine     (Bull/Bear/  (spot+perps)
                                   Chief)
  │                                  │           │
  ▼                                  ▼           ▼
Postgres                      OpenAI API    SoDEX Testnet
(Drizzle ORM)                                Gateway
```

- No queue. Pipeline runs synchronously per request.
- No separate backend service. Next.js API routes are sufficient.
- Cron: Vercel Cron or external scheduler hits `POST /api/run` daily.

## 2. Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TS | Single repo, server routes, fast deploy |
| Styling | Tailwind CSS | Speed |
| Database | PostgreSQL (Neon) | JSONB for agent outputs |
| ORM | Drizzle | Type-safe, lightweight |
| LLM | OpenAI `gpt-4o-mini` | JSON mode, cheap, sufficient |
| SoSoValue | REST + `x-soso-api-key` | Official API |
| SoDEX | REST + EIP-712 via `viem` | Official signing scheme |
| Deployment | Vercel + Neon | Free tier |
| Testing | Vitest + Playwright | Fast unit + E2E |

## 3. Pipeline Stages

1. **Ingest** — `lib/sosovalue/client.ts`
2. **Validate** — `lib/pipeline/validation.ts`
3. **Deviation** — `lib/pipeline/deviation.ts`
4. **Agents** — `lib/pipeline/agents.ts`
5. **Risk** — `lib/pipeline/risk.ts`
6. **Execute** — `lib/pipeline/execution.ts`
7. **Orchestrate** — `lib/pipeline/orchestrator.ts`

## 4. Data Model

```sql
CREATE TABLE index_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_ticker TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  index_klines JSONB NOT NULL,
  constituents JSONB NOT NULL,
  validation_status TEXT NOT NULL,
  validation_reason TEXT,
  tracking_error NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deviation_signal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES index_snapshot(id),
  symbol TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  constituent_return NUMERIC NOT NULL,
  index_return NUMERIC NOT NULL,
  weight_deviation NUMERIC NOT NULL,
  z_score NUMERIC NOT NULL,
  direction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES index_snapshot(id),
  signal_id UUID REFERENCES deviation_signal(id),
  bull_output JSONB,
  bear_output JSONB,
  chief_output JSONB,
  final_decision TEXT NOT NULL,
  no_trade_reason TEXT,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES decision(id),
  checks JSONB NOT NULL,
  approved BOOLEAN NOT NULL,
  approved_size NUMERIC,
  stop_loss NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_check_id UUID REFERENCES risk_check(id),
  venue TEXT NOT NULL,
  legs JSONB NOT NULL,
  client_order_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_run_per_day ON index_snapshot (index_ticker, DATE(observed_at));
```

## 5. External APIs

### SoSoValue
- Base: `https://openapi.sosovalue.com/openapi/v1`
- Auth: `x-soso-api-key` header
- Used endpoints:
  - `GET /indices`
  - `GET /indices/ssimag7/constituents`
  - `GET /indices/ssimag7/klines?interval=1d&limit=100`
  - `GET /currencies/{currency_id}/klines?interval=1d&limit=100`
- Rate limit: 20 req/min
- Failure: exponential backoff on 429; fail validation on 401/403

### SoDEX Testnet
- Base: `https://testnet-gw.sodex.dev/api/v1/spot` and `/api/v1/perps`
- Auth: EIP-712 signed; headers `X-API-Key`, `X-API-Sign`, `X-API-Nonce`
- Used endpoints:
  - `GET /markets`
  - `POST /trade/orders`
  - `GET /accounts/{id}/state`
  - `GET /orders/{id}`
- Failure: reconcile with REST before retry; never resubmit blindly

### OpenAI
- Model: `gpt-4o-mini`, JSON mode, temperature 0.2
- Max 3 calls per run, 1000 tokens each
- Failure: fallback `NO_TRADE`

## 6. Deterministic vs AI

| Stage | Type |
|---|---|
| Validation gate | Deterministic |
| Deviation engine | Deterministic |
| Risk engine | Deterministic |
| Bull/Bear/Chief | LLM (constrained JSON) |
| Execution | Deterministic |

The LLM produces **thesis text and a constrained decision enum only**. It cannot trigger execution directly; the Chief's decision is validated against an allowed enum before Risk sees it.

## 7. Failure Philosophy

- Any uncertainty → `NO_TRADE`.
- LLM invalid JSON / timeout → `NO_TRADE`.
- Data validation fail → `NO_TRADE` before any AI reasoning.
- Execution timeout → reconcile, log `execution_unknown`, do not retry blindly.
- Duplicate run → 409.

## 8. Deployment

- Vercel (frontend + API routes)
- Neon (Postgres)
- Cron: daily at 00:30 UTC (after daily close)
- Secrets in Vercel Environment Variables