import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameEngine } from '../core/engine.js';
import type { InputFile, ScenarioFile } from '../core/types.js';
import {
  ContractValidationError,
  validateInputFile,
  validateScenarioFile,
} from '../core/validation.js';

export interface CliArgs {
  seed: number;
  night: number;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

function parseStrictInt(raw: string, flag: string): number {
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new ContractValidationError(`${flag} must be an integer`, 1);
  }
  const val = Number(raw);
  if (!Number.isSafeInteger(val)) {
    throw new ContractValidationError(`${flag} must be a safe integer`, 1);
  }
  return val;
}

export function parseCliArgs(argv: string[]): CliArgs {
  let seed: number | undefined;
  let night: number | undefined;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let ticks: number | undefined;
  let outPath: string | undefined;
  let snapshotEvery = 10;

  // Support both "--flag value" and "--flag=value"
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
      if (i + 1 >= expanded.length) {
        throw new ContractValidationError(`Missing value for argument ${arg}`, 1);
      }
      return expanded[++i];
    };

    switch (arg) {
      case '--seed':
        seed = parseStrictInt(next(), '--seed');
        break;
      case '--night': {
        const val = parseStrictInt(next(), '--night');
        if (val !== 1 && val !== 2 && val !== 3) {
          throw new ContractValidationError('--night must be 1, 2, or 3', 1);
        }
        night = val;
        break;
      }
      case '--scenario':
        scenarioPath = next();
        break;
      case '--inputs':
        inputsPath = next();
        break;
      case '--ticks': {
        const val = parseStrictInt(next(), '--ticks');
        if (val < 0) {
          throw new ContractValidationError('--ticks must be a non-negative integer', 1);
        }
        ticks = val;
        break;
      }
      case '--out':
        outPath = next();
        break;
      case '--snapshot-every': {
        const val = parseStrictInt(next(), '--snapshot-every');
        if (val <= 0) {
          throw new ContractValidationError('--snapshot-every must be a positive integer', 1);
        }
        snapshotEvery = val;
        break;
      }
      default:
        throw new ContractValidationError(`Unknown argument: ${arg}`, 1);
    }
  }

  if (seed === undefined) throw new ContractValidationError('Missing required --seed', 1);
  if (night === undefined) throw new ContractValidationError('Missing required --night', 1);
  if (ticks === undefined) throw new ContractValidationError('Missing required --ticks', 1);
  if (!outPath) throw new ContractValidationError('Missing required --out', 1);

  return {
    seed,
    night,
    scenarioPath,
    inputsPath,
    ticks,
    outPath,
    snapshotEvery,
  };
}

function readJsonFile(filePath: string, label: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new ContractValidationError(
      `Failed to read ${label} file "${filePath}": ${(err as Error).message}`,
      2
    );
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new ContractValidationError(
      `Invalid JSON in ${label} file "${filePath}": ${(err as Error).message}`,
      2
    );
  }
}

export function runHeadlessCli(argv: string[]): number {
  try {
    const args = parseCliArgs(argv);

    let scenario: ScenarioFile | undefined;
    if (args.scenarioPath) {
      scenario = validateScenarioFile(readJsonFile(args.scenarioPath, 'scenario'));
    }

    let inputs: InputFile | undefined;
    if (args.inputsPath) {
      inputs = validateInputFile(readJsonFile(args.inputsPath, 'inputs'));
    }

    const engine = new GameEngine(args.seed, args.night, scenario);
    const records = engine.runHeadless(inputs, args.ticks, args.snapshotEvery);
    const jsonl = `${records.map((r) => JSON.stringify(r)).join('\n')}\n`;

    const dir = path.dirname(path.resolve(args.outPath));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.outPath, jsonl, 'utf8');
    return 0;
  } catch (err) {
    if (err instanceof ContractValidationError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return err.exitCode;
    }
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }
}

let isEntrypoint = false;
if (process.argv[1]) {
  try {
    isEntrypoint = fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    isEntrypoint = path.basename(process.argv[1]) === 'headless.js';
  }
}

if (isEntrypoint) {
  const code = runHeadlessCli(process.argv.slice(2));
  process.exit(code);
}
