# AGENTS.md — Đảo Đèn Lồng AI SDLC Harness

## Project Overview
- **Game:** Đảo Đèn Lồng (3D third-person game + deterministic headless engine).
- **Stack:** TypeScript, Vite, Three.js (browser 3D renderer), Node.js (pure core simulation & headless CLI), Vitest (unit & scenario tests).
- **Local Dev Environment:** Always execute project commands inside conda environment `gen` (`D:\Coding\Anaconda\envs\gen`). Ensure final commands remain cross-platform (Windows, macOS, Linux).

## Sacred Rules (DO NOT VIOLATE)
1. **Never modify, rename, or delete the 6 original lab specification files:** `README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`. Any conflicting filename must use suffix `_review` (e.g., `README_review.md`).
2. **Strict Separation of Core & Render:** `src/core/` MUST have zero browser/DOM/Three.js imports so headless CLI runs purely in Node.js and stays 100% deterministic.
3. **Never fake proof or weaken tests:** Never edit outputs by hand or write always-passing assertions. If a later phase changes a rule, update or remove affected tests with an explicit documented reason.
4. **No Secrets:** Never commit `.env`, API keys, or tokens.
5. **No Unverified Tagging:** Never tag `phase-N` unless `npm run verify` passes (all unit tests, headless scenarios, determinism checks, and typecheck/build green).

## Standard Commands (Updated as Project Evolves)
- Install: `npm ci`
- Dev server (3D game): `npm run dev`
- Build static release: `npm run build`
- Run full verification gate: `npm run verify` *(typecheck + unit tests + headless scenarios + determinism check)*

## Phase Workflow Checklist
1. Read verbatim phase ticket; separate hard Test Contract requirements from ambiguities.
2. Record assumptions & verifiable acceptance criteria in `docs/notes/assumptions.md`.
3. Define verification scenarios BEFORE writing implementation code.
4. Implement in small, clean commits; keep creative features strictly decoupled from headless outputs.
5. Run `npm run verify` + independent reviewer check; save real proof under `docs/proof/phase-N/`.
6. Update `docs/notes/ai-log.md` (errors found, harness adjustments, estimated token usage).

## Harness Changelog
- **CP0:** Initialized `AGENTS.md`, `verify-phase` skill, and project guardrails.
