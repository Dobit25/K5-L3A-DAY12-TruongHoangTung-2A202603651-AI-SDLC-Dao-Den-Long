import {
  DEFAULT_TUNING,
  DT,
  GRAVITY,
  INITIAL_RANDOM_MOTES,
  INITIAL_RANDOM_SHADES,
  ISLAND_RADIUS,
  JUMP_VELOCITY,
  MAX_RANDOM_MOTES,
  MAX_RANDOM_SHADES,
  MOTE_RESPAWN_INTERVAL_TICKS,
  NIGHT1_LANTERNS,
  SAFE_RADIUS_EPSILON,
  SHADE_SPAWN_INTERVAL_TICKS,
  TICK_RATE,
} from './config.js';
import { DeterministicRng } from './prng.js';
import type {
  EndRecord,
  EventRecord,
  GameEventName,
  GameStateStatus,
  GameTuning,
  HeadlessRecord,
  InputFile,
  InputState,
  LanternState,
  MoteState,
  PlayerState,
  ScenarioFile,
  ShadeState,
  SnapshotRecord,
  Vec3,
} from './types.js';

export function round3(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 1000) / 1000;
  return r === 0 ? 0 : r;
}

function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function createDefaultInput(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
  };
}

export class GameEngine {
  readonly seed: number;
  readonly night: number;
  readonly tuning: GameTuning;

  private rng: DeterministicRng;
  private tickCount = 0;
  private simTick = 0;
  private status: GameStateStatus = 'playing';
  private initialDurationS: number;
  private timeLeftS: number;
  private score = 0;
  private playableRadius = ISLAND_RADIUS;

  private randomMotesEnabled = true;
  private randomShadesEnabled = true;
  private nextMoteNum = 1;
  private nextShadeNum = 1;

  private player: PlayerState;
  private lanterns: LanternState[];
  private shades: ShadeState[] = [];
  private motes: MoteState[] = [];
  private prevInput: InputState = createDefaultInput();

