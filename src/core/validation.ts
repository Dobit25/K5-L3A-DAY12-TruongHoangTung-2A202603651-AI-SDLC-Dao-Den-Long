import type {
  DrifterBehaviorState,
  InputFile,
  InputFrame,
  MoteKind,
  ScenarioFile,
  ShadeBehaviorState,
  Vec3,
} from './types.js';

export class ContractValidationError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = 'ContractValidationError';
    this.exitCode = exitCode;
  }
}

const VALID_SHADE_STATES = new Set<ShadeBehaviorState>([
  'spawning',
  'wander',
  'chase',
  'recoil',
  'stunned',
  'drain',
]);

const VALID_DRIFTER_STATES = new Set<DrifterBehaviorState>(['idle', 'chase', 'flee', 'removed']);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function assertVec3(v: unknown, label: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isFiniteNumber)) {
    throw new ContractValidationError(`${label} must be an array of 3 finite numbers`, 2);
  }
  return [v[0], v[1], v[2]];
}

function assertNonNegInt(v: unknown, label: string): number {
  if (!Number.isInteger(v) || (v as number) < 0) {
    throw new ContractValidationError(`${label} must be a non-negative integer`, 2);
  }
  return v as number;
}

export function validateInputFile(raw: unknown): InputFile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ContractValidationError('Inputs file must be a JSON object', 2);
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.frames)) {
    throw new ContractValidationError('Inputs file must contain a "frames" array', 2);
  }

  let prevTick = -1;
  const frames: InputFrame[] = [];

  for (let i = 0; i < obj.frames.length; i++) {
    const f = obj.frames[i];
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      throw new ContractValidationError(`frames[${i}] must be an object`, 2);
    }
    const fo = f as Record<string, unknown>;
    const tick = assertNonNegInt(fo.tick, `frames[${i}].tick`);
    if (tick <= prevTick) {
      throw new ContractValidationError(
        `frames[${i}].tick (${tick}) must strictly increase after ${prevTick}`,
        2
      );
    }
    prevTick = tick;

    const frame: InputFrame = { tick };

    if (fo.move !== undefined) {
      if (
        !Array.isArray(fo.move) ||
        fo.move.length !== 2 ||
        !isFiniteNumber(fo.move[0]) ||
        !isFiniteNumber(fo.move[1])
      ) {
        throw new ContractValidationError(`frames[${i}].move must be [x, z] finite numbers`, 2);
      }
      if (fo.move[0] < -1 || fo.move[0] > 1 || fo.move[1] < -1 || fo.move[1] > 1) {
        throw new ContractValidationError(`frames[${i}].move components must be within [-1, 1]`, 2);
      }
      frame.move = [fo.move[0], fo.move[1]];
    }

    if (fo.cam_yaw_deg !== undefined) {
      if (!isFiniteNumber(fo.cam_yaw_deg)) {
        throw new ContractValidationError(`frames[${i}].cam_yaw_deg must be a finite number`, 2);
      }
      frame.cam_yaw_deg = fo.cam_yaw_deg;
    }

    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (fo[key] !== undefined) {
        if (typeof fo[key] !== 'boolean') {
          throw new ContractValidationError(`frames[${i}].${key} must be a boolean`, 2);
        }
        frame[key] = fo[key] as boolean;
      }
    }

    frames.push(frame);
  }

  return { frames };
}

