# Odysseus

**Autonomous SSI index-deviation trading agent.**

One operator. Adversarial AI debate. Deterministic risk gates. Real testnet execution.

> **Live demo:** https://odysseus-self.vercel.app<br>
> **Demo video:** [`odysseus-demo.mp4`](odysseus-demo.mp4)<br>
> **Hackathon:** SoSoValue Buildathon — Wave 3

---

## The Pitch

The **One-Person On-Chain Finance Business** thesis is simple: a single operator should be able to run a professional on-chain trading operation without hiring a research team, a risk officer, and an execution desk.

Odysseus is that operation for **SSI index deviations**.

It watches **MAG7.ssi** (`ssimag7`) and its constituents, finds moments where a constituent's return has drifted away from its index-weight-implied return, and asks two adversarial AI agents to argue whether the dislocation is real. A deterministic risk engine then decides whether the trade is allowed. If it is, Odysseus executes a market-neutral relative-value position on **SoDEX testnet**:

- **SHORT** the overextended constituent perpetual
- **LONG** the MAG7.ssi index spot

If the data is stale, the deviation is insignificant, the constituent is lagging, the AI debate is weak, or any risk check fails, Odysseus returns **`NO_TRADE`** — and that is a successful outcome.

> **`NO_TRADE` is a first-class result, not an error.** The system never forces a trade to look busy.

The operator sets the strategy and owns the risk. The agents do the research and challenge each other. The deterministic engines keep the LLM away from the execution keys.

---

## How It Works

```text
SoSoValue API
     │
     ▼
┌─────────────┐   ┌────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌────────────┐   ┌──────────┐
│    Data     │──▶│ Validation │──▶│  Deviation   │──▶│ Bull / Bear /   │──▶│    Risk    │──▶│  SoDEX   │
│  Ingestion  │   │    Gate    │   │   Engine     │   │ Chief Debate    │   │   Engine   │   │ Testnet  │
└─────────────┘   └────────────┘   └──────────────┘   └─────────────────┘   └────────────┘   └──────────┘
                                                                                                    │
                                                                                          SHORT perp + LONG spot
                                                                                          or NO_TRADE
```

### 1. Data ingestion

Odysseus pulls current MAG7.ssi constituents and weights, the MAG7.ssi token series, and 90 days of daily constituent klines from the **SoSoValue API**. Index klines are synthesized from the weighted constituent series and checked against the MAG7.ssi token — the raw index-kline endpoint is empty on the current API plan.

### 2. Validation gate — deterministic

Five hard checks run before any AI reasoning:

1. Valid constituent count.
2. Weights sum to approximately 1.0.
3. At least 30 daily klines per series.
4. All series share aligned timestamps.
5. Tracking error stays within tolerance.

Any failure short-circuits to **`NO_TRADE` (data)**.

### 3. Deviation engine — deterministic

For each constituent:

```text
weight_deviation = w_i × (R_i − R_index)
```

A rolling **30-day robust z-score** (median / MAD, with standard-deviation fallback) measures how unusual that deviation is. A signal requires:

```text
|z| ≥ 2.0
```

The strongest signal is evaluated first. Only **overextended** constituents are eligible. A **lagging** constituent always returns **`NO_TRADE`**: the hedge requires shorting the constituent perp and longing the index spot, and the index spot cannot be shorted on this venue.

### 4. Adversarial AI debate

Three agents run in sequence through **OpenRouter** using `openai/gpt-4o-mini` in JSON mode:

- **Bull** argues that the dislocation is real and tradeable.
- **Bear** argues that it is justified, noisy, or too risky to execute.
- **Chief** returns a constrained decision: **`SHORT`** or **`NO_TRADE`**.

Every response is validated against a Zod schema. Invalid output is retried once, then falls back to **`NO_TRADE`**. A Chief response of `LONG` or any other value is overridden to **`NO_TRADE`** and logged.

### 5. Risk engine — deterministic

The LLM has no execution authority. The risk engine independently checks:

- data confidence
- spread
- order-book depth
- AI confidence
- position sizing
- stop-loss

Position size defaults to **10% of the portfolio**, capped by available depth, with a **5% stop loss**. Any failure → **`NO_TRADE` (risk)**.

### 6. Execution — SoDEX testnet

Approved trades are signed with **EIP-712 via viem** and sent to SoDEX testnet:

- **SHORT** constituent perp (`BTC-USD`, `ETH-USD`, …)
- **LONG** MAG7.ssi spot (`vMAG7ssi_vUSDC`)

Before placing a perp short, Odysseus checks the spot ask book. If asks exist but the available notional is insufficient, the batch aborts so a naked perp short is never left behind. When the testnet index book has **zero asks** and `ALLOW_PAPER_SPOT` is enabled, the explicit **paper spot fallback** records a simulated index leg while the constituent perp still executes live. Paper legs are labeled in the UI and audit log.

Every order carries an idempotent client order ID and is reconciled against SoDEX order history rather than retried blindly.

---

## Tech Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | **Next.js 14** (App Router), React 18, TypeScript | Dashboard, replay, run detail, API routes |
| Styling | **Tailwind CSS** | Terminal-inspired operator console |
| Database | **PostgreSQL** (Neon) | Snapshots, signals, decisions, risk, executions, audit log |
| ORM | **Drizzle ORM** | Typed schema and migrations |
| Market data | **SoSoValue API** | Constituents, weights, daily klines |
| Execution | **SoDEX testnet** + **viem** | EIP-712 signed spot and perp orders |
| AI | **OpenRouter** (`openai/gpt-4o-mini`) | Bull / Bear / Chief structured debate |
| Wallet | **wagmi** + viem + TanStack Query | MetaMask operator authentication |
| Testing | **Vitest** | Deterministic unit and integration coverage |
| Deployment | **Vercel** + Neon | Production hosting |

