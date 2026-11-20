import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  addLeaderboardEntry,
  formatIsoWithTimezone,
  isValidLeaderboardName,
  type LeaderboardEntry,
} from '../src/core/leaderboard.js';

describe('Phase 4 (Ticket-04) leaderboard, soak, and CLI export', () => {
  it('validates leaderboard names (3-12 chars ASCII + Vietnamese) and enforces top-10 tie-breaking', () => {
    expect(isValidLeaderboardName('May_01')).toBe(true);
    expect(isValidLeaderboardName('HoàngTùng')).toBe(true);
    expect(isValidLeaderboardName('ab')).toBe(false); // too short
    expect(isValidLeaderboardName('NameTooLong1234')).toBe(false); // > 12
    expect(isValidLeaderboardName('bad name')).toBe(false); // space rejected

    let entries: LeaderboardEntry[] = [];
    // Earlier achieved_at must rank above later on tied score
    entries = addLeaderboardEntry(entries, {
      name: 'LaterPlayer',
      score: 500,
      nights_won: 2,
      seed: 1,
      achieved_at: '2026-11-20T15:10:00+07:00',
    });
    entries = addLeaderboardEntry(entries, {
      name: 'EarlyPlayer',
      score: 500,
      nights_won: 2,
      seed: 2,
      achieved_at: '2026-11-20T15:05:00+07:00',
    });
    expect(entries[0].name).toBe('EarlyPlayer');
    expect(entries[1].name).toBe('LaterPlayer');

    // Fill past 10 entries -> strictly capped at top 10
    for (let i = 0; i < 12; i++) {
      entries = addLeaderboardEntry(entries, {
        name: `Player_${i}`,
        score: 100 + i * 50,
        nights_won: 1,
        seed: 10 + i,
      });
    }
    expect(entries).toHaveLength(10);
    expect(entries[0].score).toBe(650);
    expect(formatIsoWithTimezone(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('exports leaderboard JSON via run-game.mjs --export-leaderboard', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
    const outPath = path.join(tmpDir, 'exported.json');
    const runner = path.resolve(process.cwd(), 'scripts/run-game.mjs');

    execFileSync(process.execPath, [runner, '--export-leaderboard', outPath], { stdio: 'pipe' });
    const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(Array.isArray(parsed.entries)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs soak CLI cleanly in isolated process with 0 crashes and mem_end_mb <= 1.2 * mem_start_mb', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-soak-'));
    const outPath = path.join(tmpDir, 'soak.json');
    const soakCli = path.resolve(process.cwd(), 'dist-cli/cli/soak.js');

    execFileSync(
      process.execPath,
      ['--expose-gc', soakCli, '--seed', '7', '--nights', '3', '--out', outPath],
      { stdio: 'pipe' }
    );
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(report.nights).toBe(3);
    expect(report.crashes).toBe(0);
    expect(report.results).toHaveLength(3);
    expect(report.mem_end_mb).toBeLessThanOrEqual(report.mem_start_mb * 1.2);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
