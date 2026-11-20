import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TICK_RATE } from '../core/config.js';
import { createDefaultInput, GameEngine, round1 } from '../core/engine.js';
import { DeterministicRng } from '../core/prng.js';
import type { NightNumber } from '../core/types.js';

export interface SoakArgs {
  seed: number;
  nights: number;
  outPath: string;
}

export interface SoakReport {
  nights: number;
  crashes: number;
  results: Array<'won' | 'lost'>;
  mem_start_mb: number;
  mem_end_mb: number;
  duration_s: number;
}

function parseStrictInt(raw: string, flag: string): number {
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new Error(`${flag} must be an integer`);
  }
  const v = Number(raw);
  if (!Number.isSafeInteger(v)) throw new Error(`${flag} must be a safe integer`);
  return v;
}

export function parseSoakArgs(argv: string[]): SoakArgs {
  let seed = 7;
  let nights = 10;
  let outPath: string | undefined;

  const expanded: string[] = [];
  for (const token of argv) {
    const eqIdx = token.indexOf('=');
    if (token.startsWith('--') && eqIdx > 2) {
      expanded.push(token.slice(0, eqIdx), token.slice(eqIdx + 1));
    } else {
      expanded.push(token);
    }
  }

  for (let i = 0; i < expanded.length; i++) {
    const arg = expanded[i];
    const next = () => {
      if (i + 1 >= expanded.length) throw new Error(`Missing value for ${arg}`);
      return expanded[++i];
    };
    switch (arg) {
      case '--seed':
        seed = parseStrictInt(next(), '--seed');
        break;
      case '--nights':
        nights = parseStrictInt(next(), '--nights');
        if (nights <= 0) throw new Error('--nights must be positive');
        break;
      case '--out':
        outPath = next();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!outPath) throw new Error('Missing required --out');
  return { seed, nights, outPath };
}

function rssMb(): number {
  return round1(process.memoryUsage().rss / (1024 * 1024));
}

function tryGc(): void {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === 'function') {
    g.gc();
  }
}

export function runSoak(seed: number, nights: number): SoakReport {
  // Warm up V8 JIT and SemiSpace/OldSpace across a full Night 1 (14,400 ticks) + Night 3 (3,600 ticks)
  // before measuring Night 1 RSS so Linux glibc/V8 committed pages reach steady state.
  for (const [warmNight, warmTicks] of [
    [1, 14400],
    [3, 3600],
  ] as const) {
    const warm = new GameEngine(seed + warmNight, warmNight);
    const warmRng = new DeterministicRng(((seed + warmNight) ^ 0x517cc1b7) | 0);
    const warmIn = createDefaultInput();
    for (let w = 0; w < warmTicks && warm.state === 'playing'; w++) {
      if (w % 30 === 0) {
        const a = warmRng.range(0, Math.PI * 2);
        warmIn.move = [Math.cos(a), Math.sin(a)];
      }
      warmIn.jump = warmRng.next() < 0.05;
      warmIn.dash = warmRng.next() < 0.03;
      warmIn.pulse = warmRng.next() < 0.02;
      warmIn.interact = warmRng.next() < 0.1;
      warm.step(warmIn);
    }
  }
  tryGc();
  tryGc();

  const t0 = performance.now();
  const results: Array<'won' | 'lost'> = [];
  let crashes = 0;
  let memStartMb = rssMb();

  for (let i = 0; i < nights; i++) {
    const night = ((i % 3) + 1) as NightNumber;
    const nightSeed = seed + i;
    try {
      let engine: GameEngine | null = new GameEngine(nightSeed, night);
      if (i === 0) {
        memStartMb = rssMb();
      }
      const inputRng = new DeterministicRng((nightSeed ^ 0x9e3779b9) | 0);
      const maxTicks = engine.map.durationS * TICK_RATE + 10;
      const input = createDefaultInput();

      for (let k = 0; k < maxTicks && engine.state === 'playing'; k++) {
        if (k % 30 === 0) {
          const angle = inputRng.range(0, Math.PI * 2);
          input.move = [Math.cos(angle), Math.sin(angle)];
        }
        input.jump = inputRng.next() < 0.05;
        input.dash = inputRng.next() < 0.03;
        input.pulse = inputRng.next() < 0.02;
        input.interact = inputRng.next() < 0.1;
        engine.step(input);
      }

      results.push(engine.state === 'won' ? 'won' : 'lost');
      engine = null;
      tryGc();
    } catch {
      crashes += 1;
      results.push('lost');
    }
  }

  tryGc();
  const memEndMb = rssMb();
  const durationS = round1((performance.now() - t0) / 1000);

  return {
    nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };
}

export function runSoakCli(argv: string[]): number {
  try {
    const args = parseSoakArgs(argv);
    const report = runSoak(args.seed, args.nights);
    const dir = path.dirname(path.resolve(args.outPath));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return 0;
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }
}

let isEntrypoint = false;
if (process.argv[1]) {
  try {
    isEntrypoint =
      fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    isEntrypoint = path.basename(process.argv[1]) === 'soak.js';
  }
}

if (isEntrypoint) {
  process.exit(runSoakCli(process.argv.slice(2)));
}
