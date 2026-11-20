import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const cliPath = path.resolve(process.cwd(), 'dist-cli/cli/headless.js');
const proofDir = path.resolve(process.cwd(), 'docs/proof/phase-2');
fs.mkdirSync(proofDir, { recursive: true });

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const hashes = {};
for (const night of [1, 2, 3]) {
  const outA = path.join(proofDir, `night${night}-run1.jsonl`);
  const outB = path.join(proofDir, `night${night}-run2.jsonl`);
  const t0 = performance.now();
  execFileSync(
    process.execPath,
    [cliPath, '--seed', '2026', '--night', String(night), '--ticks', '1800', '--snapshot-every', '120', '--out', outA],
    { stdio: 'pipe' }
  );
  const elapsedMs = Math.round(performance.now() - t0);
  execFileSync(
    process.execPath,
    [cliPath, '--seed', '2026', '--night', String(night), '--ticks', '1800', '--snapshot-every', '120', '--out', outB],
    { stdio: 'pipe' }
  );
  const hA = sha256(outA);
  const hB = sha256(outB);
  if (hA !== hB) {
    console.error(`Determinism FAILED for Night ${night}`);
    process.exit(1);
  }
  fs.unlinkSync(outB);
  hashes[`night${night}`] = { sha256: hA.slice(0, 16), ms: elapsedMs };
}

// Full Night 3 (21,600 ticks) headless speed benchmark (DoD: <= 30s)
const fullOut = path.join(proofDir, 'night3-full-21600.jsonl');
const tFull = performance.now();
execFileSync(
  process.execPath,
  [cliPath, '--seed', '2026', '--night', '3', '--ticks', '21600', '--snapshot-every', '600', '--out', fullOut],
  { stdio: 'pipe' }
);
const fullMs = Math.round(performance.now() - tFull);
if (fullMs > 30_000) {
  console.error(`Night 3 21,600-tick benchmark exceeded 30s: ${fullMs}ms`);
  process.exit(1);
}

// Original 6 lab files check
for (const file of ['README.md', 'GUIDE.md', 'CHECKPOINTS.md', 'SUBMISSION.md', 'RULES.md', 'RUBRIC.md']) {
  if (!fs.existsSync(path.resolve(process.cwd(), file))) {
    console.error(`Original lab file missing: ${file}`);
    process.exit(1);
  }
}

console.log(
  `Phase 2 Determinism PASS | N1=${hashes.night1.sha256} (${hashes.night1.ms}ms) N2=${hashes.night2.sha256} (${hashes.night2.ms}ms) N3=${hashes.night3.sha256} (${hashes.night3.ms}ms) | Full Night 3 (21600 ticks) = ${fullMs}ms (<= 30000ms)`
);

