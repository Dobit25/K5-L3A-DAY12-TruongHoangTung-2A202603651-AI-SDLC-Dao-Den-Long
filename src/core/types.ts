export type Vec3 = [number, number, number];
export type NightNumber = 1 | 2 | 3;

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface GameTuning {
  player_speed: number;
  carry_capacity: number;
  capacity_max: number;
  lantern_cost: number;
  relight_cost: number;
  lantern_count_night1: number;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  low_fuel_threshold: number;
  drain_per_s: number;
  win_ratio: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number | null;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  score: ScoreTuning;
}

export type GameStateStatus = 'playing' | 'paused' | 'won' | 'lost';

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputFile {
  frames: InputFrame[];
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
  successful_lights?: number;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export type ShadeBehaviorState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeBehaviorState;
  state_ticks_left?: number;
  target_lantern_id?: string | null;
}

export type MoteKind = 'random' | 'dropped';
export type ScenarioMote = Vec3 | { id?: string; pos: Vec3; kind?: MoteKind; ttl_ticks?: number | null };

export type DrifterBehaviorState = 'idle' | 'chase' | 'flee' | 'removed';

export interface ScenarioDrifter {
  id?: string;
  pos: Vec3;
  state?: DrifterBehaviorState;
  stolen?: number;
  flee_ticks?: number;
}

export interface ScenarioCharm {
  id: string;
  pos?: Vec3;
  available?: boolean;
  respawn_ticks?: number;
}

export interface ScenarioFile {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  facing: [number, number];
  flames: number;
  carried: number;
  successful_lights: number;
  invuln_ticks: number;
  dash_cd_ticks: number;
  dash_ticks: number;
  dash_dir: [number, number];
  pulse_cd_ticks: number;
  charm_ticks: number;
  respawn_ticks: number;
  launch_active: boolean;
  launch_vel: [number, number];
}

export interface LanternState {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  /** Integer 1/60 fuel units (0..6000 == 0.0..100.0 fuel) to prevent float drift. */
  fuel_60ths: number;
  ever_lit: boolean;
  relit_count: number;
}

export interface ShadeState {
  id: string;
  pos: Vec3;
  state: ShadeBehaviorState;
  state_ticks_left: number;
  push_ticks: number;
  push_dir: [number, number];
  recoil_ticks: number;
  recoil_dir: [number, number];
  wander_angle: number;
  eject_ticks: number;
  eject_lantern_id: string | null;
  target_lantern_id: string | null;
  drain_ticks: number;
}

export interface MoteState {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  ttl_ticks: number | null;
  pickup_delay_ticks: number;
}

export interface DrifterState {
  id: string;
  pos: Vec3;
  state: DrifterBehaviorState;
  stolen: number;
  has_stolen: boolean;
  flee_ticks: number;
  orbit_angle: number;
}

export interface CharmState {
  id: string;
  pos: Vec3;
  available: boolean;
  respawn_ticks: number;
}

export interface WindState {
  active: boolean;
  dir_deg: number;
  warning: boolean;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: NightNumber;
  state: GameStateStatus;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3;
    vel: Vec3;
    grounded: boolean;
    flames: number;
    carried: number;
    capacity: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3;
    state: ShadeBehaviorState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3;
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3;
    state: DrifterBehaviorState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
}

export type GameEventName =
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'refuel'
  | 'lantern_out'
  | 'fuel_drain'
  | 'pulse'
  | 'player_hit'
  | 'shade_spawned'
  | 'game_over'
  | 'dash'
  | 'charm_picked'
  | 'drifter_steal'
  | 'drifter_drop'
  | 'night_start'
  | 'paused'
  | 'resumed';

export interface EventRecord {
  type: 'event';
  tick: number;
  name: GameEventName;
  data: Record<string, unknown>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameStateStatus;
  score: number;
}

export type HeadlessRecord = SnapshotRecord | EventRecord | EndRecord;
