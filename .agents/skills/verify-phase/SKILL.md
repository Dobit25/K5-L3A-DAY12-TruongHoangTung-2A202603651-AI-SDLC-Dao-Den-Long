---
name: verify-phase
description: Run end-to-end verification for a Đảo Đèn Lồng phase (typecheck, build, unit tests, headless Test Contract scenarios, determinism check) and record reproducible proof artifacts.
---

# Verify Phase Skill

Use this skill before tagging any `phase-N` commit.

## Gate Rules
- **Fail-closed:** If ANY check fails (typecheck, unit test, headless scenario, determinism comparison, or build), stop immediately and report the exact failure. Do NOT tag the phase while red.
- **No hand-edited proof:** All proof files saved to `docs/proof/phase-N/` must be captured verbatim from actual command execution against the current commit.

## Steps
1. Run `npm run verify` inside the `gen` conda environment (or standard Node.js on macOS/Linux).
2. Confirm headless determinism across all active Nights (`--night 1`, `2`, `3`) by executing each twice and asserting SHA-256 byte-for-byte identical output.
3. Confirm full-night headless performance benchmark (`21,600` ticks completes within `<= 30s`).
4. Verify no forbidden edits touched the 6 original lab files (`README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`).
5. Verify no secrets (`.env`, API keys, tokens) are staged or tracked in git.
6. Capture summary output and requirement traceability matrix into `docs/proof/phase-N/verification-report.md`.
7. Invoke an independent reviewer (separate from the coding pass) to audit requirement coverage, edge cases, and regression against earlier phases before final commit/tag.
