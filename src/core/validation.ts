import type { InputFile, InputFrame, ScenarioFile, Vec3 } from './types.js';

export class ContractValidationError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = 'ContractValidationError';
    this.exitCode = exitCode;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function assertVec3(v: unknown, label: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isFiniteNumber)) {
    throw new ContractValidationError(`${label} must be an array of 3 finite numbers`, 2);
  }
  return [v[0], v[1], v[2]];
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
    if (!Number.isInteger(fo.tick) || (fo.tick as number) < 0) {
      throw new ContractValidationError(`frames[${i}].tick must be a non-negative integer`, 2);
    }
    const tick = fo.tick as number;
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

    for (const key of ['jump', 'interact', 'pulse', 'dash'] as const) {
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
    if (p.carried !== undefined) {
      if (!Number.isInteger(p.carried) || (p.carried as number) < 0) {
        throw new ContractValidationError('scenario.player.carried must be a non-negative integer', 2);
      }
      scenario.player.carried = p.carried as number;
    }
    if (p.flames !== undefined) {
      if (!Number.isInteger(p.flames) || (p.flames as number) < 0) {
        throw new ContractValidationError('scenario.player.flames must be a non-negative integer', 2);
      }
      scenario.player.flames = p.flames as number;
    }
  }

  if (obj.random_motes !== undefined) {
    if (typeof obj.random_motes !== 'boolean') {
      throw new ContractValidationError('scenario.random_motes must be a boolean', 2);
    }
    scenario.random_motes = obj.random_motes;
  }

  if (obj.random_shades !== undefined) {
    if (typeof obj.random_shades !== 'boolean') {
      throw new ContractValidationError('scenario.random_shades must be a boolean', 2);
    }
    scenario.random_shades = obj.random_shades;
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
        return { id: mo.id as string | undefined, pos };
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
      if (so.state !== undefined && typeof so.state !== 'string') {
        throw new ContractValidationError(`scenario.shades[${idx}].state must be a string`, 2);
      }
      return {
        id: so.id as string | undefined,
        pos,
        state: so.state as string | undefined,
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
      const result: { id: string; pos?: Vec3; deposited?: number; lit?: boolean } = { id: lo.id };
      if (lo.pos !== undefined) result.pos = assertVec3(lo.pos, `scenario.lanterns[${idx}].pos`);
      if (lo.deposited !== undefined) {
        if (!Number.isInteger(lo.deposited) || (lo.deposited as number) < 0) {
          throw new ContractValidationError(`scenario.lanterns[${idx}].deposited must be a non-negative integer`, 2);
        }
        result.deposited = lo.deposited as number;
      }
      if (lo.lit !== undefined) {
        if (typeof lo.lit !== 'boolean') {
          throw new ContractValidationError(`scenario.lanterns[${idx}].lit must be a boolean`, 2);
        }
        result.lit = lo.lit;
      }
      return result;
    });
  }

  return scenario;
}

