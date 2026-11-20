# Changelog — Đảo Đèn Lồng

All notable changes and breaking contract migrations across lab phases.

---

## [v1.0.0 / Phase 4] — Contract v1.3 ("Bình minh: phát hành v1.0.0")
### Added
- **Benchmark Mode (`bench_cmd`: `node scripts/bench.mjs`):** Standardized 1280×720 Night 1 benchmark scene (`src/render/benchmark.ts`, `InstancedMesh` 200 wandering Shades + 100 Motes, L1–L3 lit with `fuel = 100`, camera orbiting `R=30m, Y=15m`, 15s/rev CCW, 3s warmup + `--duration` measurement, `--disable-frame-rate-limit --disable-gpu-vsync`), outputting `bench.json` (`contract_version: "1.3"`).
- **Soak Test (`soak_cmd`: `node --expose-gc dist-cli/cli/soak.js`):** 10 consecutive Nights headless stress test (`Night 1→2→3` rotation, deterministic random inputs per Ticket-04 spec, RSS tracking `mem_start_mb` / `mem_end_mb`), outputting `soak.json` with `0` crashes and bounded RSS growth (`<= 1.2×`).
- **Local Leaderboard & CLI Export (`run_cmd`: `node scripts/run-game.mjs`):** Top-10 local disk-persisted leaderboard (`data/leaderboard.json` + browser `localStorage` sync), supports `3–12` char names (ASCII `[A-Za-z0-9_]` + Vietnamese letters), ISO-8601 timestamps with timezone, tie-break by earliest `achieved_at`, Main Menu Leaderboard viewer, post-Dawn/Loss save prompt, and `--export-leaderboard out.json`.
- **Accessibility Suite:** Full 9-action key rebinding with duplicate-key conflict detection & Reset to Defaults; live subtitles + edge-of-screen directional arrow for Shade spawns, Wind warning, last 10s countdown, and `< 30%` low-fuel lanterns; Reduced Motion toggle (disables screen flash/blink & camera bob); `>= 18px` minimum UI font size at `1280×720` with `×1.25` Large Text mode.
- **Release Packaging:** Clean 3-command quickstart (`npm ci`, `npm run build`, `npm start`), static web bundle (`dist/`), backup `Dockerfile`, full project Retrospective (`docs/notes/retro.md`), and demo recording guide.

---

## [Phase 3] — Contract v1.2 ("Đèn cạn dầu" Change Request)
### Breaking Changes (`[THAY THẾ]`)
- **Win Condition Replaced:** Removed early victory (`all_lit`) when all lanterns are lit. Nights now last until dawn (`240s / 270s / 300s`); victory (`dawn_survived`) requires surviving with `>= ceil(0.6 * total)` lit lanterns (`3/5`, `4/6`, `5/7`).
- **Lantern Fuel & Extinguish:** Lit lanterns start at `fuel = 100`, decay at `1.0/s` (exact integer `1/60` per tick), can be refueled (`used = min(carried, ceil((100 - fuel)/10))`, `+10` fuel/mote), and extinguish at `fuel <= 0` (`lantern_out`, `deposited = 0`, `ever_lit = true`). Relighting costs `5` motes instead of `10`.
- **Safe Zone & Shade `drain` State:** Lanterns with `fuel < 30` lose their `6m` safe zone (exact `30` keeps it). Wandering Shades target the nearest weak lit lantern and enter `drain` state within `<= 2m`, draining `5.0/s` (stacked) and emitting `fuel_drain` every 60 ticks.
- **Scoring Replaced:** `+5` per deposited mote (down from `+10`), `+100` first light, `+40` relight, `+5` Pulse stun (`+15` total if target was draining), dawn bonus `+50 + floor(fuel)` per lit lantern + `+50` per remaining flame; time-remaining bonus removed (`per_second_left: 0`).
- **Event & Snapshot Schema v1.2:**
  - `lantern_lit` now includes `{ lantern_id, relight: boolean }`.
  - New events: `refuel`, `lantern_out`, `fuel_drain`; `game_over.reason` adds `dawn_survived` (removes `all_lit`).
  - Snapshot lanterns add `fuel`, `ever_lit`, `relit_count`; player adds `capacity`; Shade states add `drain`.

### Added
- **Dynamic Carry Capacity:** `capacity = min(20, 10 + 2 * successful_lights)` per Night.
- **Colorblind Accessibility Mode:** Persisted setting switching Shade rim/eyes (`#7A3CFF` → `#00B3FF`), danger UI (`#FF5A5F` → `#FFFFFF` + `⚠`), plus non-color lantern differentiation (unlit bulbs squashed 20% with torn-paper marks, 3D fuel bar + 1 Hz low-fuel blink).
- **ADR-001:** Documented lantern state machine and win-condition migration in `docs/notes/adr-001-lantern-fuel-and-dawn-survival.md`.

---

## [Phase 2] — Contract v1.1 ("Ba hòn đảo")
### Breaking Changes
- Standardized all tuning values in `game.contract.json` (`v1.1`): `lantern_cost: 10`, `pickup_radius: 1.0`, `interact_radius: 2.0`, `pulse_cost: 3`, `pulse_radius: 5.0`, `fall_enabled: true`, scoring moved to deposit.
### Added
- 3 full Nights (Đảo Bến, Đảo Cau with bridge & jump pads, Đảo Chuông with 3 tiers, ramps, bell tower & wind).
- Dash, Island Fall & Respawn, Gió Lạc (Drifters), Bùa Gió (Charms), Pause/Resume, 3-Night campaign UI, persisted settings, standardized palette, full HUD & procedural audio.

---

## [Phase 1] — Contract v1.0 ("Đêm 1 — Đảo Bến")
- Initial playable 3D Night 1 + deterministic 60Hz Node.js core engine & headless CLI (`game.contract.json` v1.0), unit/CLI tests, SHA-256 determinism gate, and AI SDLC harness.

