import {
  CAPACITY_INCREMENT_PER_LIGHT,
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  DEFAULT_TUNING,
  DRIFTER_CHASE_SPEED,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_FLEE_SPEED,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX_ACTIVE,
  DRIFTER_MAX_STEAL,
  DRIFTER_MIN_CARRIED,
  DRIFTER_PULSE_FLEE_TICKS,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_STEAL_RADIUS,
  DROPPED_MOTE_RING_MAX,
  DROPPED_MOTE_RING_MIN,
  DROPPED_MOTE_TTL_TICKS,
  DT,
  FALL_RESPAWN_TICKS,
  FALL_THRESHOLD_Y,
  FUEL_DECAY_PER_TICK_60THS,
  FUEL_DRAIN_EVENT_INTERVAL_TICKS,
  FUEL_DRAIN_PER_TICK_60THS,
  FUEL_LOW_THRESHOLD_60THS,
  FUEL_MAX_60THS,
  FUEL_PER_MOTE_60THS,
  FUEL_SCALE,
  GRAVITY,
  INITIAL_RANDOM_MOTES,
  INVULN_TICKS,
  JUMP_VELOCITY,
  MAX_RANDOM_MOTES,
  MOTE_SPAWN_INTERVAL_TICKS,
  PICKUP_MAX_DY,
  PULSE_CENTER_Y_OFFSET,
  PULSE_COOLDOWN_TICKS,
  PULSE_PUSH_TICKS,
  PULSE_STUN_TICKS,
  SAFE_RADIUS_EPSILON,
  SCORE_DAWN_LANTERN_BASE,
  SCORE_RELIGHT,
  SCORE_STUN_DRAINING,
  SHADE_ABANDON_RADIUS,
  SHADE_DETECT_RADIUS,
  SHADE_DRAIN_AGGRO_RADIUS,
  SHADE_DRAIN_RADIUS,
  SHADE_HIT_MAX_DY,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  SHADE_SAFE_EJECT_TICKS,
  SHADE_SPAWN_FIRST_TICK,
  SHADE_SPAWN_MIN_PLAYER_DIST,
  TICK_RATE,
  WIND_DURATION_TICKS,
  WIND_INTERVAL_TICKS,
  WIND_PUSH_SPEED,
  WIND_WARNING_TICKS,
} from './config.js';
import {
  getHighestGroundY,
  getNightMap,
  getSupportY,
  isPointOnGround,
  type NightMapSpec,
  resolveObstacleAndCliff,
} from './maps.js';
import { DeterministicRng } from './prng.js';
import type {
  CharmState,
  DrifterState,
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
  NightNumber,
  PlayerState,
  ScenarioFile,
  ShadeState,
  SnapshotRecord,
  Vec3,
  WindState,
} from './types.js';

export function round3(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 1000) / 1000;
  return r === 0 ? 0 : r;
}

export function round1(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 10) / 10;
  return r === 0 ? 0 : r;
}

function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function cmpId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function createDefaultInput(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
}

export class GameEngine {
  readonly seed: number;
  readonly night: NightNumber;
  readonly map: NightMapSpec;
  readonly tuning: GameTuning;

  private rng: DeterministicRng;
  private tickCount = 0;
  private simTick = 0;
  private status: GameStateStatus = 'playing';
  private initialDurationS: number;
  private timeLeftS: number;
  private score = 0;
  private nightStartEmitted = false;

  private randomMotesEnabled: boolean;
  private randomShadesEnabled: boolean;
  private randomDriftersEnabled: boolean;
  private windEnabled: boolean;

  private nextMoteNum = 1;
  private nextShadeNum = 1;
  private nextDrifterNum = 1;

  private player: PlayerState;
  private lanterns: LanternState[];
  private shades: ShadeState[] = [];
  private motes: MoteState[] = [];
  private drifters: DrifterState[] = [];
  private charms: CharmState[] = [];
  private wind: WindState = { active: false, dir_deg: 0, warning: false };
  private windTicksLeft = 0;
  private nextWindDirDeg = 0;
  private prevInput: InputState = createDefaultInput();

  constructor(
    seed: number,
    night: number = 1,
    scenario?: ScenarioFile,
    tuningOverride?: Partial<GameTuning>
  ) {
    if (night !== 1 && night !== 2 && night !== 3) {
      throw new Error(`Unsupported night ${night}; expected 1, 2, or 3.`);
    }
    this.seed = seed | 0;
    this.night = night;
    this.map = getNightMap(night);
    this.tuning = {
      ...DEFAULT_TUNING,
      ...tuningOverride,
      score: {
        ...DEFAULT_TUNING.score,
        ...(tuningOverride?.score ?? {}),
      },
    };
    this.rng = new DeterministicRng(this.seed);

    const defaultDur =
      night === 1
        ? this.tuning.night1_duration_s
        : night === 2
          ? this.tuning.night2_duration_s
          : this.tuning.night3_duration_s;

    this.initialDurationS =
      scenario?.time_left_s !== undefined ? scenario.time_left_s : defaultDur;
    this.timeLeftS = this.initialDurationS;

    this.randomMotesEnabled = scenario?.random_motes ?? true;
    this.randomShadesEnabled = scenario?.random_shades ?? true;
    this.randomDriftersEnabled = scenario?.random_drifters ?? this.map.driftersEnabled;
    this.windEnabled = scenario?.wind_enabled ?? this.map.windEnabled;

    const successfulLights = scenario?.player?.successful_lights ?? 0;
    const startCap = Math.min(
      this.tuning.capacity_max,
      this.tuning.carry_capacity + CAPACITY_INCREMENT_PER_LIGHT * successfulLights
    );

    const startPos: Vec3 = scenario?.player?.pos
      ? [...scenario.player.pos]
      : [...this.map.spawnPos];
    const startSupport = getSupportY(this.night, startPos[0], startPos[2], startPos[1]);
    const grounded = startSupport !== null && Math.abs(startPos[1] - startSupport) <= 0.05;

    this.player = {
      pos: startPos,
      vel: [0, 0, 0],
      grounded,
      facing: [0, 1],
      flames: scenario?.player?.flames ?? this.tuning.flames,
      carried: Math.min(scenario?.player?.carried ?? 0, startCap),
      successful_lights: successfulLights,
      invuln_ticks: scenario?.player?.invuln_ticks ?? 0,
      dash_cd_ticks: scenario?.player?.dash_cd_ticks ?? 0,
      dash_ticks: 0,
      dash_dir: [0, 1],
      pulse_cd_ticks: scenario?.player?.pulse_cd_ticks ?? 0,
      charm_ticks: scenario?.player?.charm_ticks ?? 0,
      respawn_ticks: 0,
      launch_active: false,
      launch_vel: [0, 0],
    };

    // Initialize map lanterns
    this.lanterns = this.map.lanterns.map((spec) => ({
      id: spec.id,
      pos: [...spec.pos] as Vec3,
      lit: false,
      deposited: 0,
      fuel_60ths: 0,
      ever_lit: false,
      relit_count: 0,
    }));

    // Apply scenario lantern overrides (no events, no score, does not increment successful_lights)
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const existing = this.lanterns.find((l) => l.id === override.id);
        if (existing) {
          if (override.pos) existing.pos = [...override.pos] as Vec3;
          if (override.ever_lit !== undefined) existing.ever_lit = override.ever_lit;
          const reqCost = existing.ever_lit ? this.tuning.relight_cost : this.tuning.lantern_cost;
          if (override.deposited !== undefined) {
            existing.deposited = Math.min(override.deposited, reqCost);
          }
          if (override.lit !== undefined) {
            existing.lit = override.lit;
            if (override.lit) {
              existing.ever_lit = override.ever_lit ?? true;
              existing.fuel_60ths =
                override.fuel !== undefined
                  ? Math.round(override.fuel * FUEL_SCALE)
                  : FUEL_MAX_60THS;
              if (override.deposited === undefined) {
                existing.deposited = this.tuning.lantern_cost;
              }
            } else {
              existing.fuel_60ths = 0;
            }
          } else if (override.fuel !== undefined && override.fuel > 0) {
            existing.lit = true;
            existing.ever_lit = override.ever_lit ?? true;
            existing.fuel_60ths = Math.round(override.fuel * FUEL_SCALE);
          } else if (existing.deposited >= reqCost) {
            existing.lit = true;
            existing.ever_lit = true;
            existing.fuel_60ths = FUEL_MAX_60THS;
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
          this.motes.push({
            id,
            pos: [item[0], item[1], item[2]],
            kind: 'random',
            ttl_ticks: null,
            pickup_delay_ticks: 0,
          });
        } else {
          const id = item.id ?? this.allocMoteId(usedIds);
          usedIds.add(id);
          const kind = item.kind ?? 'random';
          const ttl_ticks =
            item.ttl_ticks !== undefined
              ? item.ttl_ticks
              : kind === 'dropped'
                ? DROPPED_MOTE_TTL_TICKS
                : null;
          this.motes.push({
            id,
            pos: [item.pos[0], item.pos[1], item.pos[2]],
            kind,
            ttl_ticks,
            pickup_delay_ticks: 0,
          });
        }
      }
    } else if (this.randomMotesEnabled) {
      this.spawnInitialMotes();
    }

