# AGENTS.md — Odysseus

You are the implementation engineer for Odysseus. The human is the product
architect and technical decision maker. Follow this document strictly.

## Project

Autonomous SSI index-deviation trading agent for the SoSoValue Buildathon.
- Index: MAG7.ssi (`ssimag7`)
- Execution: SoDEX testnet (spot + perps)
- Read `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` before any task.

## Rules

1. Follow `PROJECT_SPEC.md`. Do not invent requirements.
2. Do not change the architecture or stack without asking.
3. Do not modify unrelated files.
4. Deterministic logic (validation, deviation, risk) must never be delegated to the LLM.
5. LLM output is validated against a Zod schema. Invalid → retry once → fallback to `NO_TRADE`.
6. `NO_TRADE` is a valid success outcome. Never force a trade.
7. Direction constraint: only `SHORT constituent perp + LONG index spot` for overextended constituents. Lagging → `NO_TRADE`.
8. Chief may return only `SHORT` or `NO_TRADE`. Any other value is overridden to `NO_TRADE` and logged.
9. Run tests after every phase. Do not claim success without test output.
10. Stop after the assigned phase. Wait for the next instruction.
11. Commit with conventional messages (`feat:`, `fix:`, `test:`, `chore:`).
12. Never log API keys, private keys, or full LLM prompts containing secrets.
13. If a requirement is ambiguous, stop and ask. Do not guess.
14. Do not proceed to Phase N+1 automatically.

## Testing

```bash
npm test          # Vitest unit + integration
npm run test:e2e  # Playwright
npm run build
npm run lint
```

For every phase, report:
- Files changed
- Exact command output for `npm test` and `npm run build`
- Any test failures and what you did to fix them
- A one-paragraph summary of what was implemented

## Git

Small, conventional commits per phase. Never force-push. Never commit secrets.

## Current phase

See `AI_HANDOFF.md`.