import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function parseArgs(argv) {
  let seed = 42;
  let duration = 30;
  let outPath = null;
  let screenshotPath = null;

  const expanded = [];
  for (const token of argv) {
    const eq = token.indexOf('=');
    if (token.startsWith('--') && eq > 2) {
      expanded.push(token.slice(0, eq), token.slice(eq + 1));
    } else {
      expanded.push(token);
    }
  }

  for (let i = 0; i < expanded.length; i++) {
    const a = expanded[i];
    const next = () => {
      if (i + 1 >= expanded.length) throw new Error(`Missing value for ${a}`);
      return expanded[++i];
    };
    if (a === '--seed') {
      const raw = next().trim();
      if (!/^-?\d+$/.test(raw)) throw new Error('--seed must be an integer');
      seed = Number(raw);
    } else if (a === '--duration') {
      const raw = next().trim();
      if (!raw) throw new Error('--duration must be > 0');
      duration = Number(raw);
    } else if (a === '--out') outPath = next();
    else if (a === '--screenshot') screenshotPath = next();
    else throw new Error(`Unknown argument: ${a}`);
  }

  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('--duration must be > 0');
  if (!outPath) throw new Error('Missing required --out');
  return { seed, duration, outPath, screenshotPath };
}

function findBrowserExecutable() {
  const envBin = process.env.BENCH_BROWSER;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const platform = process.platform;
  const candidates =
    platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge',
          ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function main() {
  const procStartMs = performance.now();
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html not found. Run "npm run build" first.');
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    throw new Error('No Chromium/Chrome/Edge executable found. Set BENCH_BROWSER env variable.');
  }

  let resolveBench;
  let rejectBench;
  let firstFrameMs = null;
  const benchPromise = new Promise((res, rej) => {
    resolveBench = res;
    rejectBench = rej;
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/__bench_ready' && req.method === 'POST') {
      if (firstFrameMs === null) {
        firstFrameMs = Math.round(performance.now() - procStartMs);
      }
      res.writeHead(200);
      res.end('ok');
      return;
    }

    if (url.pathname === '/__bench_result' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          resolveBench(payload);
        } catch (err) {
          res.writeHead(400);
          res.end('bad json');
          rejectBench(err);
        }
      });
      return;
    }

    if (url.pathname === '/__bench_screenshot' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        try {
          if (args.screenshotPath && body.startsWith('data:image/png;base64,')) {
            const b64 = body.slice('data:image/png;base64,'.length);
            fs.mkdirSync(path.dirname(path.resolve(args.screenshotPath)), { recursive: true });
            fs.writeFileSync(args.screenshotPath, Buffer.from(b64, 'base64'));
          }
          res.writeHead(200);
          res.end('ok');
        } catch {
          res.writeHead(500);
          res.end('err');
        }
      });
      return;
    }

    const relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const distPrefix = distDir.endsWith(path.sep) ? distDir : distDir + path.sep;
    let filePath = path.resolve(distDir, relPath);
    if (
      (filePath !== distDir && !filePath.startsWith(distPrefix)) ||
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory()
    ) {
      filePath = path.join(distDir, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4173;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));

  const benchUrl = `http://127.0.0.1:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}${
    args.screenshotPath ? '&capture=1' : ''
  }`;

  const chromeArgs = [
    `--app=${benchUrl}`,
    '--window-size=1280,720',
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
  ];
  if (process.env.BENCH_HEADLESS === '1') {
    chromeArgs.push('--headless=new', '--enable-unsafe-swiftshader');
  }

  const child = spawn(browserBin, chromeArgs, { stdio: 'ignore' });

  const timeoutMs = (args.duration + 25) * 1000;
  const timer = setTimeout(() => {
    rejectBench(new Error(`Benchmark timed out after ${timeoutMs / 1000}s`));
  }, timeoutMs);

  try {
    const raw = await benchPromise;
    clearTimeout(timer);

    const loadMs = firstFrameMs ?? Math.round(raw.first_frame_elapsed_ms ?? performance.now() - procStartMs);
    const outObj = {
      contract_version: '1.3',
      avg_fps: raw.avg_fps,
      p1_low_fps: raw.p1_low_fps,
      frame_ms_p95: raw.frame_ms_p95,
      frames: raw.frames,
      load_ms: loadMs,
      peak_mem_mb: raw.peak_mem_mb ?? null,
      vsync_off: true,
      renderer: raw.renderer || `Three.js 0.170 WebGL (${path.basename(browserBin)})`,
      os: `${os.platform()} ${os.release()} (${os.arch()})`,
    };

    fs.mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
    fs.writeFileSync(args.outPath, `${JSON.stringify(outObj, null, 2)}\n`, 'utf8');
  } finally {
    clearTimeout(timer);
    try {
      child.kill();
    } catch {
      // ignore
    }
    server.close();
    await new Promise((r) => setTimeout(r, 350));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore locked temp cleanup on Windows
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    process.stderr.write(`Benchmark error: ${err.message}\n`);
    process.exit(1);
  });
