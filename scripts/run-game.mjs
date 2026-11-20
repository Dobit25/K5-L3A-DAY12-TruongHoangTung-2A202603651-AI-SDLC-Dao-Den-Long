import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const distPrefix = distDir.endsWith(path.sep) ? distDir : distDir + path.sep;
const dataDir = path.join(rootDir, 'data');
const leaderboardPath = path.join(dataDir, 'leaderboard.json');

const NAME_REGEX = /^[\p{L}\p{N}_]{3,12}$/u;
const ISO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function formatIsoWithTimezone(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(
    Math.floor(absOffset / 60)
  )}:${pad(absOffset % 60)}`;
}

function sanitizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const name = String(e.name ?? '').trim().normalize('NFC');
  if (!NAME_REGEX.test(name)) return null;
  const achievedAt =
    typeof e.achieved_at === 'string' && ISO_TZ_REGEX.test(e.achieved_at)
      ? e.achieved_at
      : formatIsoWithTimezone();
  return {
    name,
    score: Math.max(0, Math.floor(Number(e.score) || 0)),
    nights_won: Math.max(0, Math.min(3, Math.floor(Number(e.nights_won) || 0))),
    achieved_at: achievedAt,
    seed: (Number(e.seed) || 0) | 0,
  };
}

function sortEntries(entries) {
  return entries
    .map(sanitizeEntry)
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at);
      const tb = Date.parse(b.achieved_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.achieved_at < b.achieved_at ? -1 : a.achieved_at > b.achieved_at ? 1 : 0;
    })
    .slice(0, 10);
}

function readLeaderboard() {
  try {
    const raw = JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
    if (raw && Array.isArray(raw.entries)) {
      return { entries: sortEntries(raw.entries) };
    }
  } catch {
    // file does not exist yet
  }
  return { entries: [] };
}

function writeLeaderboard(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  const payload = { entries: sortEntries(data.entries || []) };
  fs.writeFileSync(leaderboardPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

// Expand both "--export-leaderboard out.json" and "--export-leaderboard=out.json"
const expandedArgv = [];
for (const token of process.argv.slice(2)) {
  const eq = token.indexOf('=');
  if (token.startsWith('--') && eq > 2) {
    expandedArgv.push(token.slice(0, eq), token.slice(eq + 1));
  } else {
    expandedArgv.push(token);
  }
}

const exportIdx = expandedArgv.indexOf('--export-leaderboard');
if (exportIdx !== -1) {
  const outPath = expandedArgv[exportIdx + 1];
  if (!outPath) {
    process.stderr.write('Error: Missing output file path after --export-leaderboard\n');
    process.exit(1);
  }
  const lb = readLeaderboard();
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(lb, null, 2)}\n`, 'utf8');
  process.exit(0);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  process.stderr.write('Error: dist/index.html not found. Run "npm run build" first.\n');
  process.exit(1);
}

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const lb = readLeaderboard();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(lb));
    return;
  }

  if (url.pathname === '/api/leaderboard' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const entry = sanitizeEntry(parsed);
        if (!entry) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid name (3-12 chars [A-Za-z0-9_] or Vietnamese letters)' }));
          return;
        }
        const current = readLeaderboard();
        const updated = writeLeaderboard({ entries: [...current.entries, entry] });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(updated));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  const relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  let filePath = path.resolve(distDir, relPath);
  if (
    (filePath !== distDir && !filePath.startsWith(distPrefix)) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Đảo Đèn Lồng running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(`Leaderboard disk file: ${leaderboardPath}`);
});
