import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/core/config.js';
import { createDefaultInput, distXZ, GameEngine } from '../src/core/engine.js';

/**
 * Updated in Phase 3 (Ticket-03 — Change Request "Đèn cạn dầu", Contract v1.2):
 * Breaking rule replacements documented explicitly per DoD (zero silently skipped tests):
 * 1. [REPLACED] Early win on `all_lit` removed -> game continues until dawn (`dawn_survived` when lit >= ceil(0.6*total)).
 * 2. [REPLACED] Scoring formula: +5 per deposited mote (was +10), +100 first light, +40 relight,
 *    +5 stun (+15 if draining), dawn bonus = sum(50 + floor(fuel)) + 50*flames (time bonus removed).
 * 3. `lantern_lit` event now carries `{ lantern_id, relight: boolean }`.
 * 4. Lighting a lantern increments `successful_lights` -> `capacity = min(20, 10 + 2*successful_lights)`.
 */
describe('Phase 1-2 regression + Phase 3 Contract v1.2 core rules', () => {
  it('moves camera-relative per Contract C and normalizes diagonal move vectors', () => {
    const engine = new GameEngine(1, 1, { random_motes: false, random_shades: false });

    const input = createDefaultInput();
    input.move = [0, 1];
    input.cam_yaw_deg = 0;
    for (let i = 0; i < 60; i++) engine.step(input);
    expect(engine.getSnapshot().player.pos).toEqual([0, 0, 6]);

    input.cam_yaw_deg = 90;
    for (let i = 0; i < 60; i++) engine.step(input);
    expect(engine.getSnapshot().player.pos).toEqual([6, 0, 6]);

    const engineDiag = new GameEngine(2, 1, { random_motes: false, random_shades: false });
    const diagInput = createDefaultInput();
    diagInput.move = [1, 1];
    for (let i = 0; i < 60; i++) engineDiag.step(diagInput);
    const pos = engineDiag.getSnapshot().player.pos;
    expect(Math.hypot(pos[0], pos[2])).toBeCloseTo(6.0, 2);
  });

  it('auto-picks motes within pickup_radius=1.0m & |dy|<=1.5m and respects dynamic capacity', () => {
    const engine = new GameEngine(3, 1, {
      player: { pos: [0, 0, 0], carried: DEFAULT_TUNING.carry_capacity - 1 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1.0],
        [0, 0, 0.5],
      ],
    });

    const events = engine.step(createDefaultInput()).filter((e) => e.name !== 'night_start');
    expect(events).toEqual([
      { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 10 } },
    ]);
    const snap = engine.getSnapshot();
    expect(snap.player.carried).toBe(10);
    expect(snap.player.capacity).toBe(10);
    expect(snap.motes_active).toBe(1);
    expect(snap.score).toBe(0);
  });

  it('lights all 5 lanterns without early win [REPLACED in Ticket-03] and awards v1.2 score + capacity boost', () => {
    const engine = new GameEngine(4, 1, {
      player: { pos: [0, 0, 25], carried: 7, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], deposited: 7, lit: false },
        { id: 'L2', lit: true, fuel: 100 },
        { id: 'L3', lit: true, fuel: 100 },
        { id: 'L4', lit: true, fuel: 100 },
        { id: 'L5', lit: true, fuel: 100 },
      ],
      time_left_s: 10,
    });

    const input = createDefaultInput();
    input.interact = true;
    const events = engine.step(input).filter((e) => e.name !== 'night_start');

    expect(events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 10 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1', relight: false } },
    ]);

    const snap = engine.getSnapshot();
    // [REPLACED] No early win on all_lit
    expect(snap.state).toBe('playing');
    expect(snap.player.carried).toBe(4);
    expect(snap.player.capacity).toBe(12); // 10 + 2*1
    expect(snap.score).toBe(3 * 5 + 100); // 115
  });

  it('handles v1.1/v1.2 pulse (cost 3, 3D radius 5m from foot+0.8m, 120t stun, 4m/15t push, 180t cd)', () => {
    const poor = new GameEngine(5, 1, {
      player: { pos: [0, 0, 0], carried: 2 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 4] }],
    });
    const pulseIn = createDefaultInput();
    pulseIn.pulse = true;
    expect(poor.step(pulseIn).some((e) => e.name === 'pulse')).toBe(false);

    const engine = new GameEngine(6, 1, {
      player: { pos: [0, 0, 0], carried: 6 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 4] }],
    });
    const ev1 = engine.step(pulseIn);
    expect(ev1).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'pulse',
      data: { stunned_ids: ['S1'] },
    });
    expect(engine.getSnapshot().player.carried).toBe(3);
    expect(engine.getSnapshot().score).toBe(5);

    const idle = createDefaultInput();
    for (let i = 0; i < 14; i++) engine.step(idle);
    expect(engine.getSnapshot().shades[0].state).toBe('stunned');
    expect(engine.getSnapshot().shades[0].pos[2]).toBeCloseTo(8.0, 2);

    for (let i = 0; i < 165; i++) engine.step(idle);
    const ev2 = engine.step(pulseIn);
    expect(ev2.some((e) => e.name === 'pulse')).toBe(true);
  });

  it('ejects shades from newly lit lantern safe_radius within <= 30 ticks and blocks re-entry', () => {
    const engine = new GameEngine(7, 1, {
      player: { pos: [0, 0, 25], carried: 10 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 26], state: 'chase' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0, lit: false }],
    });

    const input = createDefaultInput();
    input.interact = true;
    engine.step(input);

    for (let i = 0; i < 30; i++) {
      const evs = engine.step(createDefaultInput());
      expect(evs.some((e) => e.name === 'player_hit')).toBe(false);
    }
    expect(distXZ(engine.getSnapshot().shades[0].pos, [0, 0, 25])).toBeGreaterThan(6.0);
  });

  it('drops floor(carried/2) motes on shade hit with 480t TTL, recoils shade, and triggers dawn loss when <60% lit', () => {
    const engine = new GameEngine(8, 1, {
      player: { pos: [0, 0, 0], carried: 5, flames: 2 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 0.8], state: 'chase' }],
    });

    const ev1 = engine.step(createDefaultInput());
    expect(ev1).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'player_hit',
      data: { by: 'shade', flames: 1, dropped: 2 },
    });
    const snap = engine.getSnapshot();
    expect(snap.player.carried).toBe(3);
    expect(snap.player.invuln).toBe(true);
    expect(snap.shades[0].state).toBe('recoil');
    expect(snap.motes.filter((m) => m.kind === 'dropped')).toHaveLength(2);

    const dawnEngine = new GameEngine(9, 1, {
      random_motes: false,
      random_shades: false,
      time_left_s: 1,
    });
    const recs = dawnEngine.runHeadless(undefined, 120, 30);
    expect(recs[recs.length - 1]).toEqual({ type: 'end', ticks: 60, state: 'lost', score: 0 });
  });
});
