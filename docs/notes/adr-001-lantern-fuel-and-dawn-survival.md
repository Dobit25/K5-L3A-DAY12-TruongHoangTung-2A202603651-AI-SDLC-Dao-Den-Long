# ADR-001: Lantern Fuel State Machine & Dawn-Survival Win Condition (Phase 3 / Ticket-03)

- **Status:** Accepted & Implemented (`phase-3`, Contract v1.2)
- **Date:** 2026-11-20
- **Context:** Playtest feedback showed skilled players lit all lanterns within ~2 minutes and ended the Night early, removing late-night tension. Ticket-03 replaced early `all_lit` victory with a fuel-management survival loop ("giữ đảo sáng tới bình minh").

---

## 1. Decision: Lantern State Machine & Exact Integer Fuel Arithmetic

### Previous Model (Phase 1–2)
- Binary state: `unlit (deposited < 10)` → `lit` (permanent, never accepted motes again, permanent `6m` safe zone).

### New Model (Phase 3 / Contract v1.2)
Each lantern tracks `(lit, deposited, fuel_60ths, ever_lit, relit_count)`:

1. **Exact Integer 1/60th Fuel Units (`fuel_60ths ∈ [0, 6000]`):**
   - To eliminate IEEE-754 cumulative drift across 18,000 ticks, `1.0 fuel === 60` integer units (`100.0 === 6000`, `30.0 === 1800`, `10.0 === 600`).
   - Natural decay subtracts `1` unit/tick; each draining Shade subtracts `5` units/tick (stacked).
   - Output snapshots format `fuel = lit ? round1(fuel_60ths / 60) : 0`.
2. **State Transitions:**
   - `unlit (ever_lit=false)`: requires `10` motes (`+100` on light) → `lit (fuel=100, ever_lit=true)`.
   - `lit (fuel >= 30)`: active `6m` safe zone; eligible for `refuel` only if `fuel_60ths < 6000` (`used = min(carried, ceil((6000 - fuel_60ths)/600))`).
   - `lit (0 < fuel < 30)`: **safe zone disabled**; wandering Shades prioritize nearest weak lantern and enter `drain` state within `<= 2m`. Refueling back to `>= 30` breaks `drain` and triggers `<= 30`-tick safe-zone ejection.
   - `fuel <= 0` (checked immediately after Step 2): transitions to `unlit (deposited=0, ever_lit=true)` and emits `lantern_out`.
   - `unlit (ever_lit=true)`: relights for only `5` motes (`+40`, `relight: true`, `relit_count += 1`).
3. **Dynamic Capacity:**
   - Every successful light/relight increments `player.successful_lights`, raising `capacity = min(20, 10 + 2 * successful_lights)` (scenario pre-lit lanterns excluded).

---

## 2. Decision: Win/Loss Condition Replacement

- **Removed:** Early win `game_over { result: "won", reason: "all_lit" }`.
- **Replaced with Dawn Survival (`Step 11`):**
  1. `flames <= 0` → immediate `lost` (`no_flames`), even on the exact dawn tick.
  2. `time_left_s <= 0` (Night durations reduced to `240 / 270 / 300s`):
     - If `litCount >= ceil(0.6 * totalLanterns)` (`3/5`, `4/6`, `5/7`) → `won` (`dawn_survived`) with dawn bonus `Σ_lit (50 + floor(fuel)) + 50 * flames` (time bonus removed).
     - Otherwise → `lost` (`dawn`).

---

## 3. Consequences & Test Migration
- **Affected old tests updated explicitly (zero silently skipped tests):**
  - `tests/contract.test.ts` updated for Contract v1.2 schema & durations.
  - `tests/engine.test.ts` updated to verify no early `all_lit` win, `+5` deposit score, `relight` flag, and dynamic capacity.
  - `tests/scenarios.test.ts` & `tests/fixtures/phase1-win-scenario.json` updated to verify `dawn_survived` win at tick `120` with exact v1.2 score (`705`).
- **New verification added:** `tests/phase3-fuel.test.ts` (fuel decay/out/relight, refuel & safe-zone ejection, Shade `drain` + `fuel_drain` + `+15` Pulse bonus, `dawn_survived` vs `dawn` loss, capacity cap `20`).

