import { describe, expect, it } from 'vitest';
import { createDefaultInput, distXZ, GameEngine } from '../src/core/engine.js';

describe('Phase 2 (Ticket-02) new mechanics headless scenarios', () => {
  it('Dash: 14 m/s for 12 ticks, holds elevation in air, 90-tick cooldown from start', () => {
    const engine = new GameEngine(101, 1, {
      player: { pos: [0, 2, 0] },
      random_motes: false,
      random_shades: false,
    });
    const dashIn = createDefaultInput();
    dashIn.move = [0, 1];
    dashIn.dash = true;

    const ev1 = engine.step(dashIn);
    expect(ev1).toContainEqual({ type: 'event', tick: 1, name: 'dash', data: {} });
    expect(engine.getSnapshot().player.pos[1]).toBe(2);

    const idle = createDefaultInput();
    for (let i = 0; i < 11; i++) engine.step(idle);
    const afterDash = engine.getSnapshot();
    expect(afterDash.player.pos[1]).toBe(2); // held elevation across all 12 ticks
    expect(afterDash.player.pos[2]).toBeCloseTo(14 * 0.2, 2); // 2.8m dashed

    // Cooldown was 90 ticks from tick 1 -> tick 90 cannot dash yet, tick 91 can dash again
    for (let i = 0; i < 77; i++) engine.step(idle);
    expect(engine.step(dashIn).some((e) => e.name === 'dash')).toBe(false);
    engine.step(idle); // release edge
    expect(engine.step(dashIn).some((e) => e.name === 'dash')).toBe(true);
  });

  it('Fall off island (Y < -10): ignores invuln, loses all carried, respawns after 60 ticks with 90t invuln', () => {
    const engine = new GameEngine(102, 1, {
      player: { pos: [41, -9.8, 0], carried: 6, flames: 2, invuln_ticks: 50 },
      random_motes: false,
      random_shades: false,
    });

    let fallEvent = null;
    for (let i = 0; i < 10; i++) {
      const evs = engine.step(createDefaultInput());
      const hit = evs.find((e) => e.name === 'player_hit');
      if (hit) {
        fallEvent = hit;
        break;
      }
    }
    expect(fallEvent).toMatchObject({
      name: 'player_hit',
      data: { by: 'fall', flames: 1, dropped: 6, lost: 6 },
    });
    expect(engine.getSnapshot().player.carried).toBe(0);

    // Wait 60 respawn ticks -> back at spawn (0, 0, 0) with invuln active
    for (let i = 0; i < 60; i++) engine.step(createDefaultInput());
    const snap = engine.getSnapshot();
    expect(snap.player.pos).toEqual([0, 0, 0]);
    expect(snap.player.invuln).toBe(true);
  });

  it('Night 2 Đảo Cau: jump pad (20,0,18) launches player to Island B (70,0,0) within ~1.4s', () => {
    const engine = new GameEngine(103, 2, {
      player: { pos: [20, 0, 18] },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    });

    for (let i = 0; i < 95; i++) engine.step(createDefaultInput());
    const snap = engine.getSnapshot();
    expect(snap.player.grounded).toBe(true);
    expect(snap.player.pos[1]).toBe(0);
    expect(distXZ(snap.player.pos, [70, 0, 0])).toBeLessThanOrEqual(28);
  });

  it('Night 3 Đảo Chuông: jump pad (0,3,13) lands on Tier 2 (Y=6), bell tower blocks center, wind pushes player', () => {
    // Jump pad to Tier 2
    const padEngine = new GameEngine(104, 3, {
      player: { pos: [0, 3, 13] },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
    });
    for (let i = 0; i < 70; i++) padEngine.step(createDefaultInput());
    const padSnap = padEngine.getSnapshot();
    expect(padSnap.player.grounded).toBe(true);
    expect(padSnap.player.pos[1]).toBe(6);
    expect(Math.hypot(padSnap.player.pos[0], padSnap.player.pos[2])).toBeLessThanOrEqual(8);

    // Wind triggers at tick 1800 and pushes player over 300 ticks
    const windEngine = new GameEngine(105, 3, {
      player: { pos: [0, 0, -25] },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: true,
    });
    for (let i = 0; i < 1800; i++) windEngine.step(createDefaultInput());
    expect(windEngine.getSnapshot().wind.active).toBe(true);
    const posBefore = [...windEngine.getSnapshot().player.pos];
    for (let i = 0; i < 60; i++) windEngine.step(createDefaultInput());
    const posAfter = windEngine.getSnapshot().player.pos;
    expect(Math.hypot(posAfter[0] - posBefore[0], posAfter[2] - posBefore[2])).toBeCloseTo(2.0, 1);
  });

  it('Gió Lạc (Drifter): chases when carried>=5 & <=15m, steals up to 3, and Pulse makes fleeing drifter drop motes', () => {
    const engine = new GameEngine(106, 2, {
      player: { pos: [0, 0, 0], carried: 8, invuln_ticks: 60 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: 'D1', pos: [0, 1, 1.0], state: 'idle' }],
    });

    // Tick 1: transitions idle -> chase, moves into steal range (<= 1.2m), steals 3 even while player invuln!
    const ev1 = engine.step(createDefaultInput());
    expect(ev1).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'drifter_steal',
      data: { drifter_id: 'D1', amount: 3, carried: 5 },
    });
    expect(engine.getSnapshot().drifters[0].state).toBe('flee');
    expect(engine.getSnapshot().drifters[0].stolen).toBe(3);

    // Tick 2: player triggers Pulse while fleeing drifter is still within 5m -> drifter_drop 3 motes!
    const pulseIn = createDefaultInput();
    pulseIn.pulse = true;
    const ev2 = engine.step(pulseIn);
    expect(ev2).toContainEqual({
      type: 'event',
      tick: 2,
      name: 'drifter_drop',
      data: { drifter_id: 'D1', amount: 3 },
    });
    expect(engine.getSnapshot().drifters[0].stolen).toBe(0);
    expect(engine.getSnapshot().motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
  });

  it('Bùa Gió (Charm): boosts speed to 7.2 m/s, zero dash cooldown for 600 ticks, respawns after 2700 ticks', () => {
    const engine = new GameEngine(107, 2, {
      player: { pos: [35, 0, 0] },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    });

    const ev1 = engine.step(createDefaultInput());
    expect(ev1).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'charm_picked',
      data: { charm_id: 'C1', charm_ticks: 600 },
    });
    expect(engine.getSnapshot().charms[0].available).toBe(false);

    // Move along +X on bridge for 60 ticks at 7.2 m/s -> +7.2m
    const moveIn = createDefaultInput();
    moveIn.move = [1, 0];
    for (let i = 0; i < 60; i++) engine.step(moveIn);
    expect(engine.getSnapshot().player.pos[0]).toBeCloseTo(42.2, 2);

    // Dash has 0 cooldown during charm
    const dashIn = createDefaultInput();
    dashIn.dash = true;
    engine.step(dashIn);
    expect(engine.getSnapshot().player.dash_cd_s).toBe(0);

    // Step remaining ticks to reach 2700 ticks after pickup -> charm respawns available=true
    const idle = createDefaultInput();
    for (let i = 0; i < 2639; i++) engine.step(idle);
    expect(engine.getSnapshot().charms[0].available).toBe(true);
    expect(engine.getSnapshot().charms[0].respawn_s).toBe(0);
  });

  it('Pause & Resume: freezes sim_tick, time_left_s, and timers while tick advances', () => {
    const engine = new GameEngine(108, 1, {
      random_motes: false,
      random_shades: false,
      time_left_s: 300,
    });

    // Run 10 ticks
    for (let i = 0; i < 10; i++) engine.step(createDefaultInput());
    const beforePause = engine.getSnapshot();
    expect(beforePause.tick).toBe(10);
    expect(beforePause.sim_tick).toBe(10);

    // Pause on tick 11 and stay paused for 20 ticks
    const pauseOn = createDefaultInput();
    pauseOn.pause = true;
    const evPause = engine.step(pauseOn);
    expect(evPause).toContainEqual({ type: 'event', tick: 11, name: 'paused', data: {} });

    const idle = createDefaultInput();
    for (let i = 0; i < 19; i++) engine.step(idle);
    const duringPause = engine.getSnapshot();
    expect(duringPause.state).toBe('paused');
    expect(duringPause.tick).toBe(30);
    expect(duringPause.sim_tick).toBe(10); // completely frozen
    expect(duringPause.time_left_s).toBe(beforePause.time_left_s);

    // Resume on tick 31
    const evResume = engine.step(pauseOn);
    expect(evResume).toContainEqual({ type: 'event', tick: 31, name: 'resumed', data: {} });
    expect(engine.getSnapshot().state).toBe('playing');
    expect(engine.getSnapshot().sim_tick).toBe(11);
  });

  it('Performance: full Night 3 (21,600 ticks) completes well within <= 30s budget', () => {
    const t0 = performance.now();
    const engine = new GameEngine(2026, 3);
    const recs = engine.runHeadless(undefined, 21600, 60);
    const elapsedMs = performance.now() - t0;
    expect(recs[recs.length - 1].type).toBe('end');
    expect(elapsedMs).toBeLessThan(30_000);
  });
});

