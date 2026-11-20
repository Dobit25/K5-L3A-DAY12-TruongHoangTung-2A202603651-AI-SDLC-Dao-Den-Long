import * as THREE from 'three';
import { DT, PALETTE } from '../core/config.js';
import { getNightMap } from '../core/maps.js';
import { DeterministicRng } from '../core/prng.js';

interface BenchShade {
  x: number;
  z: number;
  angle: number;
}

function round1(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 10) / 10;
  return r === 0 ? 0 : r;
}

/**
 * Standardized Phase 4 Benchmark Scene (Ticket-04 Section 1):
 * - 1280x720 Night 1 with full lighting & shadows (no extra creative entities)
 * - Exactly 200 wandering Shades (seed-driven) + 100 Motes (InstancedMesh for high FPS)
 * - L1-L3 lit with fuel=100 (ambient intensity = 0.15 + 0.55 * 3/5 = 0.48), L4-L5 unlit
 * - Mây stationary at (0,0,0)
 * - Camera orbits (0,0,0) at R=30m, Y=15m, starting at 0° (30,15,0), CCW from above, 15s/rev
 * - 3s warmup (unmeasured), then measures exact durationS seconds and POSTs to /__bench_result
 */
export function runBenchmarkScene(
  container: HTMLElement,
  seed = 42,
  durationS = 30,
  captureScreenshot = false
): void {
  const pageStartMs = performance.now();
  const rng = new DeterministicRng(seed);
  const map = getNightMap(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.013);

  const camera = new THREE.PerspectiveCamera(58, 1280 / 720, 0.1, 260);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: captureScreenshot,
  });
  renderer.setSize(1280, 720, false);
  renderer.domElement.style.cssText = 'width:100vw;height:100vh;display:block;';
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Full Night 1 lighting (3/5 lanterns lit => 0.15 + 0.55 * 0.6 = 0.48)
  scene.add(new THREE.AmbientLight(0xdce6ff, 0.48));
  scene.add(new THREE.HemisphereLight(0x4b629e, PALETTE.cloudSea, 0.45));
  const moonLight = new THREE.DirectionalLight(0xc8d8ff, 0.85);
  moonLight.position.set(28, 48, 22);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  scene.add(moonLight);

  // Night 1 island (R=40) + cloud sea
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(40, 36, 5, 64),
    new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.92 })
  );
  island.position.y = -2.5;
  island.receiveShadow = true;
  scene.add(island);

  const sandRing = new THREE.Mesh(
    new THREE.RingGeometry(36, 40, 64),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9 })
  );
  sandRing.rotation.x = -Math.PI / 2;
  sandRing.position.y = 0.02;
  scene.add(sandRing);

  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(200, 32),
    new THREE.MeshStandardMaterial({ color: PALETTE.cloudSea, roughness: 1 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -10.5;
  scene.add(sea);

  // Stationary Mây at (0,0,0) with shadows matching live Night 1
  const may = new THREE.Group();
  const cloak = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.25, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.mayRobe })
  );
  cloak.position.y = 0.65;
  cloak.castShadow = true;
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 0.45, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand })
  );
  hat.position.y = 1.78;
  hat.castShadow = true;
  const playerLight = new THREE.PointLight(PALETTE.lanternLit, 1.6, 14);
  playerLight.position.set(0, 1.4, 0.75);
  may.add(cloak, hat, playerLight);
  scene.add(may);

  // 5 Great Lanterns (L1-L3 lit with fuel=100, L4-L5 unlit)
  const litLanternPositions: Array<[number, number]> = [];
  const poleGeo = new THREE.CylinderGeometry(0.16, 0.24, 3.2, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood });
  const bulbGeo = new THREE.OctahedronGeometry(0.55, 1);

  map.lanterns.forEach((l, idx) => {
    const isLit = idx < 3; // L1, L2, L3 lit
    if (isLit) litLanternPositions.push([l.pos[0], l.pos[2]]);
    const g = new THREE.Group();
    g.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.6;
    const bulb = new THREE.Mesh(
      bulbGeo,
      new THREE.MeshStandardMaterial({
        color: isLit ? PALETTE.lanternCore : PALETTE.lanternOff,
        emissive: PALETTE.lanternLit,
        emissiveIntensity: isLit ? 1.7 : 0,
      })
    );
    bulb.position.y = 3.4;
    if (!isLit) bulb.scale.set(1, 0.8, 1);
    g.add(pole, bulb);
    if (isLit) {
      const pl = new THREE.PointLight(PALETTE.lanternLit, 11, 26);
      pl.position.set(0, 3.5, 0);
      g.add(pl);
    }
    scene.add(g);
  });

  // 100 Motes via single InstancedMesh
  const MOTE_COUNT = 100;
  const moteMesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshStandardMaterial({
      color: PALETTE.moteCore,
      emissive: PALETTE.moteHalo,
      emissiveIntensity: 1.4,
    }),
    MOTE_COUNT
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < MOTE_COUNT; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 38;
    dummy.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r);
    dummy.updateMatrix();
    moteMesh.setMatrixAt(i, dummy.matrix);
  }
  moteMesh.instanceMatrix.needsUpdate = true;
  scene.add(moteMesh);

  // 200 Shades in wander state via single InstancedMesh
  const SHADE_COUNT = 200;
  const shades: BenchShade[] = [];
  for (let i = 0; i < SHADE_COUNT; i++) {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * 38;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (litLanternPositions.every(([lx, lz]) => Math.hypot(x - lx, z - lz) > 6.1)) {
        break;
      }
    }
    shades.push({ x, z, angle: rng.range(0, Math.PI * 2) });
  }

  const shadeGeo = new THREE.SphereGeometry(0.7, 10, 8);
  shadeGeo.scale(1, 1.35, 1);
  const shadeMesh = new THREE.InstancedMesh(
    shadeGeo,
    new THREE.MeshStandardMaterial({
      color: PALETTE.shadeBody,
      emissive: PALETTE.shadeRim,
      emissiveIntensity: 0.45,
    }),
    SHADE_COUNT
  );
  shadeMesh.castShadow = true;
  scene.add(shadeMesh);

  // HUD banner (minimal)
  const badge = document.createElement('div');
  badge.style.cssText =
    'position:absolute;top:12px;left:12px;padding:6px 12px;border-radius:8px;background:rgba(14,20,48,0.8);color:#F5F1E6;font-size:18px;font-weight:700;';
  badge.textContent = `Benchmark v1.3 · 200 Shades · 100 Motes · Seed ${seed}`;
  container.appendChild(badge);

  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'WebGL2';

  const WARMUP_MS = 3000;
  const DURATION_MS = durationS * 1000;
  const frameDts: number[] = [];

  let firstFrameSent = false;
  let screenshotSent = false;
  let benchStartMs = 0;
  let prevMs = performance.now();
  let orbitAngle = 0;
  let accum = 0;
  let peakHeapMb: number | null = null;

  const updateShadesTick = () => {
    const step = 4.0 * 0.45 * DT;
    for (let i = 0; i < SHADE_COUNT; i++) {
      const s = shades[i];
      let nx = s.x + Math.cos(s.angle) * step;
      let nz = s.z + Math.sin(s.angle) * step;
      if (Math.hypot(nx, nz) > 39.2) {
        s.angle += Math.PI * 0.75;
        nx = s.x;
        nz = s.z;
      }
      for (const [lx, lz] of litLanternPositions) {
        const dx = nx - lx;
        const dz = nz - lz;
        const d = Math.hypot(dx, dz);
        if (d < 6.05) {
          const ux = d > 1e-6 ? dx / d : 1;
          const uz = d > 1e-6 ? dz / d : 0;
          nx = lx + ux * 6.05;
          nz = lz + uz * 6.05;
          s.angle += Math.PI * 0.6;
        }
      }
      s.x = nx;
      s.z = nz;
    }
  };

  const syncMatrices = () => {
    for (let i = 0; i < SHADE_COUNT; i++) {
      const s = shades[i];
      dummy.position.set(s.x, 0.95, s.z);
      dummy.updateMatrix();
      shadeMesh.setMatrixAt(i, dummy.matrix);
    }
    shadeMesh.instanceMatrix.needsUpdate = true;
  };

  const finishBenchmark = () => {
    const n = frameDts.length;
    const sumDt = frameDts.reduce((a, b) => a + b, 0);
    const avgFps = n > 0 && sumDt > 0 ? round1((1000 * n) / sumDt) : 0;

    const sortedDesc = [...frameDts].sort((a, b) => b - a);
    const k = Math.max(1, Math.ceil(0.01 * n));
    const avgTopK = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
    const p1LowFps = avgTopK > 0 ? round1(1000 / avgTopK) : 0;

    const sortedAsc = [...frameDts].sort((a, b) => a - b);
    const p95Idx = Math.min(n - 1, Math.floor(0.95 * (n - 1)));
    const p95Ms = n > 0 ? round1(sortedAsc[p95Idx]) : 0;

    const payload = {
      avg_fps: avgFps,
      p1_low_fps: p1LowFps,
      frame_ms_p95: p95Ms,
      frames: n,
      first_frame_elapsed_ms: Math.round(benchStartMs - pageStartMs),
      peak_mem_mb: peakHeapMb !== null ? round1(peakHeapMb) : null,
      renderer: `Three.js 0.170 (${glRenderer})`,
    };

    void fetch('/__bench_result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const loop = (now: number) => {
    const dtMs = now - prevMs;
    prevMs = now;

    if (!firstFrameSent) {
      firstFrameSent = true;
      benchStartMs = now;
      void fetch('/__bench_ready', { method: 'POST' });
    }

    const elapsed = now - benchStartMs;
    const dtSec = Math.min(0.1, dtMs / 1000);

    // Camera orbit: R=30m, Y=15m, start (30,15,0) at 0°, CCW from above (+X -> -Z), 15s/rev
    orbitAngle += ((Math.PI * 2) / 15) * dtSec;
    camera.position.set(Math.cos(orbitAngle) * 30, 15, -Math.sin(orbitAngle) * 30);
    camera.lookAt(0, 0, 0);

    accum += dtSec;
    let ticks = 0;
    while (accum >= DT && ticks < 5) {
      updateShadesTick();
      accum -= DT;
      ticks++;
    }
    syncMatrices();
    renderer.render(scene, camera);

    // Optional JS heap sample if Chrome exposes performance.memory
    const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (perfMem && Number.isFinite(perfMem.usedJSHeapSize)) {
      const mb = perfMem.usedJSHeapSize / (1024 * 1024);
      if (peakHeapMb === null || mb > peakHeapMb) peakHeapMb = mb;
    }

    if (elapsed >= WARMUP_MS) {
      if (captureScreenshot && !screenshotSent) {
        screenshotSent = true;
        try {
          const dataUrl = renderer.domElement.toDataURL('image/png');
          void fetch('/__bench_screenshot', { method: 'POST', body: dataUrl });
        } catch {
          // ignore screenshot error
        }
      }
      if (dtMs > 0) frameDts.push(dtMs);
      if (elapsed >= WARMUP_MS + DURATION_MS) {
        finishBenchmark();
        return;
      }
    }

    requestAnimationFrame(loop);
  };

  syncMatrices();
  camera.position.set(30, 15, 0);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

