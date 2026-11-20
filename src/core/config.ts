import type { GameTuning } from './types.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

// Standardized movement & physics constants (Ticket-02 & Ticket-03)
export const JUMP_VELOCITY = 7.0;
export const GRAVITY = 20.0;
export const DASH_TICKS = 12; // 0.2s
export const DASH_COOLDOWN_TICKS = 90; // 1.5s
export const CHARM_SPEED = 7.2;
export const CHARM_DURATION_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;

export const PICKUP_MAX_DY = 1.5;
export const SHADE_HIT_MAX_DY = 1.5;
export const FALL_THRESHOLD_Y = -10.0;
export const FALL_RESPAWN_TICKS = 60;
export const INVULN_TICKS = 90;

export const INITIAL_RANDOM_MOTES = 20;
export const MAX_RANDOM_MOTES = 30;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;
export const DROPPED_MOTE_TTL_TICKS = 480;
export const DROPPED_MOTE_RING_MIN = 1.5;
export const DROPPED_MOTE_RING_MAX = 2.5;

// Fuel system in exact integer 1/60 units (Ticket-03)
export const FUEL_SCALE = 60; // 1 fuel = 60 units
export const FUEL_MAX_60THS = 100 * FUEL_SCALE; // 6000
export const FUEL_LOW_THRESHOLD_60THS = 30 * FUEL_SCALE; // 1800
export const FUEL_DECAY_PER_TICK_60THS = 1; // 1.0/s
export const FUEL_DRAIN_PER_TICK_60THS = 5; // 5.0/s per draining shade
export const FUEL_PER_MOTE_60THS = 10 * FUEL_SCALE; // 600
export const FUEL_DRAIN_EVENT_INTERVAL_TICKS = 60;
export const SHADE_DRAIN_RADIUS = 2.0;
export const SHADE_DRAIN_AGGRO_RADIUS = 6.0;

export const SCORE_RELIGHT = 40;
export const SCORE_STUN_DRAINING = 15;
export const SCORE_DAWN_LANTERN_BASE = 50;
export const CAPACITY_INCREMENT_PER_LIGHT = 2;

export const PULSE_CENTER_Y_OFFSET = 0.8;
export const PULSE_STUN_TICKS = 120;
export const PULSE_PUSH_TICKS = 15;
export const PULSE_COOLDOWN_TICKS = 180;

export const SHADE_DETECT_RADIUS = 12.0;
export const SHADE_ABANDON_RADIUS = 18.0;
export const SHADE_RECOIL_DIST = 2.0;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_SPAWN_FIRST_TICK = 300;
export const SHADE_SPAWN_MIN_PLAYER_DIST = 15.0;
export const SHADE_SAFE_EJECT_TICKS = 30;
export const SAFE_RADIUS_EPSILON = 0.05;
export const NIGHT3_SHADE_SPEED = 4.5;

export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_CHASE_SPEED = 7.0;
export const DRIFTER_FLEE_SPEED = 7.0;
export const DRIFTER_DETECT_RADIUS = 15.0;
export const DRIFTER_MIN_CARRIED = 5;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_MAX_STEAL = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_PULSE_FLEE_TICKS = 120;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_MAX_ACTIVE = 2;

export const WIND_INTERVAL_TICKS = 1800; // every 30s
export const WIND_DURATION_TICKS = 300; // 5s
export const WIND_WARNING_TICKS = 120; // 2s lead warning
export const WIND_PUSH_SPEED = 2.0;

export const DEFAULT_TUNING: GameTuning = {
  player_speed: 6.0,
  carry_capacity: 10,
  capacity_max: 20,
  lantern_cost: 10,
  relight_cost: 5,
  lantern_count_night1: 5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  low_fuel_threshold: 30,
  drain_per_s: 5,
  win_ratio: 0.6,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 0,
    per_flame_left: 50,
  },
};

// Standardized visual palette (Ticket-02 & Ticket-03 colorblind overrides)
export const PALETTE = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeRimColorblind: 0x00b3ff,
  shadeStunned: 0x3a3450,
  mayRobe: 0xe8e2d0,
  mayScarfAndCharm: 0xc8102e,
  goldAccent: 0xf2c14e,
  drifter: 0x8fa3b8,
  uiDanger: '#FF5A5F',
  uiDangerColorblind: '#FFFFFF',
  uiText: '#F5F1E6',
} as const;
