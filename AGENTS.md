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
- Run game (3D + local leaderboard API): `npm start` *(or `node scripts/run-game.mjs --export-leaderboard out.json`)*
- Run headless CLI: `node dist-cli/cli/headless.js --seed <int> --night <1|2|3> --ticks <int> --out <file.jsonl>`
- Run 30s 1280×720 benchmark: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`
- Run 10-night soak test: `node --expose-gc dist-cli/cli/soak.js --seed 7 --nights 10 --out soak.json`
- Run full verification gate: `npm run verify` *(typecheck + build:cli + vitest + Contract v1.3 tests + multi-night SHA-256 determinism + build:web)*
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
- **Phase 1:** Enforced `game.contract.json` ↔ `DEFAULT_TUNING` deep-equality test (`tests/contract.test.ts`), added automated SHA-256 determinism gate (`scripts/verify-phase1.mjs`) into `npm run verify`, added integer-tick-timer rule after independent review caught IEEE-754 float drift, and added PowerShell `;` separator note.
- **Phase 2:** Upgraded contract & verification gate to Test Contract v1.1 (`scripts/verify-phase2.mjs`) covering Nights 1–3 SHA-256 determinism + 21,600-tick `< 30s` performance benchmark, added per-feature headless scenarios (`tests/phase2-features.test.ts`), and updated `.agents/skills/verify-phase/SKILL.md` for multi-night regression.
- **Phase 3:** Migrated to Contract v1.2 (`scripts/verify-phase3.mjs`, `tests/phase3-fuel.test.ts`), extended integer-unit rule to lantern fuel (`fuel_60ths` 1/60th integer scale), added `ADR-001` and `CHANGELOG.md` breaking-changes documentation, and updated affected tests with explicit documented reasons (zero silently skipped tests).
- **Phase 4:** Upgraded to Contract v1.3 (`game.contract.json` adding `bench_cmd` & `soak_cmd`), added isolated-process soak RSS verification (`--expose-gc` + JIT warmup after catching V8 nursery expansion noise in Vitest worker), added leaderboard export & soak unit/CLI tests (`tests/phase4-release.test.ts`), and finalized Release `v1.0.0` packaging (`scripts/run-game.mjs`, `scripts/bench.mjs`, `Dockerfile`).

