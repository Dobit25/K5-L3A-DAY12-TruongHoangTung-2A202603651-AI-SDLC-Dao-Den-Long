# AGENTS.md — Đảo Đèn Lồng AI SDLC Harness

## Project Overview
- **Game:** Đảo Đèn Lồng (3D third-person game + deterministic headless engine).
- **Stack:** TypeScript, Vite, Three.js (browser 3D renderer), Node.js (pure core simulation & headless CLI), Vitest (unit & scenario tests).
- **Local Dev Environment:** Always execute project commands inside conda environment `gen` (`D:\Coding\Anaconda\envs\gen`). Ensure final commands remain cross-platform (Windows, macOS, Linux).

## Sacred Rules (DO NOT VIOLATE)
1. **Never modify, rename, or delete the 6 original lab specification files:** `README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`. Any conflicting filename must use suffix `_review` (e.g., `README_review.md`).
2. **Strict Separation of Core & Render:** `src/core/` MUST have zero browser/DOM/Three.js imports so headless CLI runs purely in Node.js and stays 100% deterministic.
3. **Integer Tick Timers Only:** In `src/core/`, represent all cooldowns/durations (invuln, pulse cooldown, stun, etc.) as integer tick counts (`Math.round(seconds * 60)`), NEVER decrementing floats by `1/60`, to prevent IEEE-754 off-by-one tick drift.
4. **Never fake proof or weaken tests:** Never edit outputs by hand or write always-passing assertions. If a later phase changes a rule, update or remove affected tests with an explicit documented reason.
5. **No Secrets:** Never commit `.env`, API keys, or tokens.
6. **No Unverified Tagging:** Never tag `phase-N` unless `npm run verify` passes (all unit tests, headless scenarios, determinism checks, and typecheck/build green).

## Standard Commands (Updated as Project Evolves)
- Install: `npm ci`
- Dev server (3D game): `npm run dev`
- Build static release & headless CLI: `npm run build`
- Run headless CLI: `node dist-cli/cli/headless.js --seed <int> --night 1 --ticks <int> --out <file.jsonl>`
- Run full verification gate: `npm run verify` *(typecheck + build:cli + vitest + SHA-256 determinism script + build:web)*
- Note (Windows PowerShell 5.1): chain commands with `;` rather than `&&`.

## Phase Workflow Checklist
1. Read verbatim phase ticket; separate hard Test Contract requirements from ambiguities.
2. Record assumptions & verifiable acceptance criteria in `docs/notes/assumptions.md`.
3. Define verification scenarios BEFORE writing implementation code.
4. Implement in small, clean commits; keep creative features strictly decoupled from headless outputs.
5. Run `npm run verify` + independent reviewer check; save real proof under `docs/proof/phase-N/`.
6. Update `docs/notes/ai-log.md` (errors found, harness adjustments, estimated token usage).

## Harness Changelog
- **CP0:** Initialized `AGENTS.md`, `verify-phase` skill, CI workflow, and project guardrails.
- **Phase 1:** Enforced `game.contract.json` ↔ `DEFAULT_TUNING` deep-equality test (`tests/contract.test.ts`), added automated SHA-256 determinism gate (`scripts/verify-phase1.mjs`) into `npm run verify`, and added PowerShell command-chaining note after encountering `&&` syntax failure on Windows.

