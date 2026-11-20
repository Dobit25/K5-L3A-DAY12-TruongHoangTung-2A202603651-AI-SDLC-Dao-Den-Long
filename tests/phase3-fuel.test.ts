import { describe, expect, it } from 'vitest';
import { createDefaultInput, distXZ, GameEngine } from '../src/core/engine.js';

describe('Phase 3 (Ticket-03 "Đèn cạn dầu" — Contract v1.2)', () => {
  it('decays fuel at exact 1/60 per tick, emits lantern_out at 0, sets ever_lit, and relights for 5 motes (+40 score)', () => {
    const engine = new GameEngine(301, 1, {
      player: { pos: [0, 0, 25], carried: 5 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 1 }],
      time_left_s: 100,
    });

    // 59 ticks -> still lit with fuel = 1/60 (~0.0)
    for (let i = 0; i < 59; i++) {
      expect(engine.step(createDefaultInput()).some((e) => e.name === 'lantern_out')).toBe(false);
    }
    expect(engine.getSnapshot().lanterns[0].lit).toBe(true);

    // Tick 60 -> fuel hits 0 -> lantern_out, ever_lit = true, fuel = 0
    const evOut = engine.step(createDefaultInput());
    expect(evOut).toContainEqual({ type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } });
    const snapOut = engine.getSnapshot();
    expect(snapOut.lanterns[0].lit).toBe(false);
    expect(snapOut.lanterns[0].ever_lit).toBe(true);
    expect(snapOut.lanterns[0].fuel).toBe(0);

    // Relight L1 with only 5 motes -> +5*5 (25) + 40 relight = 65 score, relit_count = 1, capacity = 12
    const interactIn = createDefaultInput();
    interactIn.interact = true;
    const evRelight = engine.step(interactIn);
    expect(evRelight).toContainEqual({
      type: 'event',
      tick: 61,
      name: 'deposit',
      data: { lantern_id: 'L1', amount: 5, deposited: 5 },
    });
    expect(evRelight).toContainEqual({
      type: 'event',
      tick: 61,
      name: 'lantern_lit',
      data: { lantern_id: 'L1', relight: true },
    });

    const snapLit = engine.getSnapshot();
    expect(snapLit.lanterns[0].lit).toBe(true);
    expect(snapLit.lanterns[0].fuel).toBe(100);
    expect(snapLit.lanterns[0].relit_count).toBe(1);
    expect(snapLit.player.capacity).toBe(12);
    expect(snapLit.score).toBe(65);
  });

  it('refuels lit lantern with ceil((100-fuel)/10), skips full lantern, and ejects shades when raised >= 30', () => {
    const engine = new GameEngine(302, 1, {
      player: { pos: [0, 0, 25], carried: 10 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 },
        { id: 'L2', pos: [0, 0, 25.5], lit: true, fuel: 100 }, // full -> must NOT be chosen
      ],
      shades: [{ id: 'S1', pos: [0, 0, 26.5], state: 'drain', target_lantern_id: 'L1' }],
    });

    const interactIn = createDefaultInput();
    interactIn.interact = true;
    const evs = engine.step(interactIn);
    // Tick 1 decays L1 by 6/60 = 0.1 -> fuel = 24.9 -> missing = 75.1 -> ceil(75.1/10) = 8 motes -> capped at 100
    expect(evs).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'refuel',
      data: { lantern_id: 'L1', amount: 8, fuel: 100 },
    });
    expect(engine.getSnapshot().player.carried).toBe(2);
    expect(engine.getSnapshot().score).toBe(40); // 8 * 5
    expect(engine.getSnapshot().shades[0].state).toBe('wander');

    // Within 30 ticks, S1 is ejected outside 6.0m safe zone
    for (let i = 0; i < 30; i++) engine.step(createDefaultInput());
    expect(distXZ(engine.getSnapshot().shades[0].pos, [0, 0, 25])).toBeGreaterThan(6.0);
  });

  it('keeps safe zone at exact fuel=30.0 (1800) and loses safe zone below 30.0', () => {
    // At fuel=30 + 1/60 (~30.017), after Step 2 decay it is exact 30.0 -> safe zone stays active
    const safeEngine = new GameEngine(309, 1, {
      player: { pos: [0, 0, 0] },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 30.02 }],
      shades: [{ id: 'S1', pos: [0, 0, 31.1], state: 'wander' }],
    });
    safeEngine.step(createDefaultInput());
    expect(safeEngine.getSnapshot().lanterns[0].fuel).toBe(30);
    expect(safeEngine.getSnapshot().shades[0].state).toBe('wander');
    expect(distXZ(safeEngine.getSnapshot().shades[0].pos, [0, 0, 25])).toBeGreaterThan(6.0);
  });

  it('stacks 2 draining shades (11/60 per tick), transitions drain->chase at <=6m, and resets drain on lantern_out', () => {
    const engine = new GameEngine(310, 1, {
      player: { pos: [0, 0, 0] },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [
        { id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' },
        { id: 'S2', pos: [0, 0, 24], state: 'drain', target_lantern_id: 'L1' },
      ],
    });
    // 60 ticks: decay 1/s + 2*5/s = 11/s -> 20 - 11 = 9.0 fuel
    for (let i = 0; i < 60; i++) engine.step(createDefaultInput());
    expect(engine.getSnapshot().lanterns[0].fuel).toBe(9);

    // Player at 5m from draining shade triggers drain -> chase
    const aggroEngine = new GameEngine(311, 1, {
      player: { pos: [0, 0, 20] },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 0, 25], state: 'drain', target_lantern_id: 'L1' }],
    });
    aggroEngine.step(createDefaultInput());
    expect(aggroEngine.getSnapshot().shades[0].state).toBe('chase');

    // On exact tick lantern goes out, Pulse awards +5 (not +15) because drain ended on lantern_out
    const outPulseEngine = new GameEngine(312, 1, {
      player: { pos: [0, 0, 22], carried: 5 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 0.05 }],
      shades: [{ id: 'S1', pos: [0, 0, 25], state: 'drain', target_lantern_id: 'L1' }],
    });
    const pulseIn = createDefaultInput();
    pulseIn.pulse = true;
    const evs = outPulseEngine.step(pulseIn);
    expect(evs.some((e) => e.name === 'lantern_out')).toBe(true);
    expect(outPulseEngine.getSnapshot().score).toBe(5);
  });

  it('enforces no_flames priority over dawn_survived on exact dawn tick and dynamic capacity pickup >10', () => {
    const tieEngine = new GameEngine(313, 1, {
      player: { pos: [0, 0, 0], flames: 1 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', lit: true, fuel: 80 },
        { id: 'L2', lit: true, fuel: 80 },
        { id: 'L3', lit: true, fuel: 80 },
      ],
      shades: [{ id: 'S1', pos: [0, 0, 0.5], state: 'chase' }],
      time_left_s: 1 / 60,
    });
    const evs = tieEngine.step(createDefaultInput());
    expect(evs.find((e) => e.name === 'game_over')).toEqual({
      type: 'event',
      tick: 1,
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
    });

    // Dynamic capacity allows picking up to 12 motes after 1 light; scenario pre-lit does NOT count
    const capPick = new GameEngine(314, 1, {
      player: { pos: [0, 0, 0], carried: 10, successful_lights: 1 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L2', lit: true, fuel: 100 }],
      motes: [[0, 0, 0.2], [0, 0, 0.4], [0, 0, 0.6]],
    });
    capPick.step(createDefaultInput());
    expect(capPick.getSnapshot().player.capacity).toBe(12);
    expect(capPick.getSnapshot().player.carried).toBe(12);
    expect(capPick.getSnapshot().motes_active).toBe(1);
  });

  it('allows shade to enter and drain weak lantern (< 30 fuel), emits fuel_drain every 60 ticks, and awards +15 Pulse bonus', () => {
    const engine = new GameEngine(304, 1, {
      player: { pos: [0, 0, 0], carried: 5 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0, 28], state: 'wander' }],
    });

    // Move shade into drain range (3m away at 4 m/s -> reaches <= 2m in ~16 ticks)
    let enteredDrain = false;
    let fuelDrainEv = null;
    for (let i = 0; i < 90; i++) {
      const evs = engine.step(createDefaultInput());
      if (engine.getSnapshot().shades[0].state === 'drain') enteredDrain = true;
      const fd = evs.find((e) => e.name === 'fuel_drain');
      if (fd) {
        fuelDrainEv = fd;
        break;
      }
    }
    expect(enteredDrain).toBe(true);
    expect(fuelDrainEv).toMatchObject({
      name: 'fuel_drain',
      data: { lantern_id: 'L1', shade_id: 'S1' },
    });

    // Pulse a draining shade -> awards +15 total (instead of +5)
    const pulseEngine = new GameEngine(305, 1, {
      player: { pos: [0, 0, 22], carried: 5 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0, 25], state: 'drain', target_lantern_id: 'L1' }],
    });
    const pulseIn = createDefaultInput();
    pulseIn.pulse = true;
    const evPulse = pulseEngine.step(pulseIn);
    expect(evPulse).toContainEqual({ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
    expect(pulseEngine.getSnapshot().score).toBe(15);
  });

  it('wins with dawn_survived when lit >= ceil(0.6*total) at dawn and awards dawn lantern+flame bonus (no time bonus)', () => {
    const engine = new GameEngine(306, 1, {
      player: { pos: [0, 0, 0], flames: 2 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', lit: true, fuel: 81 },
        { id: 'L2', lit: true, fuel: 61 },
        { id: 'L3', lit: true, fuel: 41 },
        { id: 'L4', lit: false },
        { id: 'L5', lit: false },
      ],
      time_left_s: 1,
    });

    // After 60 ticks (1s), each lit lantern loses exactly 1.0 fuel -> 80, 60, 40 (3/5 >= ceil(0.6*5)=3 -> WON!)
    const records = engine.runHeadless(undefined, 120, 60);
    const go = records.find((r) => r.type === 'event' && r.name === 'game_over');
    expect(go).toEqual({
      type: 'event',
      tick: 60,
      name: 'game_over',
      data: { result: 'won', reason: 'dawn_survived' },
    });

    // Dawn bonus: (50+80) + (50+60) + (50+40) + (2*50) = 130 + 110 + 90 + 100 = 430
    const end = records[records.length - 1];
    expect(end).toEqual({ type: 'end', ticks: 60, state: 'won', score: 430 });
  });

  it('loses with dawn when lit < ceil(0.6*total) at dawn, and caps dynamic capacity at 20', () => {
    const loseEngine = new GameEngine(307, 1, {
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 },
        { id: 'L2', lit: true, fuel: 50 },
      ],
      time_left_s: 1,
    });
    const recs = loseEngine.runHeadless(undefined, 120, 60);
    expect(recs.find((r) => r.type === 'event' && r.name === 'game_over')).toEqual({
      type: 'event',
      tick: 60,
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });

    const capEngine = new GameEngine(308, 1, {
      player: { successful_lights: 10 },
      random_motes: false,
      random_shades: false,
    });
    expect(capEngine.getSnapshot().player.capacity).toBe(20);
  });
});