---

## Key Features

### Deterministic risk gates — `NO_TRADE` by default

Validation, deviation, risk, and execution are plain TypeScript. The LLM only produces thesis text and a constrained decision enum. Any uncertainty — bad data, weak signal, failed schema, missing liquidity, wide spread, low confidence — resolves to **`NO_TRADE`**. A daily run lock prevents duplicate live runs, and position size is capped by both portfolio balance and available depth.

### Adversarial AI debate — Bull vs. Bear

The Bull and Bear are forced to argue against each other before the Chief can decide. This is not a single prompt with a "should I trade?" question; it is a structured, schema-checked debate with explicit confidence values and invalidation criteria. The Chief can only say **`SHORT`** or **`NO_TRADE`**.

### Live SoDEX testnet execution — with paper spot fallback

Odysseus places real EIP-712-signed orders on SoDEX testnet, resolves tickers to market symbol IDs, sizes perps by mark price and precision, preflights spot liquidity, and reconciles terminal order status. When the testnet index book is empty, the paper spot fallback keeps the demo honest: the perp leg is real, the index leg is explicitly marked **PAPER** in the UI and audit trail.

### Audit trail, replay, and operator control

Every stage is persisted to PostgreSQL. The dashboard shows the deviation table, agent debate, decision card, risk checklist, execution legs, and audit timeline. Any stored snapshot can be replayed through the full pipeline without re-fetching SoSoValue, and runs can be exported as JSON. The operator console is gated by a connected MetaMask wallet matching the configured operator address.

---

## Verified on SoDEX Testnet

| Execution | Order ID | Result |
| --- | --- | --- |
| HYPE perp SHORT (pipeline demo) | `3155812057` | Filled |
| ETH perp SHORT | `3148777249` | Filled |
| SOL perp SHORT | `3148777325` | Filled |
| HYPE perp SHORT | `3148778098` | Filled |
| MAG7.ssi spot LONG (demo) | `paper_spot_...` | Paper fallback — zero testnet asks |

The perp legs were real testnet orders. The index spot leg used the explicit paper fallback because the testnet MAG7.ssi book had no asks. The fallback is visible in the execution mode, the leg badge, and the `PAPER_SPOT_FILL` audit event.

---

## Running Locally

### 1. Clone

```bash
git clone https://github.com/onyebuchidaniel60/Odysseus.git
cd Odysseus
```

### 2. Install

```bash
npm install
```

### 3. Configure environment and database

```bash
cp .env.example .env.local
# edit .env.local with your values
npm run db:migrate
```

Required variables:

```bash
DATABASE_URL=postgres://...
SOSO_API_KEY=...
SODEX_BASE_URL=https://testnet-gw.sodex.dev
SODEX_API_KEY_PRIVATE_KEY=0x...
SODEX_API_KEY_NAME=...
SODEX_ACCOUNT_ID=...
OPENAI_API_KEY=...              # required by env validation
OPENROUTER_API_KEY=...          # used by the Bull / Bear / Chief agents
NEXT_PUBLIC_OPERATOR_ADDRESS=0x...
OPERATOR_SECRET=...             # openssl rand -hex 32
MOCK_SODEX=true                 # safe local default: simulated fills
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard), connect the operator wallet with MetaMask, and click **Run Pipeline**. The landing page is at `/`.

### Verify

```bash
npm test          # Vitest: 82 tests
npm run build     # production build
npm run lint      # ESLint
```

---

## Hackathon Context

Built for the **SoSoValue Buildathon — Wave 3**, under the theme **“Build Your One-Person On-Chain Finance Business.”**

Odysseus demonstrates the full loop a solo on-chain operator needs:

- **Market intelligence** from SoSoValue index and constituent data.
- **Autonomous research** through an adversarial Bull/Bear debate.
- **Institutional discipline** through deterministic validation and risk gates.
- **Real execution** on SoDEX testnet with signed orders and reconciliation.
- **Transparency** through a persisted audit trail and snapshot replay.

The result is a one-person index-arbitrage desk that can run daily, explain every decision, and stop itself when the edge is not there.

---

## Repository Map

```text
app/                  Next.js routes, API handlers, dashboard, replay, run detail
components/           Operator console, wallet UI, tables, badges, timeline
lib/pipeline/         Validation, deviation, agents, risk, execution, orchestrator
lib/sosovalue/        SoSoValue client, kline parsing, index synthesis
lib/sodex/            Signed SoDEX client, market resolution, reconciliation
lib/db/               Drizzle schema and database access
lib/operator-auth.ts  Wallet / operator-secret API authentication
tests/unit/           Vitest suite for deterministic and integration behavior
```

## Scope & Limitations

- **Testnet only.** No mainnet execution, no real funds.
- **Single operator, single index, daily cadence.** Multi-user and multi-index are out of scope for the MVP.
- **Wallet auth is a UX gate.** The browser compares the connected address with `NEXT_PUBLIC_OPERATOR_ADDRESS`; production use should add nonce + signature (SIWE) verification.
- **The testnet index spot book is thin.** Paper spot fallback exists specifically for this demo environment and is always labeled.
- **The LLM never executes.** Invalid or low-confidence AI output falls back to `NO_TRADE`.
