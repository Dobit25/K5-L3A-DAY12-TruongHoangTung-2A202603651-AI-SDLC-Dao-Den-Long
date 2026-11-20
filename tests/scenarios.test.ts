import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cliPath = path.resolve(process.cwd(), 'dist-cli/cli/headless.js');
const winScenario = path.resolve(process.cwd(), 'tests/fixtures/phase1-win-scenario.json');
const winInputs = path.resolve(process.cwd(), 'tests/fixtures/phase1-win-inputs.json');

describe('Headless CLI end-to-end & determinism', () => {
  it('runs win scenario via built CLI with valid JSONL order and exact score match', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-e2e-'));
    const out1 = path.join(tmpDir, 'run1.jsonl');
    const out2 = path.join(tmpDir, 'run2.jsonl');

    const args1 = [
      cliPath,
      '--seed',
      '2026',
      '--night',
      '1',
      '--scenario',
      winScenario,
      '--inputs',
      winInputs,
      '--ticks',
      '300',
      '--snapshot-every',
      '20',
      '--out',
      out1,
    ];
    const args2 = [...args1.slice(0, -1), out2];

    execFileSync(process.execPath, args1, { stdio: 'pipe' });
    execFileSync(process.execPath, args2, { stdio: 'pipe' });

    const text1 = fs.readFileSync(out1, 'utf8');
    const text2 = fs.readFileSync(out2, 'utf8');
    // Strict byte-for-byte determinism check
    expect(text1).toBe(text2);

    const lines = text1.trim().split('\n').map((l) => JSON.parse(l));
    // First line must be tick 0 snapshot
    expect(lines[0].type).toBe('snapshot');
    expect(lines[0].tick).toBe(0);
    // Last line must be end
    const end = lines[lines.length - 1];
    expect(end.type).toBe('end');
    expect(end.state).toBe('won');
    expect(end.ticks).toBe(116);

    // Must contain 2 mote_picked, 1 deposit, 1 lantern_lit, 1 game_over (won, all_lit)
    const events = lines.filter((r) => r.type === 'event');
    expect(events.filter((e) => e.name === 'mote_picked')).toHaveLength(2);
    expect(events.some((e) => e.name === 'deposit' && e.data.amount === 5)).toBe(true);
    expect(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1')).toBe(true);
    expect(
      events.some(
        (e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'
      )
    ).toBe(true);

    // Events in a tick must appear before snapshot of the same tick
    for (let i = 1; i < lines.length - 1; i++) {
      if (lines[i].type === 'event' && lines[i - 1].type === 'snapshot') {
        expect(lines[i].tick).toBeGreaterThan(lines[i - 1].tick);
      }
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('produces identical output across two runs with random_motes and random_shades enabled', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-det-'));
    const out1 = path.join(tmpDir, 'rand1.jsonl');
    const out2 = path.join(tmpDir, 'rand2.jsonl');

    execFileSync(
      process.execPath,
      [cliPath, '--seed', '777', '--night', '1', '--ticks', '600', '--snapshot-every', '60', '--out', out1],
      { stdio: 'pipe' }
    );
    execFileSync(
      process.execPath,
      [cliPath, '--seed', '777', '--night', '1', '--ticks', '600', '--snapshot-every', '60', '--out', out2],
      { stdio: 'pipe' }
    );

    expect(fs.readFileSync(out1, 'utf8')).toBe(fs.readFileSync(out2, 'utf8'));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

