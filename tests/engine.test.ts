import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/core/config.js';
import { createDefaultInput, distXZ, GameEngine } from '../src/core/engine.js';

/**
 * Updated in Phase 2 (Ticket-02):
 * Standardized constants replaced Phase 1 self-chosen values:
 * - lantern_cost: 5 -> 10
 * - pickup_radius: 1.8 -> 1.0 (plus |dy| <= 1.5)
 * - interact_radius: 2.5 -> 2.0
 * - pulse: cost 2->3, radius 8->5 (3D from foot+0.8m), stun 180->120 ticks, push 6m instant->4m/15 ticks, cd 120->180 ticks
 * - shade: hit_radius 1.4->1.0, recoil 2m/60 ticks, dropped motes spawn on ground (480 ticks TTL)
 * - score: +10 per deposited mote (not pickup), +100 lantern, +5 stun, +2/s, +50/flame
 * - fall_enabled: false -> true
 */
describe('Phase 1 regression + Phase 2 standardized core rules', () => {
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

  it('auto-picks motes within pickup_radius=1.0m & |dy|<=1.5m and respects carry_capacity=10', () => {
    const engine = new GameEngine(3, 1, {
      player: { pos: [0, 0, 0], carried: DEFAULT_TUNING.carry_capacity - 1 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1.0], // on pickup_radius boundary => picked
        [0, 0, 0.5], // player now full => stays on ground
      ],
    });

    const events = engine.step(createDefaultInput()).filter((e) => e.name !== 'night_start');
    expect(events).toEqual([
      { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 10 } },
    ]);
    const snap = engine.getSnapshot();
    expect(snap.player.carried).toBe(10);
    expect(snap.motes_active).toBe(1);
    expect(snap.score).toBe(0); // v1.1 scores on deposit, not pickup
  });

  it('deposits min(carried, needed), preserves remainder, lights lantern at 10, and awards v1.1 win bonus', () => {
    const engine = new GameEngine(4, 1, {
      player: { pos: [0, 0, 25], carried: 7, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], deposited: 7, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 100,
    });

    const input = createDefaultInput();
    input.interact = true;
    const events = engine.step(input).filter((e) => e.name !== 'night_start');

    expect(events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 10 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } },
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } },
    ]);

    const snap = engine.getSnapshot();
    expect(snap.state).toBe('won');
    expect(snap.player.carried).toBe(4);
    // 3 * 10 (deposit) + 100 (lantern) + floor(99.983)*2 + 3*50 = 30 + 100 + 198 + 150 = 478
    expect(snap.score).toBe(478);
  });

  it('handles v1.1 pulse (cost 3, 3D radius 5m from foot+0.8m, 120t stun, 4m/15t push, 180t cd)', () => {
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
    expect(engine.getSnapshot().score).toBe(5); // +5 per stun

    // Run 14 more ticks so total 15 ticks of push complete (4.0m total horizontal push)
    const idle = createDefaultInput();
    for (let i = 0; i < 14; i++) engine.step(idle);
    expect(engine.getSnapshot().shades[0].state).toBe('stunned');
    expect(engine.getSnapshot().shades[0].pos[2]).toBeCloseTo(8.0, 2);

    // Wait remaining cooldown up to tick 181 -> second pulse succeeds
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

    // Must not deal damage during ejection and must be outside 6.0m by tick 31
    for (let i = 0; i < 30; i++) {
      const evs = engine.step(createDefaultInput());
      expect(evs.some((e) => e.name === 'player_hit')).toBe(false);
    }
    expect(distXZ(engine.getSnapshot().shades[0].pos, [0, 0, 25])).toBeGreaterThan(6.0);
  });

  it('drops floor(carried/2) motes on shade hit with 480t TTL, recoils shade, and triggers dawn loss', () => {
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