    // Initialize shades
    if (scenario?.shades !== undefined) {
      const usedIds = new Set<string>();
      for (const s of scenario.shades) {
        if (s.id) usedIds.add(s.id);
      }
      for (const s of scenario.shades) {
        const id = s.id ?? this.allocShadeId(usedIds);
        usedIds.add(id);
        const state = s.state ?? 'wander';
        const defaultTicks =
          state === 'stunned'
            ? PULSE_STUN_TICKS
            : state === 'recoil'
              ? SHADE_RECOIL_TICKS
              : state === 'spawning'
                ? 30
                : 0;
        let targetLanternId = s.target_lantern_id ?? null;
        if (state === 'drain' && !targetLanternId) {
          // Infer nearest lit weak lantern if scenario placed shade in drain state without explicit target
          const nearest = this.findNearestWeakLitLantern(s.pos);
          targetLanternId = nearest?.id ?? null;
        }
        this.shades.push({
          id,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          state,
          state_ticks_left: s.state_ticks_left ?? defaultTicks,
          push_ticks: 0,
          push_dir: [1, 0],
          recoil_ticks: state === 'recoil' ? (s.state_ticks_left ?? SHADE_RECOIL_TICKS) : 0,
          recoil_dir: [1, 0],
          wander_angle: this.rng.range(0, Math.PI * 2),
          eject_ticks: 0,
          eject_lantern_id: null,
          target_lantern_id: targetLanternId,
          drain_ticks: 0,
        });
      }
    }

    // Initialize drifters
    if (scenario?.drifters !== undefined) {
      const usedIds = new Set<string>();
      for (const d of scenario.drifters) {
        if (d.id) usedIds.add(d.id);
      }
      for (const d of scenario.drifters) {
        const id = d.id ?? this.allocDrifterId(usedIds);
        usedIds.add(id);
        const state = d.state ?? 'idle';
        const stolen = d.stolen ?? 0;
        this.drifters.push({
          id,
          pos: [d.pos[0], d.pos[1], d.pos[2]],
          state,
          stolen,
          has_stolen: stolen > 0 || state === 'flee',
          flee_ticks: d.flee_ticks ?? (state === 'flee' ? DRIFTER_FLEE_TICKS : 0),
          orbit_angle: this.rng.range(0, Math.PI * 2),
        });
      }
    }

    // Initialize charms
    if (scenario?.charms !== undefined) {
      for (const c of scenario.charms) {
        const defaultSpec = this.map.charms.find((mc) => mc.id === c.id);
        const pos: Vec3 = c.pos ? [...c.pos] : defaultSpec ? [...defaultSpec.pos] : [0, 0, 0];
        this.charms.push({
          id: c.id,
          pos,
          available: c.available ?? true,
          respawn_ticks: c.respawn_ticks ?? (c.available === false ? CHARM_RESPAWN_TICKS : 0),
        });
      }
    } else {
      this.charms = this.map.charms.map((c) => ({
        id: c.id,
        pos: [...c.pos] as Vec3,
        available: true,
        respawn_ticks: 0,
      }));
    }

