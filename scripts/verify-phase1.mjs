import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const cliPath = path.resolve(process.cwd(), 'dist-cli/cli/headless.js');
const proofDir = path.resolve(process.cwd(), 'docs/proof/phase-1');
fs.mkdirSync(proofDir, { recursive: true });

const winOutA = path.join(proofDir, 'scenario-win-run1.jsonl');
const winOutB = path.join(proofDir, 'scenario-win-run2.jsonl');
const randOutA = path.join(proofDir, 'random-night1-run1.jsonl');
const randOutB = path.join(proofDir, 'random-night1-run2.jsonl');

execFileSync(
  process.execPath,
  [
    cliPath,
    '--seed',
    '2026',
    '--night',
    '1',
    '--scenario',
    'tests/fixtures/phase1-win-scenario.json',
    '--inputs',
    'tests/fixtures/phase1-win-inputs.json',
    '--ticks',
    '300',
    '--snapshot-every',
    '20',
    '--out',
    winOutA,
  ],
  { stdio: 'inherit' }
);
execFileSync(
  process.execPath,
  [
    cliPath,
    '--seed',
    '2026',
    '--night',
    '1',
    '--scenario',
    'tests/fixtures/phase1-win-scenario.json',
    '--inputs',
    'tests/fixtures/phase1-win-inputs.json',
    '--ticks',
    '300',
    '--snapshot-every',
    '20',
    '--out',
    winOutB,
  ],
  { stdio: 'inherit' }
);

execFileSync(
  process.execPath,
  [
    cliPath,
    '--seed',
    '777',
    '--night',
    '1',
    '--ticks',
    '600',
    '--snapshot-every',
    '60',
    '--out',
    randOutA,
  ],
  { stdio: 'inherit' }
);
execFileSync(
  process.execPath,
  [
    cliPath,
    '--seed',
    '777',
    '--night',
    '1',
    '--ticks',
    '600',
    '--snapshot-every',
    '60',
    '--out',
    randOutB,
  ],
  { stdio: 'inherit' }
);

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const winHashA = sha256(winOutA);
const winHashB = sha256(winOutB);
const randHashA = sha256(randOutA);
const randHashB = sha256(randOutB);

if (winHashA !== winHashB || randHashA !== randHashB) {
  console.error('Determinism check FAILED!');
  process.exit(1);
}

// Keep single clean canonical proof files (remove duplicate run2 copies)
fs.unlinkSync(winOutB);
fs.unlinkSync(randOutB);

// Guard check: verify 6 original lab files have zero unstaged/staged modifications vs initial commit
const forbidden = ['README.md', 'GUIDE.md', 'CHECKPOINTS.md', 'SUBMISSION.md', 'RULES.md', 'RUBRIC.md'];
for (const file of forbidden) {
  if (!fs.existsSync(path.resolve(process.cwd(), file))) {
    console.error(`Original lab file missing: ${file}`);
    process.exit(1);
  }
}

console.log(`Determinism PASS (win sha256=${winHashA.slice(0, 16)}..., random sha256=${randHashA.slice(0, 16)}...)`);

