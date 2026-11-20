import { DaoDenLongApp } from './render/game3d.js';

const root = document.getElementById('app');
if (root) {
  new DaoDenLongApp(root, 2026);
}
