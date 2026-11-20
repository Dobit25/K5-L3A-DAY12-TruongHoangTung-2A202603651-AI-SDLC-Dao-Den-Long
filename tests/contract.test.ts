import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_TUNING } from '../src/core/config.js';
import { runHeadlessCli } from '../src/cli/headless.js';
import os from 'node:os';

describe('Test Contract v1.0 compliance', () => {
  it('game.contract.json matches engine DEFAULT_TUNING exactly', () => {
    const contractPath = path.resolve(process.cwd(), 'game.contract.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

    expect(contract.contract_version).toBe('1.0');
    expect(contract.team).toBe('2A202603651-TruongHoangTung');
    expect(contract.tuning).toEqual(DEFAULT_TUNING);
    expect(contract.tuning.lantern_count_night1).toBe(5);
  });

  it('returns exit code 1 on missing/invalid CLI flags', () => {
    const code = runHeadlessCli(['--seed', '1', '--night', '1']);
    expect(code).toBe(1);
  });

  it('returns exit code 2 on malformed inputs JSON (non-increasing ticks)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-contract-'));
    const badInputs = path.join(tmpDir, 'bad-inputs.json');
    const outPath = path.join(tmpDir, 'out.jsonl');
    fs.writeFileSync(
      badInputs,
      JSON.stringify({ frames: [{ tick: 5, move: [1, 0] }, { tick: 5, move: [0, 0] }] }),
      'utf8'
    );
    const code = runHeadlessCli([
      '--seed',
      '42',
      '--night',
      '1',
      '--inputs',
      badInputs,
      '--ticks',
      '20',
      '--out',
      outPath,
    ]);
    expect(code).toBe(2);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns exit code 2 on invalid scenario JSON and exit code 1 on empty numeric flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-contract-2-'));
    const badScenario = path.join(tmpDir, 'bad-scenario.json');
    const outPath = path.join(tmpDir, 'out.jsonl');
    fs.writeFileSync(badScenario, '{ not valid json', 'utf8');

    expect(
      runHeadlessCli([
        '--seed',
        '1',
        '--night',
        '1',
        '--scenario',
        badScenario,
        '--ticks',
        '10',
        '--out',
        outPath,
      ])
    ).toBe(2);

    expect(
      runHeadlessCli(['--seed', '', '--night', '1', '--ticks', '10', '--out', outPath])
    ).toBe(1);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