    this.nextWindDirDeg = round3(this.rng.range(0, 360));
  }

  get playerCapacity(): number {
    return Math.min(
      this.tuning.capacity_max,
      this.tuning.carry_capacity + CAPACITY_INCREMENT_PER_LIGHT * this.player.successful_lights
    );
  }

  private hasActiveSafeZone(lantern: LanternState): boolean {
    return lantern.lit && lantern.fuel_60ths >= FUEL_LOW_THRESHOLD_60THS;
  }

  private findNearestWeakLitLantern(from: Vec3): LanternState | null {
    let best: LanternState | null = null;
    let bestDist = Infinity;
    for (const l of this.lanterns) {
      if (!l.lit || l.fuel_60ths >= FUEL_LOW_THRESHOLD_60THS) continue;
      const d = distXZ(from, l.pos);
      if (d < bestDist || (d === bestDist && best && cmpId(l.id, best.id) < 0)) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  private findNearestUnlitLantern(from: Vec3): LanternState | null {
    let best: LanternState | null = null;
    let bestDist = Infinity;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = distXZ(from, l.pos);
      if (d < bestDist || (d === bestDist && best && cmpId(l.id, best.id) < 0)) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  private triggerSafeZoneEjectionForLantern(lantern: LanternState): void {
    const safeR = this.tuning.safe_radius ?? 0;
    if (safeR <= 0) return;
    for (const shade of this.shades) {
      if (distXZ(shade.pos, lantern.pos) <= safeR + SAFE_RADIUS_EPSILON) {
        if (shade.state === 'drain') {
          shade.state = 'wander';
          shade.target_lantern_id = null;
          shade.drain_ticks = 0;
        }
        shade.eject_ticks = SHADE_SAFE_EJECT_TICKS;
        shade.eject_lantern_id = lantern.id;
      }
    }
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

  private allocDrifterId(used?: Set<string>): string {
    while (true) {
      const id = `D${this.nextDrifterNum++}`;
      if (!used?.has(id) && !this.drifters.some((d) => d.id === id)) {
        used?.add(id);
        return id;
      }
    }
  }

  private spawnInitialMotes(): void {
    const indices = this.map.motePoints.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    const count = Math.min(INITIAL_RANDOM_MOTES, indices.length);
    for (let i = 0; i < count; i++) {
      const pt = this.map.motePoints[indices[i]];
      this.motes.push({
        id: this.allocMoteId(),
        pos: [pt[0], pt[1], pt[2]],
        kind: 'random',
        ttl_ticks: null,
        pickup_delay_ticks: 0,
      });
    }
  }

  private spawnScheduledMote(): void {
    if (this.motes.length >= MAX_RANDOM_MOTES) return;
    const freePoints = this.map.motePoints.filter(
      (pt) => !this.motes.some((m) => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 1.0)
    );
    if (freePoints.length === 0) return;
    const chosen = freePoints[Math.floor(this.rng.next() * freePoints.length)];
    this.motes.push({
      id: this.allocMoteId(),
      pos: [chosen[0], chosen[1], chosen[2]],
      kind: 'random',
      ttl_ticks: null,
      pickup_delay_ticks: 1,
    });
  }

  private spawnScheduledShade(events: EventRecord[], tick: number): boolean {
    if (this.shades.length >= this.map.shadeMaxCount) return false;
    const safeR = this.tuning.safe_radius ?? 0;
    const validPoints = this.map.shadePoints.filter((pt) => {
      if (distXZ(pt, this.player.pos) < SHADE_SPAWN_MIN_PLAYER_DIST) return false;
      if (
        safeR > 0 &&
        this.lanterns.some(
          (l) => this.hasActiveSafeZone(l) && distXZ(pt, l.pos) <= safeR + SAFE_RADIUS_EPSILON
        )
      ) {
        return false;
      }
      if (this.shades.some((s) => distXZ(s.pos, pt) < 1.0)) return false;
      return true;
    });
    if (validPoints.length === 0) return false;

    const chosen = validPoints[Math.floor(this.rng.next() * validPoints.length)];
    const id = this.allocShadeId();
    this.shades.push({
      id,
      pos: [chosen[0], chosen[1], chosen[2]],
      state: 'spawning',
      state_ticks_left: 30,
      push_ticks: 0,
      push_dir: [1, 0],
      recoil_ticks: 0,
      recoil_dir: [1, 0],
      wander_angle: this.rng.range(0, Math.PI * 2),
      eject_ticks: 0,
      eject_lantern_id: null,
      target_lantern_id: null,
      drain_ticks: 0,
    });
    events.push(this.makeEvent(tick, 'shade_spawned', { id }));
    return true;
  }

  private spawnScheduledDrifter(): void {
    const activeCount = this.drifters.filter((d) => d.state !== 'removed').length;
    if (activeCount >= DRIFTER_MAX_ACTIVE) return;
    const pts = this.map.shadePoints;
    if (pts.length === 0) return;
    const chosen = pts[Math.floor(this.rng.next() * pts.length)];
    const id = this.allocDrifterId();
    this.drifters.push({
      id,
      pos: [chosen[0], chosen[1] + 1.0, chosen[2]],
      state: 'idle',
      stolen: 0,
      has_stolen: false,
      flee_ticks: 0,
      orbit_angle: this.rng.range(0, Math.PI * 2),
    });
  }

  private makeEvent(tick: number, name: GameEventName, data: Record<string, unknown>): EventRecord {
    return { type: 'event', tick, name, data };
  }

  private spawnDroppedMotes(origin: Vec3, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(DROPPED_MOTE_RING_MIN, DROPPED_MOTE_RING_MAX);
      let mx = origin[0] + Math.cos(angle) * radius;
      let mz = origin[2] + Math.sin(angle) * radius;
      let my = origin[1];
      const ground = getHighestGroundY(this.night, mx, mz);
      if (ground !== null) {
        my = ground;
      } else {
        mx = origin[0];
        mz = origin[2];
        my = getHighestGroundY(this.night, mx, mz) ?? origin[1];
      }
      this.motes.push({
        id: this.allocMoteId(),
        pos: [round3(mx), round3(my), round3(mz)],
        kind: 'dropped',
        ttl_ticks: DROPPED_MOTE_TTL_TICKS,
        pickup_delay_ticks: 1,
      });
    }
  }

  private stepSafeZoneEjection(shade: ShadeState): void {
    const safeR = this.tuning.safe_radius;
    if (safeR === null || safeR <= 0 || shade.eject_ticks <= 0 || !shade.eject_lantern_id) {
      return;
    }
    const lantern = this.lanterns.find((l) => l.id === shade.eject_lantern_id);
    if (lantern && this.hasActiveSafeZone(lantern)) {
      const dx = shade.pos[0] - lantern.pos[0];
      const dz = shade.pos[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      const target = safeR + SAFE_RADIUS_EPSILON;
      if (d < target) {
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        const step = (target - d) / shade.eject_ticks;
        shade.pos[0] += nx * step;
        shade.pos[2] += nz * step;
      }
      shade.eject_ticks -= 1;
      if (shade.eject_ticks <= 0) {
        const fdx = shade.pos[0] - lantern.pos[0];
        const fdz = shade.pos[2] - lantern.pos[2];
        const fd = Math.hypot(fdx, fdz);
        if (fd < target) {
          const nx = fd > 1e-6 ? fdx / fd : 1;
          const nz = fd > 1e-6 ? fdz / fd : 0;
          shade.pos[0] = lantern.pos[0] + nx * target;
          shade.pos[2] = lantern.pos[2] + nz * target;
        }
        shade.eject_lantern_id = null;
      }
    } else {
      shade.eject_ticks = 0;
      shade.eject_lantern_id = null;
    }
  }

  private enforceSafeZonesForShade(shade: ShadeState): void {
    const safeR = this.tuning.safe_radius;
    if (safeR === null || safeR <= 0) return;

    const minAllowed = safeR + SAFE_RADIUS_EPSILON;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const lantern of this.lanterns) {
        if (!this.hasActiveSafeZone(lantern)) continue;
        if (shade.eject_ticks > 0 && shade.eject_lantern_id === lantern.id) continue;
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < minAllowed - 1e-6) {
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

  get sim_tick(): number {
    return this.simTick;
  }

  get state(): GameStateStatus {
    return this.status;
  }

  get currentScore(): number {
    return this.score;
  }

  getWindWarning(): boolean {
    return this.wind.warning;
  }

  getRequiredLanternsToWin(): number {
    return Math.ceil(this.tuning.win_ratio * this.lanterns.length);
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tickCount,
      sim_tick: this.simTick,
      night: this.night,
      state: this.status,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dir_deg),
      },
      player: {
        pos: roundVec3(this.player.pos),
        vel: roundVec3(this.player.vel),
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.playerCapacity,
        invuln: this.player.invuln_ticks > 0,
        dash_cd_s: round3(this.player.dash_cd_ticks / TICK_RATE),
        pulse_cd_s: round3(this.player.pulse_cd_ticks / TICK_RATE),
        charm_s: round3(this.player.charm_ticks / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuel_60ths / FUEL_SCALE) : 0,
        ever_lit: l.ever_lit,
        relit_count: l.relit_count,
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
        kind: m.kind,
        ttl_s: m.ttl_ticks === null ? null : round3(m.ttl_ticks / TICK_RATE),
      })),
      drifters: this.drifters
        .filter((d) => d.state !== 'removed')
        .map((d) => ({
          id: d.id,
          pos: roundVec3(d.pos),
          state: d.state,
          stolen: d.stolen,
        })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawn_ticks / TICK_RATE),
      })),
    };
  }

  getCharmPositions(): Array<{ id: string; pos: Vec3; available: boolean }> {
    return this.charms.map((c) => ({ id: c.id, pos: [...c.pos] as Vec3, available: c.available }));
  }

  /**
   * Executes one 60Hz tick following Ticket-02 & Ticket-03 mandatory order.
   */
  step(input: InputState): EventRecord[] {
    const events: EventRecord[] = [];
    if (this.status === 'won' || this.status === 'lost') {
      return events;
    }

    const nextTick = this.tickCount + 1;
    this.tickCount = nextTick;

    // ─── STEP 1: Read input & handle pause FIRST ───
    const pauseTriggered = !this.prevInput.pause && input.pause;
    const jumpTriggered = !this.prevInput.jump && input.jump;
    const interactTriggered = !this.prevInput.interact && input.interact;
    const pulseTriggered = !this.prevInput.pulse && input.pulse;
    const dashTriggered = !this.prevInput.dash && input.dash;

    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash,
      pause: input.pause,
    };

    if (pauseTriggered) {
      if (this.status === 'playing') {
        this.status = 'paused';
        events.push(this.makeEvent(nextTick, 'paused', {}));
        return events;
      }
      if (this.status === 'paused') {
        this.status = 'playing';
        events.push(this.makeEvent(nextTick, 'resumed', {}));
      }
    } else if (this.status === 'paused') {
      return events;
    }

    if (!this.nightStartEmitted) {
      this.nightStartEmitted = true;
      events.push(this.makeEvent(nextTick, 'night_start', { night: this.night }));
    }

    // ─── STEP 2: Decrement timers + lantern fuel decay/drain ───
    this.simTick += 1;
    this.timeLeftS = Math.max(0, this.initialDurationS - this.simTick / TICK_RATE);

    if (this.player.invuln_ticks > 0) this.player.invuln_ticks -= 1;
    if (this.player.dash_cd_ticks > 0) this.player.dash_cd_ticks -= 1;
    if (this.player.pulse_cd_ticks > 0) this.player.pulse_cd_ticks -= 1;
    if (this.player.charm_ticks > 0) this.player.charm_ticks -= 1;

    if (this.player.respawn_ticks > 0) {
      this.player.respawn_ticks -= 1;
      if (this.player.respawn_ticks === 0) {
        this.player.pos = [...this.map.spawnPos];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.facing = [0, 1];
        this.player.launch_active = false;
        this.player.dash_ticks = 0;
        this.player.invuln_ticks = INVULN_TICKS;
      }
    }

    // Shade state timers
    for (const shade of this.shades) {
      if (shade.state_ticks_left > 0) {
        shade.state_ticks_left -= 1;
        if (shade.state_ticks_left === 0) {
          if (shade.state === 'spawning' || shade.state === 'stunned' || shade.state === 'recoil') {
            shade.state = 'wander';
          }
        }
      }
    }

    // Drifter flee timers
    for (const drifter of this.drifters) {
      if (drifter.state === 'flee' && drifter.flee_ticks > 0) {
        drifter.flee_ticks -= 1;
        if (drifter.flee_ticks === 0) {
          drifter.state = 'removed';
        }
      }
    }

    // Dropped motes TTL & pickup delay
    const liveMotes: MoteState[] = [];
    for (const m of this.motes) {
      if (m.pickup_delay_ticks > 0) m.pickup_delay_ticks -= 1;
      if (m.kind === 'dropped' && m.ttl_ticks !== null) {
        m.ttl_ticks -= 1;
        if (m.ttl_ticks <= 0) continue;
      }
      liveMotes.push(m);
    }
    this.motes = liveMotes;

    // Charm respawn timers
    for (const c of this.charms) {
      if (!c.available && c.respawn_ticks > 0) {
        c.respawn_ticks -= 1;
        if (c.respawn_ticks === 0) {
          c.available = true;
        }
      }
    }

    // Lantern fuel decay (1/60 per tick) + draining shades (5/60 per tick each, stacked)
    const drainingShades = [...this.shades]
      .filter((s) => s.state === 'drain' && s.target_lantern_id !== null)
      .sort((a, b) => cmpId(a.id, b.id));

    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      lantern.fuel_60ths -= FUEL_DECAY_PER_TICK_60THS;
      for (const shade of drainingShades) {
        if (
          shade.target_lantern_id === lantern.id &&
          lantern.fuel_60ths < FUEL_LOW_THRESHOLD_60THS &&
          distXZ(shade.pos, lantern.pos) <= SHADE_DRAIN_RADIUS
        ) {
          lantern.fuel_60ths -= FUEL_DRAIN_PER_TICK_60THS;
          shade.drain_ticks += 1;
          if (shade.drain_ticks % FUEL_DRAIN_EVENT_INTERVAL_TICKS === 0) {
            events.push(
              this.makeEvent(nextTick, 'fuel_drain', {
                lantern_id: lantern.id,
                shade_id: shade.id,
                fuel: round1(Math.max(0, lantern.fuel_60ths) / FUEL_SCALE),
              })
            );
          }
        }
      }
    }

    // Immediately after Step 2: any lit lantern with fuel <= 0 extinguishes -> lantern_out
    // and breaks any shade's drain state immediately (so Step 7 Pulse won't mis-score +15)
    for (const lantern of this.lanterns) {
      if (lantern.lit && lantern.fuel_60ths <= 0) {
        lantern.lit = false;
        lantern.fuel_60ths = 0;
        lantern.deposited = 0;
        lantern.ever_lit = true;
        for (const shade of this.shades) {
          if (shade.state === 'drain' && shade.target_lantern_id === lantern.id) {
            shade.state = 'wander';
            shade.target_lantern_id = null;
            shade.drain_ticks = 0;
          }
        }
        events.push(this.makeEvent(nextTick, 'lantern_out', { lantern_id: lantern.id }));
      }
    }

    // Night 3 Wind cycle
    if (this.windEnabled) {
      const cyclePos = this.simTick % WIND_INTERVAL_TICKS;
      if (this.simTick >= WIND_INTERVAL_TICKS && cyclePos === 0) {
        this.wind.active = true;
        this.wind.warning = false;
        this.wind.dir_deg = this.nextWindDirDeg;
        this.windTicksLeft = WIND_DURATION_TICKS;
        this.nextWindDirDeg = round3(this.rng.range(0, 360));
      } else if (this.wind.active) {
        this.windTicksLeft -= 1;
        if (this.windTicksLeft <= 0) {
          this.wind.active = false;
        }
      }
      this.wind.warning =
        !this.wind.active &&
        cyclePos >= WIND_INTERVAL_TICKS - WIND_WARNING_TICKS &&
        cyclePos < WIND_INTERVAL_TICKS;
    } else {
      this.wind.active = false;
      this.wind.warning = false;
    }

    // ─── STEP 3: Move Mây (jump, dash, jump pads, wind) & check fall ───
    if (this.player.respawn_ticks === 0) {
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
      const wLen = Math.hypot(wx, wz);
      if (wLen > 1e-6) {
        this.player.facing = [wx / wLen, wz / wLen];
      }

      const canDash =
        dashTriggered &&
        this.player.dash_ticks === 0 &&
        (this.player.charm_ticks > 0 || this.player.dash_cd_ticks === 0);
      if (canDash) {
        this.player.dash_ticks = DASH_TICKS;
        this.player.dash_dir = wLen > 1e-6 ? [wx / wLen, wz / wLen] : [...this.player.facing];
        this.player.dash_cd_ticks = this.player.charm_ticks > 0 ? 0 : DASH_COOLDOWN_TICKS;
        this.player.launch_active = false;
        this.player.vel[1] = 0;
        events.push(this.makeEvent(nextTick, 'dash', {}));
      }

      const dashingThisTick = this.player.dash_ticks > 0;
      if (dashingThisTick) {
        this.player.vel[0] = this.player.dash_dir[0] * this.tuning.dash_speed;
        this.player.vel[2] = this.player.dash_dir[1] * this.tuning.dash_speed;
        this.player.vel[1] = 0;
        this.player.dash_ticks -= 1;
      } else {
        if (this.player.launch_active) {
          this.player.vel[0] = this.player.launch_vel[0];
          this.player.vel[2] = this.player.launch_vel[1];
        } else {
          const runSpeed =
            this.player.charm_ticks > 0 ? CHARM_SPEED : this.tuning.player_speed;
          this.player.vel[0] = wx * runSpeed;
          this.player.vel[2] = wz * runSpeed;
        }

        if (jumpTriggered && this.player.grounded) {
          this.player.vel[1] = JUMP_VELOCITY;
          this.player.grounded = false;
        }
      }

      let windVx = 0;
      let windVz = 0;
      if (this.wind.active) {
        const wRad = (this.wind.dir_deg * Math.PI) / 180;
        windVx = Math.cos(wRad) * WIND_PUSH_SPEED;
        windVz = Math.sin(wRad) * WIND_PUSH_SPEED;
      }

      const oldX = this.player.pos[0];
      const oldY = this.player.pos[1];
      const oldZ = this.player.pos[2];

      const rawNewX = oldX + (this.player.vel[0] + windVx) * DT;
      const rawNewZ = oldZ + (this.player.vel[2] + windVz) * DT;

      const resolved = resolveObstacleAndCliff(this.night, oldX, oldZ, rawNewX, rawNewZ, oldY);
      this.player.pos[0] = resolved.x;
      this.player.pos[2] = resolved.z;

      if (!dashingThisTick) {
        if (!this.player.grounded || this.player.vel[1] > 0) {
          this.player.vel[1] -= GRAVITY * DT;
        }
        const nextY = oldY + this.player.vel[1] * DT;
        const supportY = getSupportY(this.night, this.player.pos[0], this.player.pos[2], oldY);
        const wasGroundedDownRamp =
          this.player.grounded &&
          this.player.vel[1] <= 0 &&
          supportY !== null &&
          oldY - supportY >= 0 &&
          oldY - supportY <= 0.25;

        if (wasGroundedDownRamp && supportY !== null) {
          this.player.pos[1] = supportY;
          this.player.vel[1] = 0;
          this.player.grounded = true;
          this.player.launch_active = false;
        } else if (supportY !== null && nextY <= supportY && this.player.vel[1] <= 0) {
          this.player.pos[1] = supportY;
          this.player.vel[1] = 0;
          this.player.grounded = true;
          this.player.launch_active = false;
        } else {
          this.player.pos[1] = nextY;
          this.player.grounded = false;
        }
      } else {
        const supportY = getSupportY(this.night, this.player.pos[0], this.player.pos[2], oldY);
        this.player.grounded = supportY !== null && Math.abs(this.player.pos[1] - supportY) <= 0.05;
      }

      if (!this.player.launch_active && !dashingThisTick) {
        for (const pad of this.map.jumpPads) {
          if (
            distXZ(this.player.pos, pad.pos) <= pad.radius &&
            Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.6
          ) {
            this.player.vel[0] = pad.vx;
            this.player.vel[1] = pad.vy;
            this.player.vel[2] = pad.vz;
            this.player.launch_active = true;
            this.player.launch_vel = [pad.vx, pad.vz];
            this.player.grounded = false;
            break;
          }
        }
      }

      if (this.tuning.fall_enabled && this.player.pos[1] < FALL_THRESHOLD_Y) {
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.vel = [0, 0, 0];
        this.player.launch_active = false;
        this.player.dash_ticks = 0;

        events.push(
          this.makeEvent(nextTick, 'player_hit', {
            by: 'fall',
            flames: this.player.flames,
            dropped: lost,
            lost,
          })
        );

        if (this.player.flames > 0) {
          this.player.respawn_ticks = FALL_RESPAWN_TICKS;
        }
      }
    }

    // ─── STEP 4: Pickup motes and charms (respecting dynamic playerCapacity) ───
    if (this.player.respawn_ticks === 0 && this.player.flames > 0) {
      const cap = this.playerCapacity;
      const remainingMotes: MoteState[] = [];
      for (const mote of this.motes) {
        if (
          mote.pickup_delay_ticks === 0 &&
          this.player.carried < cap &&
          distXZ(this.player.pos, mote.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - mote.pos[1]) <= PICKUP_MAX_DY
        ) {
          this.player.carried += 1;
          events.push(this.makeEvent(nextTick, 'mote_picked', { carried: this.player.carried }));
        } else {
          remainingMotes.push(mote);
        }
      }
      this.motes = remainingMotes;

      for (const charm of this.charms) {
        if (
          charm.available &&
          distXZ(this.player.pos, charm.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - charm.pos[1]) <= PICKUP_MAX_DY
        ) {
          charm.available = false;
          charm.respawn_ticks = CHARM_RESPAWN_TICKS;
          this.player.charm_ticks = CHARM_DURATION_TICKS;
          this.player.dash_cd_ticks = 0;
          events.push(
            this.makeEvent(nextTick, 'charm_picked', {
              charm_id: charm.id,
              charm_ticks: CHARM_DURATION_TICKS,
            })
          );
        }
      }
    }

    // ─── STEP 5: Interact with lanterns (light / relight / refuel) ───
    if (
      this.player.respawn_ticks === 0 &&
      this.player.flames > 0 &&
      interactTriggered &&
      this.player.carried > 0
    ) {
      let target: LanternState | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        // Full-fuel lit lanterns are NOT eligible
        if (lantern.lit && lantern.fuel_60ths >= FUEL_MAX_60THS) continue;
        if (Math.abs(this.player.pos[1] - lantern.pos[1]) > 2.0) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= this.tuning.interact_radius) {
          if (d < bestDist || (d === bestDist && target && cmpId(lantern.id, target.id) < 0)) {
            bestDist = d;
            target = lantern;
          }
        }
      }

      if (target) {
        if (!target.lit) {
          const requiredCost = target.ever_lit
            ? this.tuning.relight_cost
            : this.tuning.lantern_cost;
          const needed = requiredCost - target.deposited;
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            target.deposited += amount;
            this.score += amount * this.tuning.score.per_mote;
            events.push(
              this.makeEvent(nextTick, 'deposit', {
                lantern_id: target.id,
                amount,
                deposited: target.deposited,
              })
            );

            if (target.deposited >= requiredCost) {
              const isRelight = target.ever_lit;
              target.lit = true;
              target.fuel_60ths = FUEL_MAX_60THS;
              target.ever_lit = true;
              if (isRelight) {
                target.relit_count += 1;
              }
              this.player.successful_lights += 1;
              this.score += isRelight ? SCORE_RELIGHT : this.tuning.score.per_lantern;
              events.push(
                this.makeEvent(nextTick, 'lantern_lit', {
                  lantern_id: target.id,
                  relight: isRelight,
                })
              );
              this.triggerSafeZoneEjectionForLantern(target);
            }
          }
        } else {
          // Refuel lit lantern (fuel_60ths < 6000 guaranteed)
          const wasBelow30 = target.fuel_60ths < FUEL_LOW_THRESHOLD_60THS;
          const missing60ths = FUEL_MAX_60THS - target.fuel_60ths;
          const neededMotes = Math.ceil(missing60ths / FUEL_PER_MOTE_60THS);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            this.player.carried -= used;
            target.fuel_60ths = Math.min(
              FUEL_MAX_60THS,
              target.fuel_60ths + used * FUEL_PER_MOTE_60THS
            );
            this.score += used * this.tuning.score.per_mote;
            events.push(
              this.makeEvent(nextTick, 'refuel', {
                lantern_id: target.id,
                amount: used,
                fuel: round1(target.fuel_60ths / FUEL_SCALE),
              })
            );
            if (wasBelow30 && target.fuel_60ths >= FUEL_LOW_THRESHOLD_60THS) {
              this.triggerSafeZoneEjectionForLantern(target);
            }
          }
        }
      }
    }

    // ─── STEP 6: Update safe zones (only lit lanterns with fuel >= 30) ───
    for (const shade of this.shades) {
      this.stepSafeZoneEjection(shade);
      this.enforceSafeZonesForShade(shade);
    }

    // ─── STEP 7: Pulse (Tỏa Sáng) ───
    if (
      this.player.respawn_ticks === 0 &&
      this.player.flames > 0 &&
      pulseTriggered &&
      this.player.carried >= this.tuning.pulse_cost &&
      this.player.pulse_cd_ticks === 0
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulse_cd_ticks = PULSE_COOLDOWN_TICKS;
      const pulseCenter: Vec3 = [
        this.player.pos[0],
        this.player.pos[1] + PULSE_CENTER_Y_OFFSET,
        this.player.pos[2],
      ];

      const sortedShades = [...this.shades].sort((a, b) => cmpId(a.id, b.id));
      const stunnedIds: string[] = [];
      for (const shade of sortedShades) {
        if (shade.state === 'spawning') continue;
        if (dist3D(pulseCenter, shade.pos) <= this.tuning.pulse_radius) {
          const wasDraining = shade.state === 'drain';
          shade.state = 'stunned';
          shade.state_ticks_left = PULSE_STUN_TICKS;
          shade.push_ticks = PULSE_PUSH_TICKS;
          shade.recoil_ticks = 0;
          shade.target_lantern_id = null;
          shade.drain_ticks = 0;
          const dx = shade.pos[0] - this.player.pos[0];
          const dz = shade.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          shade.push_dir = d > 1e-6 ? [dx / d, dz / d] : [1, 0];
          this.score += wasDraining ? SCORE_STUN_DRAINING : this.tuning.score.per_stun;
          stunnedIds.push(shade.id);
        }
      }

      events.push(this.makeEvent(nextTick, 'pulse', { stunned_ids: stunnedIds }));

      const sortedDrifters = [...this.drifters]
        .filter((d) => d.state !== 'removed')
        .sort((a, b) => cmpId(a.id, b.id));
      for (const drifter of sortedDrifters) {
        if (dist3D(pulseCenter, drifter.pos) <= this.tuning.pulse_radius) {
          if (drifter.state === 'chase') {
            drifter.state = 'flee';
            drifter.flee_ticks = DRIFTER_FLEE_TICKS;
          } else if (drifter.state === 'flee' && drifter.stolen > 0) {
            const amount = drifter.stolen;
            drifter.stolen = 0;
            drifter.flee_ticks = DRIFTER_PULSE_FLEE_TICKS;
            this.spawnDroppedMotes(drifter.pos, amount);
            events.push(
              this.makeEvent(nextTick, 'drifter_drop', {
                drifter_id: drifter.id,
                amount,
              })
            );
          }
        }
      }
    }

    // ─── STEP 8: Move Shades (with drain AI) and Drifters ───
    const shadeSpeed = this.map.shadeSpeed;
    for (const shade of this.shades) {
      const oldX = shade.pos[0];
      const oldZ = shade.pos[2];

      if (shade.state === 'spawning' || shade.eject_ticks > 0) {
        continue;
      }

      if (shade.state === 'stunned') {
        if (shade.push_ticks > 0) {
          const stepDist = this.tuning.pulse_push_m / PULSE_PUSH_TICKS;
          const nx = oldX + shade.push_dir[0] * stepDist;
          const nz = oldZ + shade.push_dir[1] * stepDist;
          const res = resolveObstacleAndCliff(this.night, oldX, oldZ, nx, nz, shade.pos[1]);
          shade.pos[0] = res.x;
          shade.pos[2] = res.z;
          if (res.blocked) {
            shade.push_ticks = 0;
          } else {
            shade.push_ticks -= 1;
          }
          const g = getSupportY(this.night, shade.pos[0], shade.pos[2], shade.pos[1]);
          if (g !== null) shade.pos[1] = g;
        }
        this.enforceSafeZonesForShade(shade);
        continue;
      }

      if (shade.state === 'recoil') {
        if (shade.recoil_ticks > 0) {
          const stepDist = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
          const nx = oldX + shade.recoil_dir[0] * stepDist;
          const nz = oldZ + shade.recoil_dir[1] * stepDist;
          const res = resolveObstacleAndCliff(this.night, oldX, oldZ, nx, nz, shade.pos[1]);
          shade.pos[0] = res.x;
          shade.pos[2] = res.z;
          shade.recoil_ticks -= 1;
          const g = getSupportY(this.night, shade.pos[0], shade.pos[2], shade.pos[1]);
          if (g !== null) shade.pos[1] = g;
        }
        if (shade.recoil_ticks === 0) {
          shade.state = 'wander';
          shade.state_ticks_left = 0;
        }
        this.enforceSafeZonesForShade(shade);
        continue;
      }

      const dToPlayer = distXZ(shade.pos, this.player.pos);

      if (shade.state === 'drain') {
        if (this.player.respawn_ticks === 0 && dToPlayer <= SHADE_DRAIN_AGGRO_RADIUS) {
          shade.state = 'chase';
          shade.target_lantern_id = null;
          shade.drain_ticks = 0;
        } else {
          const targetLantern = this.lanterns.find((l) => l.id === shade.target_lantern_id);
          if (
            !targetLantern ||
            !targetLantern.lit ||
            targetLantern.fuel_60ths >= FUEL_LOW_THRESHOLD_60THS ||
            distXZ(shade.pos, targetLantern.pos) > SHADE_DRAIN_RADIUS
          ) {
            shade.state = 'wander';
            shade.target_lantern_id = null;
            shade.drain_ticks = 0;
          } else {
            // Stay stationary while draining
            this.enforceSafeZonesForShade(shade);
            continue;
          }
        }
      }

      if (shade.state === 'wander') {
        if (this.player.respawn_ticks === 0 && dToPlayer <= SHADE_DETECT_RADIUS) {
          shade.state = 'chase';
          shade.target_lantern_id = null;
        } else {
          const weakLantern = this.findNearestWeakLitLantern(shade.pos);
          if (weakLantern) {
            const dl = distXZ(shade.pos, weakLantern.pos);
            if (dl <= SHADE_DRAIN_RADIUS) {
              shade.state = 'drain';
              shade.target_lantern_id = weakLantern.id;
              shade.drain_ticks = 0;
            } else {
              const dx = weakLantern.pos[0] - shade.pos[0];
              const dz = weakLantern.pos[2] - shade.pos[2];
              const moveDist = Math.min(dl, shadeSpeed * DT);
              const candX = oldX + (dx / dl) * moveDist;
              const candZ = oldZ + (dz / dl) * moveDist;
              const res = resolveObstacleAndCliff(this.night, oldX, oldZ, candX, candZ, shade.pos[1]);
              shade.pos[0] = res.x;
              shade.pos[2] = res.z;
              const g = getSupportY(this.night, shade.pos[0], shade.pos[2], shade.pos[1]);
              if (g !== null) shade.pos[1] = g;
              if (distXZ(shade.pos, weakLantern.pos) <= SHADE_DRAIN_RADIUS) {
                shade.state = 'drain';
                shade.target_lantern_id = weakLantern.id;
                shade.drain_ticks = 0;
              }
            }
          } else {
            const unlit = this.findNearestUnlitLantern(shade.pos);
            if (unlit && distXZ(shade.pos, unlit.pos) > 2.5) {
              const dl = distXZ(shade.pos, unlit.pos);
              const dx = unlit.pos[0] - shade.pos[0];
              const dz = unlit.pos[2] - shade.pos[2];
              const moveDist = Math.min(dl, shadeSpeed * 0.55 * DT);
              const candX = oldX + (dx / dl) * moveDist;
              const candZ = oldZ + (dz / dl) * moveDist;
              if (isPointOnGround(this.night, candX, candZ)) {
                const res = resolveObstacleAndCliff(this.night, oldX, oldZ, candX, candZ, shade.pos[1]);
                shade.pos[0] = res.x;
                shade.pos[2] = res.z;
                const g = getSupportY(this.night, shade.pos[0], shade.pos[2], shade.pos[1]);
                if (g !== null) shade.pos[1] = g;
              }
            } else {
              const stepDist = shadeSpeed * 0.45 * DT;
              const candX = oldX + Math.cos(shade.wander_angle) * stepDist;
              const candZ = oldZ + Math.sin(shade.wander_angle) * stepDist;
              if (isPointOnGround(this.night, candX, candZ)) {
                const res = resolveObstacleAndCliff(this.night, oldX, oldZ, candX, candZ, shade.pos[1]);
                shade.pos[0] = res.x;
                shade.pos[2] = res.z;
                if (res.blocked) shade.wander_angle += Math.PI * 0.65;
                const g = getSupportY(this.night, shade.pos[0], shade.pos[2], shade.pos[1]);
                if (g !== null) shade.pos[1] = g;
              } else {
                shade.wander_angle += Math.PI * 0.75;
              }
            }
          }
        }
      }

      if (shade.state === 'chase') {
        if (this.player.respawn_ticks > 0 || dToPlayer > SHADE_ABANDON_RADIUS) {
          shade.state = 'wander';
        } else if (dToPlayer > 1e-6) {
          const dx = this.player.pos[0] - shade.pos[0];
          const dz = this.player.pos[2] - shade.pos[2];
          const moveDist = Math.min(dToPlayer, shadeSpeed * DT);
          const candX = oldX + (dx / dToPlayer) * moveDist;
          const candZ = oldZ + (dz / dToPlayer) * moveDist;
          const res = resolveObstacleAndCliff(this.night, oldX, oldZ, candX, candZ, shade.pos[1]);
          shade.pos[0] = res.x;
          shade.pos[2] = res.z;
          const g = getSupportY(this.night, shade.pos[0], shade.pos[2], shade.pos[1]);
          if (g !== null) shade.pos[1] = g;
        }
      }

      this.enforceSafeZonesForShade(shade);
    }

    // Move Drifters
    for (const drifter of this.drifters) {
      if (drifter.state === 'removed') continue;
      const dToPlayer = distXZ(drifter.pos, this.player.pos);

      if (drifter.state === 'idle') {
        if (
          this.player.respawn_ticks === 0 &&
          !drifter.has_stolen &&
          this.player.carried >= DRIFTER_MIN_CARRIED &&
          dToPlayer <= DRIFTER_DETECT_RADIUS
        ) {
          drifter.state = 'chase';
        } else {
          drifter.orbit_angle += 0.015;
          drifter.pos[0] += Math.cos(drifter.orbit_angle) * DRIFTER_IDLE_SPEED * DT;
          drifter.pos[2] += Math.sin(drifter.orbit_angle) * DRIFTER_IDLE_SPEED * DT;
        }
      }

      if (drifter.state === 'chase') {
        if (
          this.player.respawn_ticks > 0 ||
          this.player.carried < DRIFTER_MIN_CARRIED ||
          dToPlayer > DRIFTER_DETECT_RADIUS
        ) {
          drifter.state = 'idle';
        } else if (dToPlayer > 1e-6) {
          const dx = this.player.pos[0] - drifter.pos[0];
          const dz = this.player.pos[2] - drifter.pos[2];
          const moveDist = Math.min(dToPlayer, DRIFTER_CHASE_SPEED * DT);
          drifter.pos[0] += (dx / dToPlayer) * moveDist;
          drifter.pos[2] += (dz / dToPlayer) * moveDist;
        }
      } else if (drifter.state === 'flee') {
        const dx = drifter.pos[0] - this.player.pos[0];
        const dz = drifter.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        drifter.pos[0] += nx * DRIFTER_FLEE_SPEED * DT;
        drifter.pos[2] += nz * DRIFTER_FLEE_SPEED * DT;
      }

      const groundY = getHighestGroundY(this.night, drifter.pos[0], drifter.pos[2]) ?? 0;
      drifter.pos[1] = groundY + 1.0;
    }

    // ─── STEP 9: Collisions — Drifters steal FIRST, then Shades hit (id ascending) ───
    if (this.player.respawn_ticks === 0 && this.player.flames > 0) {
      const sortedDrifters = [...this.drifters]
        .filter((d) => d.state === 'chase' && !d.has_stolen)
        .sort((a, b) => cmpId(a.id, b.id));
      for (const drifter of sortedDrifters) {
        if (
          distXZ(this.player.pos, drifter.pos) <= DRIFTER_STEAL_RADIUS &&
          Math.abs(this.player.pos[1] - (drifter.pos[1] - 1.0)) <= 2.0
        ) {
          const amount = Math.min(DRIFTER_MAX_STEAL, this.player.carried);
          if (amount > 0) {
            this.player.carried -= amount;
            drifter.stolen = amount;
            drifter.has_stolen = true;
            drifter.state = 'flee';
            drifter.flee_ticks = DRIFTER_FLEE_TICKS;
            events.push(
              this.makeEvent(nextTick, 'drifter_steal', {
                drifter_id: drifter.id,
                amount,
                carried: this.player.carried,
              })
            );
          }
        }
      }

      if (this.player.invuln_ticks === 0) {
        const sortedShades = [...this.shades].sort((a, b) => cmpId(a.id, b.id));
        const hitter = sortedShades.find(
          (s) =>
            (s.state === 'chase' || s.state === 'wander' || s.state === 'drain') &&
            s.eject_ticks === 0 &&
            distXZ(this.player.pos, s.pos) <= this.tuning.shade_hit_radius &&
            Math.abs(this.player.pos[1] - s.pos[1]) <= SHADE_HIT_MAX_DY
        );

        if (hitter) {
          const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
          this.player.carried -= dropped;
          this.player.flames = Math.max(0, this.player.flames - 1);
          this.player.invuln_ticks = INVULN_TICKS;
          if (dropped > 0) {
            this.spawnDroppedMotes(this.player.pos, dropped);
          }

          const dx = hitter.pos[0] - this.player.pos[0];
          const dz = hitter.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          hitter.state = 'recoil';
          hitter.state_ticks_left = SHADE_RECOIL_TICKS + 1;
          hitter.recoil_ticks = SHADE_RECOIL_TICKS;
          hitter.recoil_dir = d > 1e-6 ? [dx / d, dz / d] : [1, 0];
          hitter.target_lantern_id = null;
          hitter.drain_ticks = 0;

          events.push(
            this.makeEvent(nextTick, 'player_hit', {
              by: 'shade',
              flames: this.player.flames,
              dropped,
            })
          );
        }
      }
    }

    // ─── STEP 10: Scheduled spawns (interactable from NEXT tick) ───
    if (this.randomMotesEnabled && this.simTick > 0 && this.simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnScheduledMote();
    }

    if (this.randomShadesEnabled) {
      if (this.simTick === SHADE_SPAWN_FIRST_TICK) {
        this.spawnScheduledShade(events, nextTick);
        this.spawnScheduledShade(events, nextTick);
      } else if (
        this.simTick > SHADE_SPAWN_FIRST_TICK &&
        (this.simTick - SHADE_SPAWN_FIRST_TICK) % this.map.shadeIntervalTicks === 0
      ) {
        this.spawnScheduledShade(events, nextTick);
      }
    }

    if (
      this.randomDriftersEnabled &&
      this.simTick > 0 &&
      this.simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0
    ) {
      this.spawnScheduledDrifter();
    }

    // ─── STEP 11: Win / Loss check [REPLACED in Ticket-03] ───
    // 1) No flames ALWAYS loses immediately (even on dawn tick)
    // 2) No early win on all_lit; win occurs at dawn (time_left_s <= 0) if lit >= ceil(0.6 * total)
    if (this.player.flames <= 0) {
      this.status = 'lost';
      events.push(
        this.makeEvent(nextTick, 'game_over', {
          result: 'lost',
          reason: 'no_flames',
        })
      );
    } else if (this.timeLeftS <= 0) {
      this.timeLeftS = 0;
      const litLanterns = this.lanterns.filter((l) => l.lit);
      const requiredLit = this.getRequiredLanternsToWin();
      if (litLanterns.length >= requiredLit) {
        this.status = 'won';
        let dawnBonus = this.player.flames * this.tuning.score.per_flame_left;
        for (const l of litLanterns) {
          dawnBonus += SCORE_DAWN_LANTERN_BASE + Math.floor(l.fuel_60ths / FUEL_SCALE);
        }
        this.score += dawnBonus;
        events.push(
          this.makeEvent(nextTick, 'game_over', {
            result: 'won',
            reason: 'dawn_survived',
          })
        );
      } else {
        this.status = 'lost';
        events.push(
          this.makeEvent(nextTick, 'game_over', {
            result: 'lost',
            reason: 'dawn',
          })
        );
      }
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

    records.push(this.getSnapshot());

    for (let k = 0; k < maxTicks; k++) {
      if (this.status === 'won' || this.status === 'lost') break;

      while (frameIdx < frames.length && frames[frameIdx].tick === k) {
        const f = frames[frameIdx];
        if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
        if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
        if (f.jump !== undefined) currentInput.jump = f.jump;
        if (f.interact !== undefined) currentInput.interact = f.interact;
        if (f.pulse !== undefined) currentInput.pulse = f.pulse;
        if (f.dash !== undefined) currentInput.dash = f.dash;
        if (f.pause !== undefined) currentInput.pause = f.pause;
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
