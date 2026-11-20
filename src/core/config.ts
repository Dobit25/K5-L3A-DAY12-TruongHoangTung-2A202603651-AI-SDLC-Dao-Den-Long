import type { GameTuning, Vec3 } from './types.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 42;
export const JUMP_VELOCITY = 7.5;
export const GRAVITY = 20.0;
export const SAFE_RADIUS_EPSILON = 0.05;

export const INITIAL_RANDOM_MOTES = 20;
export const MAX_RANDOM_MOTES = 20;
export const MOTE_RESPAWN_INTERVAL_TICKS = 300; // every 5s

export const INITIAL_RANDOM_SHADES = 2;
export const MAX_RANDOM_SHADES = 5;
export const SHADE_SPAWN_INTERVAL_TICKS = 2100; // every 35s

export const DEFAULT_TUNING: GameTuning = {
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.8,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 8.0,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3.0,
  pulse_push_m: 6.0,
  pulse_cooldown_s: 2.0,
  safe_radius: 6.0,
  shade_speed: 3.5,
  shade_hit_radius: 1.4,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 200,
    per_stun: 50,
    per_second_left: 5,
    per_flame_left: 100,
  },
};

export interface DefaultLanternSpec {
  id: string;
  pos: Vec3;
}

// 5 Great Lanterns arranged symmetrically around Đảo Bến (radius 22m)
export const NIGHT1_LANTERNS: DefaultLanternSpec[] = [
  { id: 'L1', pos: [0, 0, 22] },
  { id: 'L2', pos: [20.923, 0, 6.798] },
  { id: 'L3', pos: [12.931, 0, -17.798] },
  { id: 'L4', pos: [-12.931, 0, -17.798] },
  { id: 'L5', pos: [-20.923, 0, 6.798] },
];