export function validateScenarioFile(raw: unknown): ScenarioFile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ContractValidationError('Scenario file must be a JSON object', 2);
  }
  const obj = raw as Record<string, unknown>;
  const scenario: ScenarioFile = {};

  if (obj.player !== undefined) {
    if (typeof obj.player !== 'object' || obj.player === null || Array.isArray(obj.player)) {
      throw new ContractValidationError('scenario.player must be an object', 2);
    }
    const p = obj.player as Record<string, unknown>;
    scenario.player = {};
    if (p.pos !== undefined) scenario.player.pos = assertVec3(p.pos, 'scenario.player.pos');
    if (p.carried !== undefined)
      scenario.player.carried = assertNonNegInt(p.carried, 'scenario.player.carried');
    if (p.flames !== undefined)
      scenario.player.flames = assertNonNegInt(p.flames, 'scenario.player.flames');
    if (p.invuln_ticks !== undefined)
      scenario.player.invuln_ticks = assertNonNegInt(p.invuln_ticks, 'scenario.player.invuln_ticks');
    if (p.dash_cd_ticks !== undefined)
      scenario.player.dash_cd_ticks = assertNonNegInt(
        p.dash_cd_ticks,
        'scenario.player.dash_cd_ticks'
      );
    if (p.pulse_cd_ticks !== undefined)
      scenario.player.pulse_cd_ticks = assertNonNegInt(
        p.pulse_cd_ticks,
        'scenario.player.pulse_cd_ticks'
      );
    if (p.charm_ticks !== undefined)
      scenario.player.charm_ticks = assertNonNegInt(p.charm_ticks, 'scenario.player.charm_ticks');
    if (p.successful_lights !== undefined)
      scenario.player.successful_lights = assertNonNegInt(
        p.successful_lights,
        'scenario.player.successful_lights'
      );
  }

  for (const flag of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (obj[flag] !== undefined) {
      if (typeof obj[flag] !== 'boolean') {
        throw new ContractValidationError(`scenario.${flag} must be a boolean`, 2);
      }
      scenario[flag] = obj[flag] as boolean;
    }
  }

  if (obj.time_left_s !== undefined) {
    if (!isFiniteNumber(obj.time_left_s) || obj.time_left_s < 0) {
      throw new ContractValidationError('scenario.time_left_s must be a non-negative number', 2);
    }
    scenario.time_left_s = obj.time_left_s;
  }

  if (obj.motes !== undefined) {
    if (!Array.isArray(obj.motes)) {
      throw new ContractValidationError('scenario.motes must be an array', 2);
    }
    scenario.motes = obj.motes.map((item, idx) => {
      if (Array.isArray(item)) {
        return assertVec3(item, `scenario.motes[${idx}]`);
      }
      if (typeof item === 'object' && item !== null) {
        const mo = item as Record<string, unknown>;
        const pos = assertVec3(mo.pos, `scenario.motes[${idx}].pos`);
        if (mo.id !== undefined && typeof mo.id !== 'string') {
          throw new ContractValidationError(`scenario.motes[${idx}].id must be a string`, 2);
        }
        if (mo.kind !== undefined && mo.kind !== 'random' && mo.kind !== 'dropped') {
          throw new ContractValidationError(`scenario.motes[${idx}].kind must be random|dropped`, 2);
        }
        let ttl_ticks: number | null | undefined;
        if (mo.ttl_ticks !== undefined) {
          ttl_ticks =
            mo.ttl_ticks === null
              ? null
              : assertNonNegInt(mo.ttl_ticks, `scenario.motes[${idx}].ttl_ticks`);
        }
        return {
          id: mo.id as string | undefined,
          pos,
          kind: mo.kind as MoteKind | undefined,
          ttl_ticks,
        };
      }
      throw new ContractValidationError(`scenario.motes[${idx}] must be [x,y,z] or {id?, pos}`, 2);
    });
  }

  if (obj.shades !== undefined) {
    if (!Array.isArray(obj.shades)) {
      throw new ContractValidationError('scenario.shades must be an array', 2);
    }
    scenario.shades = obj.shades.map((item, idx) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new ContractValidationError(`scenario.shades[${idx}] must be an object`, 2);
      }
      const so = item as Record<string, unknown>;
      const pos = assertVec3(so.pos, `scenario.shades[${idx}].pos`);
      if (so.id !== undefined && typeof so.id !== 'string') {
        throw new ContractValidationError(`scenario.shades[${idx}].id must be a string`, 2);
      }
      if (so.state !== undefined) {
        if (typeof so.state !== 'string' || !VALID_SHADE_STATES.has(so.state as ShadeBehaviorState)) {
          throw new ContractValidationError(
            `scenario.shades[${idx}].state must be spawning|wander|chase|recoil|stunned|drain`,
            2
          );
        }
      }
      if (
        so.target_lantern_id !== undefined &&
        so.target_lantern_id !== null &&
        typeof so.target_lantern_id !== 'string'
      ) {
        throw new ContractValidationError(
          `scenario.shades[${idx}].target_lantern_id must be a string or null`,
          2
        );
      }
      const state_ticks_left =
        so.state_ticks_left !== undefined
          ? assertNonNegInt(so.state_ticks_left, `scenario.shades[${idx}].state_ticks_left`)
          : undefined;
      return {
        id: so.id as string | undefined,
        pos,
        state: so.state as ShadeBehaviorState | undefined,
        state_ticks_left,
        target_lantern_id: so.target_lantern_id as string | null | undefined,
      };
    });
  }

  if (obj.drifters !== undefined) {
    if (!Array.isArray(obj.drifters)) {
      throw new ContractValidationError('scenario.drifters must be an array', 2);
    }
    scenario.drifters = obj.drifters.map((item, idx) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new ContractValidationError(`scenario.drifters[${idx}] must be an object`, 2);
      }
      const d = item as Record<string, unknown>;
      const pos = assertVec3(d.pos, `scenario.drifters[${idx}].pos`);
      if (d.id !== undefined && typeof d.id !== 'string') {
        throw new ContractValidationError(`scenario.drifters[${idx}].id must be a string`, 2);
      }
      if (d.state !== undefined) {
        if (
          typeof d.state !== 'string' ||
          !VALID_DRIFTER_STATES.has(d.state as DrifterBehaviorState)
        ) {
          throw new ContractValidationError(
            `scenario.drifters[${idx}].state must be idle|chase|flee|removed`,
            2
          );
        }
      }
      return {
        id: d.id as string | undefined,
        pos,
        state: d.state as DrifterBehaviorState | undefined,
        stolen:
          d.stolen !== undefined ? assertNonNegInt(d.stolen, `scenario.drifters[${idx}].stolen`) : undefined,
        flee_ticks:
          d.flee_ticks !== undefined
            ? assertNonNegInt(d.flee_ticks, `scenario.drifters[${idx}].flee_ticks`)
            : undefined,
      };
    });
  }

  if (obj.charms !== undefined) {
    if (!Array.isArray(obj.charms)) {
      throw new ContractValidationError('scenario.charms must be an array', 2);
    }
    scenario.charms = obj.charms.map((item, idx) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new ContractValidationError(`scenario.charms[${idx}] must be an object`, 2);
      }
      const c = item as Record<string, unknown>;
      if (typeof c.id !== 'string' || c.id.length === 0) {
        throw new ContractValidationError(`scenario.charms[${idx}].id must be a non-empty string`, 2);
      }
      return {
        id: c.id,
        pos: c.pos !== undefined ? assertVec3(c.pos, `scenario.charms[${idx}].pos`) : undefined,
        available:
          c.available !== undefined
            ? typeof c.available === 'boolean'
              ? c.available
              : (() => {
                  throw new ContractValidationError(`scenario.charms[${idx}].available must be boolean`, 2);
                })()
            : undefined,
        respawn_ticks:
          c.respawn_ticks !== undefined
            ? assertNonNegInt(c.respawn_ticks, `scenario.charms[${idx}].respawn_ticks`)
            : undefined,
      };
    });
  }

  if (obj.lanterns !== undefined) {
    if (!Array.isArray(obj.lanterns)) {
      throw new ContractValidationError('scenario.lanterns must be an array', 2);
    }
    scenario.lanterns = obj.lanterns.map((item, idx) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new ContractValidationError(`scenario.lanterns[${idx}] must be an object`, 2);
      }
      const lo = item as Record<string, unknown>;
      if (typeof lo.id !== 'string' || lo.id.length === 0) {
        throw new ContractValidationError(`scenario.lanterns[${idx}].id must be a non-empty string`, 2);
      }
      const result: {
        id: string;
        pos?: Vec3;
        deposited?: number;
        lit?: boolean;
        fuel?: number;
        ever_lit?: boolean;
      } = { id: lo.id };
      if (lo.pos !== undefined) result.pos = assertVec3(lo.pos, `scenario.lanterns[${idx}].pos`);
      if (lo.deposited !== undefined) {
        result.deposited = assertNonNegInt(lo.deposited, `scenario.lanterns[${idx}].deposited`);
      }
      if (lo.lit !== undefined) {
        if (typeof lo.lit !== 'boolean') {
          throw new ContractValidationError(`scenario.lanterns[${idx}].lit must be a boolean`, 2);
        }
        result.lit = lo.lit;
      }
      if (lo.fuel !== undefined) {
        if (!isFiniteNumber(lo.fuel) || lo.fuel < 0 || lo.fuel > 100) {
          throw new ContractValidationError(
            `scenario.lanterns[${idx}].fuel must be a number in [0, 100]`,
            2
          );
        }
        result.fuel = lo.fuel;
      }
      if (lo.ever_lit !== undefined) {
        if (typeof lo.ever_lit !== 'boolean') {
          throw new ContractValidationError(`scenario.lanterns[${idx}].ever_lit must be a boolean`, 2);
        }
        result.ever_lit = lo.ever_lit;
      }
      return result;
    });
  }

  return scenario;
}
