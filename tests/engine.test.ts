import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/core/config.js';
import { createDefaultInput, distXZ, GameEngine } from '../src/core/engine.js';

describe('Phase 1 GameEngine core rules', () => {
  it('moves camera-relative per Test Contract C and normalizes diagonal move vectors', () => {
    const engine = new GameEngine(1, 1, { random_motes: false, random_shades: false });

    // 60 ticks at yaw=0, move=[0, 1] => +6.0m on +Z
    const input = createDefaultInput();
    input.move = [0, 1];
    input.cam_yaw_deg = 0;
    for (let i = 0; i < 60; i++) engine.step(input);
    expect(engine.getSnapshot().player.pos).toEqual([0, 0, 6]);

    // 60 ticks at yaw=90 deg, move=[0, 1] => x'=sin(90)=1, z'=cos(90)=0 => +6.0m on +X
    input.cam_yaw_deg = 90;
    for (let i = 0; i < 60; i++) engine.step(input);
    expect(engine.getSnapshot().player.pos).toEqual([6, 0, 6]);

    // Diagonal [1, 1] must be normalized to length 1 => 60 ticks moves total distance 6.0m
    const engineDiag = new GameEngine(2, 1, { random_motes: false, random_shades: false });
    const diagInput = createDefaultInput();
    diagInput.move = [1, 1];
    for (let i = 0; i < 60; i++) engineDiag.step(diagInput);
    const pos = engineDiag.getSnapshot().player.pos;
    expect(Math.hypot(pos[0], pos[2])).toBeCloseTo(6.0, 2);
  });

  it('auto-picks motes within pickup_radius and respects carry_capacity without losing excess motes', () => {
    const engine = new GameEngine(3, 1, {
      player: { pos: [0, 0, 0], carried: DEFAULT_TUNING.carry_capacity - 1 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1.8], // exactly on pickup_radius boundary => picked
        [0, 0, 1.0], // player now full => stays on ground
      ],
    });

    const events = engine.step(createDefaultInput());
    expect(events).toEqual([
      { type: 'event', tick: 1, name: 'mote_picked', data: { carried: DEFAULT_TUNING.carry_capacity } },
    ]);
    const snap = engine.getSnapshot();
    expect(snap.player.carried).toBe(DEFAULT_TUNING.carry_capacity);
    expect(snap.motes_active).toBe(1);
  });

  it('deposits min(carried, needed), preserves remainder, lights lantern, and awards win bonus', () => {
    const engine = new GameEngine(4, 1, {
      player: { pos: [0, 0, 22], carried: 7, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 22], deposited: 2, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 100,
    });

    // Scenario setup emits no events & score is 0
    expect(engine.getSnapshot().score).toBe(0);

    const input = createDefaultInput();
    input.interact = true;
    const events = engine.step(input);

    expect(events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 5 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } },
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } },
    ]);

    const snap = engine.getSnapshot();
    expect(snap.state).toBe('won');
    expect(snap.player.carried).toBe(4); // 7 - 3 preserved
    // time_left_s after 1 tick = 100 - 1/60 = 99.9833 -> floor(99.9833) = 99
    const expectedScore =
      DEFAULT_TUNING.score.per_lantern +
      99 * DEFAULT_TUNING.score.per_second_left +
      3 * DEFAULT_TUNING.score.per_flame_left;
    expect(snap.score).toBe(expectedScore);
  });

  it('handles pulse cost, insufficient light guard, stun, push, and cooldown', () => {
    // Insufficient light => no pulse event
    const poor = new GameEngine(5, 1, {
      player: { pos: [0, 0, 0], carried: 1 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 5] }],
    });
    const pulseIn = createDefaultInput();
    pulseIn.pulse = true;
    expect(poor.step(pulseIn).some((e) => e.name === 'pulse')).toBe(false);

    // Enough light => deducts pulse_cost, stuns and pushes shade away
    const engine = new GameEngine(6, 1, {
      player: { pos: [0, 0, 0], carried: 5 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 5] }],
    });
    const events = engine.step(pulseIn);
    expect(events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'pulse',
      data: { stunned_ids: ['S1'] },
    });
    const snap = engine.getSnapshot();
    expect(snap.player.carried).toBe(5 - DEFAULT_TUNING.pulse_cost);
    expect(snap.shades[0].state).toBe('stunned');
    expect(snap.shades[0].pos[2]).toBeCloseTo(5 + DEFAULT_TUNING.pulse_push_m, 2);
  });

  it('prevents shades from entering lit lantern safe_radius and ejects them when newly lit', () => {
    const engine = new GameEngine(7, 1, {
      player: { pos: [0, 0, 22], carried: 5 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 23] }], // inside safe_radius of L1 once lit
      lanterns: [{ id: 'L1', pos: [0, 0, 22], deposited: 0, lit: false }],
    });

    const input = createDefaultInput();
    input.interact = true;
    engine.step(input);

    // After L1 lights, S1 must be outside safe_radius (6.0m) and remain outside while chasing
    for (let i = 0; i < 60; i++) {
      engine.step(createDefaultInput());
      const snap = engine.getSnapshot();
      const d = distXZ(snap.shades[0].pos, [0, 0, 22]);
      expect(d).toBeGreaterThan(DEFAULT_TUNING.safe_radius!);
    }
  });

  it('drops floor(carried * hit_drop_ratio) on hit, enforces invuln_s, and loses at 0 flames', () => {
    const engine = new GameEngine(8, 1, {
      player: { pos: [0, 0, 0], carried: 5, flames: 2 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 1.0] }],
    });

    const ev1 = engine.step(createDefaultInput());
    expect(ev1).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'player_hit',
      data: { by: 'shade', flames: 1, dropped: 2 }, // floor(5 * 0.5) = 2
    });
    expect(engine.getSnapshot().player.carried).toBe(3);

    // During invuln_s (1.5s = 90 ticks), player is not hit again
    for (let i = 0; i < 60; i++) {
      const ev = engine.step(createDefaultInput());
      expect(ev.some((e) => e.name === 'player_hit')).toBe(false);
    }

    // After invuln expires, next hit reduces flames to 0 -> game_over (lost, no_flames)
    let gameOverEv = null;
    for (let i = 0; i < 60 && engine.state === 'playing'; i++) {
      const ev = engine.step(createDefaultInput());
      const go = ev.find((e) => e.name === 'game_over');
      if (go) gameOverEv = go;
    }
    expect(gameOverEv).toMatchObject({
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
    });
  });

  it('triggers dawn loss when time_left_s reaches 0', () => {
    const engine = new GameEngine(9, 1, {
      random_motes: false,
      random_shades: false,
      time_left_s: 1,
    });
    const records = engine.runHeadless(undefined, 120, 30);
    const go = records.find((r) => r.type === 'event' && r.name === 'game_over');
    expect(go).toEqual({
      type: 'event',
      tick: 60,
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });
    const end = records[records.length - 1];
    expect(end).toEqual({ type: 'end', ticks: 60, state: 'lost', score: 0 });
  });

  it('enforces exact integer pulse cooldown (120 ticks = 2.0s), edge trigger, and 0-shade pulse', () => {
    const engine = new GameEngine(10, 1, {
      player: { pos: [0, 0, 0], carried: 6 },
      random_motes: false,
      random_shades: false,
      shades: [],
    });

    // Tick 0 -> step 1: pulse fires even with 0 shades in range
    const pOn = createDefaultInput();
    pOn.pulse = true;
    const ev1 = engine.step(pOn);
    expect(ev1).toContainEqual({ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: [] } });
    expect(engine.getSnapshot().player.carried).toBe(4);

    // Holding pulse true on tick 2 must NOT re-trigger
    expect(engine.step(pOn).some((e) => e.name === 'pulse')).toBe(false);

    // Release and wait until exactly tick 120 (118 more idle ticks => 120 ticks since pulse at tick 1)
    const idle = createDefaultInput();
    for (let i = 0; i < 118; i++) engine.step(idle);
    // Still 1 tick left on cooldown (tick 120 -> pulse_cooldown_ticks drops 1 -> 0 at start of tick 121)
    const evRetry = engine.step(pOn);
    expect(evRetry).toContainEqual({ type: 'event', tick: 121, name: 'pulse', data: { stunned_ids: [] } });
    expect(engine.getSnapshot().player.carried).toBe(2);
  });

  it('supports negative cam_yaw_deg and ticks=0 headless run', () => {
    const engine = new GameEngine(11, 1, { random_motes: false, random_shades: false });
    const input = createDefaultInput();
    input.move = [0, 1];
    input.cam_yaw_deg = -90; // sin(-90)=-1 => -X
    for (let i = 0; i < 60; i++) engine.step(input);
    expect(engine.getSnapshot().player.pos).toEqual([-6, 0, 0]);

    const zeroEngine = new GameEngine(12, 1, { random_motes: false, random_shades: false });
    const records = zeroEngine.runHeadless(undefined, 0, 10);
    expect(records).toHaveLength(2);
    expect(records[0].type).toBe('snapshot');
    expect(records[1]).toEqual({ type: 'end', ticks: 0, state: 'playing', score: 0 });
  });
});