  constructor(
    seed: number,
    night = 1,
    scenario?: ScenarioFile,
    tuningOverride?: Partial<GameTuning>
  ) {
    if (night !== 1) {
      throw new Error(`Unsupported night ${night}; Phase 1 supports night 1 only.`);
    }
    this.seed = seed | 0;
    this.night = night;
    this.tuning = {
      ...DEFAULT_TUNING,
      ...tuningOverride,
      score: {
        ...DEFAULT_TUNING.score,
        ...(tuningOverride?.score ?? {}),
      },
    };
    this.rng = new DeterministicRng(this.seed);

    this.initialDurationS =
      scenario?.time_left_s !== undefined ? scenario.time_left_s : this.tuning.night1_duration_s;
    this.timeLeftS = this.initialDurationS;

    this.randomMotesEnabled = scenario?.random_motes ?? true;
    this.randomShadesEnabled = scenario?.random_shades ?? true;

    const startCarried = Math.min(
      scenario?.player?.carried ?? 0,
      this.tuning.carry_capacity
    );

    this.player = {
      pos: scenario?.player?.pos ? [...scenario.player.pos] : [0, 0, 0],
      vy: 0,
      flames: scenario?.player?.flames ?? this.tuning.flames,
      carried: startCarried,
      invuln_ticks: 0,
      pulse_cooldown_ticks: 0,
    };

    // Initialize Night 1 lanterns (L1..L5)
    this.lanterns = NIGHT1_LANTERNS.map((spec) => ({
      id: spec.id,
      pos: [...spec.pos] as Vec3,
      lit: false,
      deposited: 0,
    }));

    // Apply scenario lantern overrides (no events, no score added)
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const existing = this.lanterns.find((l) => l.id === override.id);
        if (existing) {
          if (override.pos) existing.pos = [...override.pos] as Vec3;
          if (override.deposited !== undefined) {
            existing.deposited = Math.min(override.deposited, this.tuning.lantern_cost);
          }
          if (override.lit !== undefined) {
            existing.lit = override.lit;
            if (override.lit && override.deposited === undefined) {
              existing.deposited = this.tuning.lantern_cost;
            }
          } else if (existing.deposited >= this.tuning.lantern_cost) {
            existing.lit = true;
          }
        }
      }
    }

    // Initialize motes
    if (scenario?.motes !== undefined) {
      const usedIds = new Set<string>();
      for (const item of scenario.motes) {
        if (!Array.isArray(item) && item.id) usedIds.add(item.id);
      }
      for (const item of scenario.motes) {
        if (Array.isArray(item)) {
          const id = this.allocMoteId(usedIds);
          this.motes.push({ id, pos: [item[0], 0, item[2]] });
        } else {
          const id = item.id ?? this.allocMoteId(usedIds);
          usedIds.add(id);
          this.motes.push({ id, pos: [item.pos[0], 0, item.pos[2]] });
        }
      }
    } else if (this.randomMotesEnabled) {
      for (let i = 0; i < INITIAL_RANDOM_MOTES; i++) {
        this.spawnRandomMote();
      }
    }

    // Initialize shades
    if (scenario?.shades !== undefined) {
      const usedIds = new Set<string>();
      for (const s of scenario.shades) {
        if (s.id) usedIds.add(s.id);
      }
      const stunTicks = Math.round(this.tuning.pulse_stun_s * TICK_RATE);
      for (const s of scenario.shades) {
        const id = s.id ?? this.allocShadeId(usedIds);
        usedIds.add(id);
        const isStunned = s.state === 'stunned';
        this.shades.push({
          id,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          state: isStunned ? 'stunned' : 'chase',
          stun_ticks: isStunned ? stunTicks : 0,
        });
      }
    } else if (this.randomShadesEnabled) {
      for (let i = 0; i < INITIAL_RANDOM_SHADES; i++) {
        this.spawnRandomShade(false);
      }
    }

    // Expand playable boundary dynamically if a scenario places entities outside default island radius
    let maxDist = ISLAND_RADIUS;
    const consider = (p: Vec3) => {
      const d = Math.hypot(p[0], p[2]);
      if (d + 20 > maxDist) maxDist = d + 20;
    };
    consider(this.player.pos);
    for (const l of this.lanterns) consider(l.pos);
    for (const m of this.motes) consider(m.pos);
    for (const s of this.shades) consider(s.pos);
    this.playableRadius = maxDist;
  }

  private allocMoteId(used?: Set<string>): string {
    while (true) {
      const id = `M${this.nextMoteNum++}`;
      if (!used?.has(id) && !this.motes.some((m) => m.id === id)) {
        used?.add(id);
        return id;
      }
    }
  }

  private allocShadeId(used?: Set<string>): string {
    while (true) {
      const id = `S${this.nextShadeNum++}`;
      if (!used?.has(id) && !this.shades.some((s) => s.id === id)) {
        used?.add(id);
        return id;
      }
    }
  }

  private spawnRandomMote(): MoteState {
    const id = this.allocMoteId();
    for (let attempt = 0; attempt < 25; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = Math.sqrt(this.rng.next()) * (ISLAND_RADIUS - 4);
      const pos: Vec3 = [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)];
      if (distXZ(pos, this.player.pos) < this.tuning.pickup_radius + 3.0) continue;
      if (this.lanterns.some((l) => distXZ(pos, l.pos) < 3.0)) continue;
      const mote: MoteState = { id, pos };
      this.motes.push(mote);
      return mote;
    }
    const fallback: MoteState = { id, pos: [round3(this.rng.range(-15, 15)), 0, round3(this.rng.range(-15, 15))] };
    this.motes.push(fallback);
    return fallback;
  }

  private spawnRandomShade(emitEvent: boolean, events?: EventRecord[], tick?: number): ShadeState {
    const id = this.allocShadeId();
    const safeR = this.tuning.safe_radius ?? 0;
    let pos: Vec3 = [ISLAND_RADIUS - 6, 0, 0];
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(24, ISLAND_RADIUS - 4);
      const candidate: Vec3 = [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)];
      if (distXZ(candidate, this.player.pos) < 12) continue;
      if (safeR > 0 && this.lanterns.some((l) => l.lit && distXZ(candidate, l.pos) <= safeR + SAFE_RADIUS_EPSILON)) {
        continue;
      }
      pos = candidate;
      break;
    }
    const shade: ShadeState = { id, pos, state: 'chase', stun_ticks: 0 };
    this.enforceSafeZonesForShade(shade);
    this.shades.push(shade);
    if (emitEvent && events && tick !== undefined) {
      events.push(this.makeEvent(tick, 'shade_spawned', { id }));
    }
    return shade;
  }

  private makeEvent(tick: number, name: GameEventName, data: Record<string, unknown>): EventRecord {
    return { type: 'event', tick, name, data };
  }

  private enforceSafeZonesForShade(shade: ShadeState): void {
    const safeR = this.tuning.safe_radius;
    if (safeR === null || safeR <= 0) return;

    const minAllowed = safeR + SAFE_RADIUS_EPSILON;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const lantern of this.lanterns) {
        if (!lantern.lit) continue;
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= safeR + SAFE_RADIUS_EPSILON * 0.5) {
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.pos[0] = lantern.pos[0] + nx * minAllowed;
          shade.pos[2] = lantern.pos[2] + nz * minAllowed;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  get tick(): number {
    return this.tickCount;
  }

  get state(): GameStateStatus {
    return this.status;
  }

  get currentScore(): number {
    return this.score;
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tickCount,
      sim_tick: this.simTick,
      state: this.status,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: roundVec3(this.player.pos),
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundVec3(s.pos),
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundVec3(m.pos),
      })),
    };
  }

  getRuntimeDebugInfo(): {
    invuln_s: number;
    pulse_cooldown_s: number;
    playable_radius: number;
  } {
    return {
      invuln_s: round3(this.player.invuln_ticks / TICK_RATE),
      pulse_cooldown_s: round3(this.player.pulse_cooldown_ticks / TICK_RATE),
      playable_radius: this.playableRadius,
    };
  }

  step(input: InputState): EventRecord[] {
    const events: EventRecord[] = [];
    if (this.status !== 'playing') {
      return events;
    }

    const nextTick = this.tickCount + 1;
    this.tickCount = nextTick;
    this.simTick = nextTick;

    // Edge-triggered actions (false -> true)
    const jumpTriggered = !this.prevInput.jump && input.jump;
    const interactTriggered = !this.prevInput.interact && input.interact;
    const pulseTriggered = !this.prevInput.pulse && input.pulse;

    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash,
    };

    // Update integer cooldown timers (zero floating-point drift)
    if (this.player.invuln_ticks > 0) {
      this.player.invuln_ticks -= 1;
    }
    if (this.player.pulse_cooldown_ticks > 0) {
      this.player.pulse_cooldown_ticks -= 1;
    }

    // 1. Player horizontal movement (camera-relative per Test Contract C)
    let mx = input.move[0];
    let mz = input.move[1];
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1) {
      mx /= mLen;
      mz /= mLen;
    }
    const theta = (input.cam_yaw_deg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const wx = mx * cosT + mz * sinT;
    const wz = -mx * sinT + mz * cosT;

    this.player.pos[0] += wx * this.tuning.player_speed * DT;
    this.player.pos[2] += wz * this.tuning.player_speed * DT;

    // Clamp to playable island boundary (fall_enabled: false)
    if (!this.tuning.fall_enabled) {
      const r = Math.hypot(this.player.pos[0], this.player.pos[2]);
      const maxR = this.playableRadius - 0.5;
      if (r > maxR) {
        const scale = maxR / r;
        this.player.pos[0] *= scale;
        this.player.pos[2] *= scale;
      }
    }

    // Jump vertical physics
    if (jumpTriggered && this.player.pos[1] <= 0) {
      this.player.vy = JUMP_VELOCITY;
    }
    if (this.player.pos[1] > 0 || this.player.vy > 0) {
      this.player.pos[1] += this.player.vy * DT;
      this.player.vy -= GRAVITY * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
      }
    }

    // Update remaining time for this step
    this.timeLeftS = Math.max(0, this.initialDurationS - nextTick / TICK_RATE);

    // 2. Auto-pickup motes within pickup_radius (XZ <= pickup_radius)
    const remainingMotes: MoteState[] = [];
    for (const mote of this.motes) {
      if (
        this.player.carried < this.tuning.carry_capacity &&
        distXZ(this.player.pos, mote.pos) <= this.tuning.pickup_radius
      ) {
        this.player.carried += 1;
        this.score += this.tuning.score.per_mote;
        events.push(this.makeEvent(nextTick, 'mote_picked', { carried: this.player.carried }));
      } else {
        remainingMotes.push(mote);
      }
    }
    this.motes = remainingMotes;

    // 3. Interact -> deposit into nearest unlit lantern within interact_radius
    if (interactTriggered && this.player.carried > 0) {
      let target: LanternState | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= this.tuning.interact_radius) {
          if (d < bestDist || (d === bestDist && target && lantern.id < target.id)) {
            bestDist = d;
            target = lantern;
          }
        }
      }

      if (target) {
        const needed = this.tuning.lantern_cost - target.deposited;
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          target.deposited += amount;
          events.push(
            this.makeEvent(nextTick, 'deposit', {
              lantern_id: target.id,
              amount,
              deposited: target.deposited,
            })
          );

          if (target.deposited >= this.tuning.lantern_cost) {
            target.lit = true;
            this.score += this.tuning.score.per_lantern;
            events.push(this.makeEvent(nextTick, 'lantern_lit', { lantern_id: target.id }));
            for (const shade of this.shades) {
              this.enforceSafeZonesForShade(shade);
            }
          }
        }
      }
    }

    // 4. Check win condition (all lanterns lit)
    if (this.lanterns.every((l) => l.lit)) {
      this.status = 'won';
      const winBonus =
        Math.floor(this.timeLeftS) * this.tuning.score.per_second_left +
        this.player.flames * this.tuning.score.per_flame_left;
      this.score += winBonus;
      events.push(
        this.makeEvent(nextTick, 'game_over', {
          result: 'won',
          reason: 'all_lit',
        })
      );
      return events;
    }

    // 5. Pulse action (costs pulse_cost carried motes, subject to cooldown)
    const stunnedThisTick = new Set<string>();
    if (
      pulseTriggered &&
      this.player.carried >= this.tuning.pulse_cost &&
      this.player.pulse_cooldown_ticks <= 0
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulse_cooldown_ticks = Math.round(this.tuning.pulse_cooldown_s * TICK_RATE);
      const stunTicks = Math.round(this.tuning.pulse_stun_s * TICK_RATE);
      const stunnedIds: string[] = [];

      for (const shade of this.shades) {
        const d = distXZ(this.player.pos, shade.pos);
        if (d <= this.tuning.pulse_radius) {
          shade.state = 'stunned';
          shade.stun_ticks = stunTicks;
          stunnedThisTick.add(shade.id);
          const dx = shade.pos[0] - this.player.pos[0];
          const dz = shade.pos[2] - this.player.pos[2];
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.pos[0] += nx * this.tuning.pulse_push_m;
          shade.pos[2] += nz * this.tuning.pulse_push_m;
          this.enforceSafeZonesForShade(shade);
          this.score += this.tuning.score.per_stun;
          stunnedIds.push(shade.id);
        }
      }

      events.push(this.makeEvent(nextTick, 'pulse', { stunned_ids: stunnedIds }));
    }

    // 6. Periodic random spawning (disabled when random_* is false)
    if (
      this.randomMotesEnabled &&
      nextTick % MOTE_RESPAWN_INTERVAL_TICKS === 0 &&
      this.motes.length < MAX_RANDOM_MOTES
    ) {
      this.spawnRandomMote();
    }

    if (
      this.randomShadesEnabled &&
      nextTick % SHADE_SPAWN_INTERVAL_TICKS === 0 &&
      this.shades.length < MAX_RANDOM_SHADES
    ) {
      this.spawnRandomShade(true, events, nextTick);
    }

    // 7. Shade AI update + safe_radius enforcement
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        if (!stunnedThisTick.has(shade.id)) {
          shade.stun_ticks = Math.max(0, shade.stun_ticks - 1);
          if (shade.stun_ticks <= 0) {
            shade.state = 'chase';
          }
        }
        this.enforceSafeZonesForShade(shade);
        continue;
      }

      // Chase player on XZ plane
      const dx = this.player.pos[0] - shade.pos[0];
      const dz = this.player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      const stepDist = this.tuning.shade_speed * DT;
      if (d > 1e-6) {
        const moveDist = Math.min(d, stepDist);
        shade.pos[0] += (dx / d) * moveDist;
        shade.pos[2] += (dz / d) * moveDist;
      }
      this.enforceSafeZonesForShade(shade);
    }

    // 8. Shade collision with player (only non-stunned shades while player not invulnerable)
    if (this.player.invuln_ticks <= 0) {
      const hitShade = this.shades.find(
        (s) =>
          s.state !== 'stunned' &&
          distXZ(this.player.pos, s.pos) <= this.tuning.shade_hit_radius
      );
      if (hitShade) {
        const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.invuln_ticks = Math.round(this.tuning.invuln_s * TICK_RATE);

        events.push(
          this.makeEvent(nextTick, 'player_hit', {
            by: 'shade',
            flames: this.player.flames,
            dropped,
          })
        );

        if (this.player.flames <= 0) {
          this.status = 'lost';
          events.push(
            this.makeEvent(nextTick, 'game_over', {
              result: 'lost',
              reason: 'no_flames',
            })
          );
          return events;
        }
      }
    }

    // 9. Dawn timeout check
    if (this.timeLeftS <= 0) {
      this.timeLeftS = 0;
      this.status = 'lost';
      events.push(
        this.makeEvent(nextTick, 'game_over', {
          result: 'lost',
          reason: 'dawn',
        })
      );
    }

    return events;
  }

  runHeadless(
    inputFile: InputFile | undefined,
    maxTicks: number,
    snapshotEvery = 10
  ): HeadlessRecord[] {
    const records: HeadlessRecord[] = [];
    const frames = inputFile?.frames ?? [];
    let frameIdx = 0;
    const currentInput = createDefaultInput();

    // Tick 0 snapshot (after scenario setup, before any input step)
    records.push(this.getSnapshot());

    for (let k = 0; k < maxTicks; k++) {
      if (this.status !== 'playing') break;

      while (frameIdx < frames.length && frames[frameIdx].tick === k) {
        const f = frames[frameIdx];
        if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
        if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
        if (f.jump !== undefined) currentInput.jump = f.jump;
        if (f.interact !== undefined) currentInput.interact = f.interact;
        if (f.pulse !== undefined) currentInput.pulse = f.pulse;
        if (f.dash !== undefined) currentInput.dash = f.dash;
        frameIdx++;
      }

      const events = this.step(currentInput);
      for (const ev of events) {
        records.push(ev);
      }

      if (this.tickCount % snapshotEvery === 0) {
        records.push(this.getSnapshot());
      }
    }

    const endRecord: EndRecord = {
      type: 'end',
      ticks: this.tickCount,
      state: this.status,
      score: this.score,
    };
    records.push(endRecord);
    return records;
  }
}

