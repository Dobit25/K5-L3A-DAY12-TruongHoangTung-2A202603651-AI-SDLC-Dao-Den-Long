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
2. Confirm headless determinism by executing at least one canonical scenario twice and asserting byte-for-byte identical output.
3. Verify no forbidden edits touched the 6 original lab files (`README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`).
4. Verify no secrets (`.env`, API keys, tokens) are staged or tracked in git.
5. Capture summary output and requirement traceability matrix into `docs/proof/phase-N/verification-report.md`.
6. Invoke an independent reviewer (separate from the coding pass) to audit requirement coverage, edge cases, and regression against earlier phases before final commit/tag.
