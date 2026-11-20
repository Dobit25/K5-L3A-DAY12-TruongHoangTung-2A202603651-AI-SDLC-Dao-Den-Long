import { runBenchmarkScene } from './render/benchmark.js';
import { DaoDenLongApp } from './render/game3d.js';

const root = document.getElementById('app');
if (root) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('bench') === '1') {
    const seed = Number(params.get('seed') ?? '42');
    const duration = Number(params.get('duration') ?? '30');
    const capture = params.get('capture') === '1';
    runBenchmarkScene(root, Number.isInteger(seed) ? seed : 42, duration > 0 ? duration : 30, capture);
  } else {
    new DaoDenLongApp(root, 2026);
  }
}
