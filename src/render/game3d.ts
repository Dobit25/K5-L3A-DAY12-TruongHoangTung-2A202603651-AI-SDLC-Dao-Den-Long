import * as THREE from 'three';
import { DT, ISLAND_RADIUS } from '../core/config.js';
import { createDefaultInput, GameEngine } from '../core/engine.js';
import type { EventRecord, InputState, SnapshotRecord } from '../core/types.js';
import { LanternAudio } from './audio.js';

interface LanternVisual {
  id: string;
  group: THREE.Group;
  bulb: THREE.Mesh;
  bulbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
  safeRingMat: THREE.MeshBasicMaterial;
  progressRing: THREE.Mesh;
}

interface ShadeVisual {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  eyeLeftMat: THREE.MeshBasicMaterial;
  eyeRightMat: THREE.MeshBasicMaterial;
}

interface PulseWave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
  maxRadius: number;
}

export class DaoDenLongApp {
  private container: HTMLElement;
  private engine: GameEngine;
  private audio = new LanternAudio();

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private fog: THREE.FogExp2;
  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private moonLight: THREE.DirectionalLight;

  private playerGroup: THREE.Group;
  private playerHatLanternMat: THREE.MeshStandardMaterial;
  private playerLight: THREE.PointLight;
  private playerHeading = 0;

  private lanternVisuals = new Map<string, LanternVisual>();
  private moteMeshes = new Map<string, THREE.Mesh>();
  private shadeVisuals = new Map<string, ShadeVisual>();
  private pulseWaves: PulseWave[] = [];
  private clouds: THREE.Mesh[] = [];

  private keys = new Set<string>();
  private camYawDeg = 0;
  private isDragging = false;
  private lastPointerX = 0;

  private hudEl: HTMLDivElement;
  private overlayEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastTimer = 0;

  private accumulator = 0;
  private lastFrameMs = performance.now();
  private elapsedVisual = 0;
  private rafId = 0;

  constructor(container: HTMLElement, seed = 2026) {
    this.container = container;
    this.engine = new GameEngine(seed, 1);

    // Scene & twilight atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d1c);
    this.fog = new THREE.FogExp2(0x0a0d1c, 0.022);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lights (warm up as lanterns are lit)
    this.ambientLight = new THREE.AmbientLight(0x283556, 0.75);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x4c6099, 0x161a24, 0.55);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0x9cb4ff, 0.85);
    this.moonLight.position.set(25, 42, 18);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 120;
    const d = 48;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.scene.add(this.moonLight);

    this.buildIslandEnvironment();

    // Build Mây (player with conical hat & hanging mini lantern)
    const { group, lanternMat, light } = this.buildMayModel();
    this.playerGroup = group;
    this.playerHatLanternMat = lanternMat;
    this.playerLight = light;
    this.scene.add(this.playerGroup);

    // HUD & Overlays
    this.hudEl = this.createHud();
    this.toastEl = this.createToast();
    this.overlayEl = this.createOverlay();
    this.container.appendChild(this.hudEl);
    this.container.appendChild(this.toastEl);
    this.container.appendChild(this.overlayEl);

    this.syncVisualsFromSnapshot(this.engine.getSnapshot(), 0);
    this.bindEvents();
    this.loop(performance.now());
  }

  private buildIslandEnvironment(): void {
    // Circular island platform (top surface at Y = 0)
    const islandGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3.5, 4, 64);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x22303c,
      roughness: 0.92,
      metalness: 0.05,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -2;
    island.receiveShadow = true;
    this.scene.add(island);

    // Subtle stone path ring connecting the 5 lanterns
    const pathGeo = new THREE.RingGeometry(20.6, 23.4, 64);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x354454,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const pathRing = new THREE.Mesh(pathGeo, pathMat);
    pathRing.rotation.x = -Math.PI / 2;
    pathRing.position.y = 0.02;
    pathRing.receiveShadow = true;
    this.scene.add(pathRing);

    // Central compass shrine disk at (0, 0, 0)
    const centerGeo = new THREE.CircleGeometry(3.2, 32);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x414f61,
      roughness: 0.85,
    });
    const centerDisk = new THREE.Mesh(centerGeo, centerMat);
    centerDisk.rotation.x = -Math.PI / 2;
    centerDisk.position.y = 0.03;
    centerDisk.receiveShadow = true;
    this.scene.add(centerDisk);

    // Wooden pier on the edge of Đảo Bến
    const pierGroup = new THREE.Group();
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.1), plankMat);
      plank.position.set(0, 0.05, ISLAND_RADIUS - 1 + i * 1.25);
      plank.receiveShadow = true;
      pierGroup.add(plank);
    }
    this.scene.add(pierGroup);

    // Decorative stylized lantern-island pines & stones (outside paths, purely visual)
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x1c3b36, roughness: 0.85 });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + 0.25;
      const dist = 31 + (i % 3) * 3;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.8, 6), treeTrunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      const crown1 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.8, 7), treeLeafMat);
      crown1.position.y = 2.6;
      crown1.castShadow = true;
      const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 7), treeLeafMat);
      crown2.position.y = 4.0;
      crown2.castShadow = true;
      tree.add(trunk, crown1, crown2);
      tree.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.scene.add(tree);
    }

    // Sea of drifting clouds surrounding the island
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x1d2742,
      roughness: 1,
      transparent: true,
      opacity: 0.55,
    });
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = ISLAND_RADIUS + 14 + (i % 4) * 9;
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(5.5 + (i % 3) * 2.5, 10, 8), cloudMat);
      cloud.scale.set(1.8, 0.35, 1.3);
      cloud.position.set(Math.cos(angle) * r, -4.5 - (i % 2) * 1.5, Math.sin(angle) * r);
      cloud.userData = { angle, r };
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    // Starfield dome
    const starPositions: number[] = [];
    for (let i = 0; i < 320; i++) {
      const theta = ((i * 73.13) % 360) * (Math.PI / 180);
      const phi = (((i * 29.7) % 70) + 12) * (Math.PI / 180);
      const rad = 140;
      starPositions.push(
        rad * Math.cos(phi) * Math.cos(theta),
        rad * Math.sin(phi),
        rad * Math.cos(phi) * Math.sin(theta)
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffe9b8, size: 0.9, fog: false });
    this.scene.add(new THREE.Points(starGeo, starMat));
  }

  private buildMayModel(): {
    group: THREE.Group;
    lanternMat: THREE.MeshStandardMaterial;
    light: THREE.PointLight;
  } {
    const group = new THREE.Group();

    // Cloak / robe
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x3b6e8c, roughness: 0.75 })
    );
    cloak.position.y = 0.65;
    cloak.castShadow = true;
    group.add(cloak);

    // Scarf
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.09, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xe88b48, roughness: 0.7 })
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.18;
    group.add(scarf);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4d5b6, roughness: 0.65 })
    );
    head.position.y = 1.44;
    head.castShadow = true;
    group.add(head);

    // Conical hat (Nón lá)
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 0.45, 18),
      new THREE.MeshStandardMaterial({ color: 0xd9b36c, roughness: 0.85 })
    );
    hat.position.y = 1.78;
    hat.castShadow = true;
    group.add(hat);

    // Mini hanging lantern from the brim of Mây's conical hat
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1d })
    );
    cord.position.set(0, 1.48, 0.68);
    group.add(cord);

    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const miniLantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), lanternMat);
    miniLantern.position.set(0, 1.32, 0.68);
    group.add(miniLantern);

    const light = new THREE.PointLight(0xffb84d, 2.2, 14);
    light.position.set(0, 1.4, 0.75);
    group.add(light);

    return { group, lanternMat, light };
  }

  private createLanternVisual(id: string, pos: [number, number, number]): LanternVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.85, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 })
    );
    base.position.y = 0.275;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 3.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.85 })
    );
    pole.position.y = 1.85;
    pole.castShadow = true;
    group.add(pole);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 0.65, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.8 })
    );
    roof.position.y = 4.0;
    roof.castShadow = true;
    group.add(roof);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0x3a4052,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.0,
      roughness: 0.35,
    });
    const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), bulbMat);
    bulb.position.y = 3.35;
    group.add(bulb);

    const light = new THREE.PointLight(0xffb347, 0, 26);
    light.position.set(0, 3.5, 0);
    group.add(light);

    // Safe-zone ground ring (visible once lantern is lit)
    const safeR = this.engine.tuning.safe_radius ?? 6.0;
    const safeRingMat = new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const safeRing = new THREE.Mesh(new THREE.RingGeometry(safeR - 0.16, safeR, 48), safeRingMat);
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.05;
    group.add(safeRing);

    // Small deposit progress ring around base
    const progressRing = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.25, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    progressRing.rotation.x = -Math.PI / 2;
    progressRing.position.y = 0.06;
    group.add(progressRing);

    this.scene.add(group);
    return { id, group, bulb, bulbMat, light, safeRing, safeRingMat, progressRing };
  }

  private createShadeVisual(pos: [number, number, number]): ShadeVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x160a26,
      emissive: 0x3c1066,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), bodyMat);
    body.scale.set(1, 1.35, 1);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    const eyeLeftMat = new THREE.MeshBasicMaterial({ color: 0xc77dff });
    const eyeRightMat = new THREE.MeshBasicMaterial({ color: 0xc77dff });
    const eyeGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeLeftMat);
    eyeL.position.set(-0.24, 1.25, 0.62);
    const eyeR = new THREE.Mesh(eyeGeo, eyeRightMat);
    eyeR.position.set(0.24, 1.25, 0.62);
    group.add(eyeL, eyeR);

    this.scene.add(group);
    return { group, bodyMat, eyeLeftMat, eyeRightMat };
  }

  private spawnPulseWave(pos: [number, number, number]): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 40), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos[0], 0.25, pos[2]);
    this.scene.add(mesh);
    this.pulseWaves.push({
      mesh,
      mat,
      age: 0,
      maxAge: 0.45,
      maxRadius: this.engine.tuning.pulse_radius,
    });
  }

  private createHud(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.85);';
    return el;
  }

  private createToast(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;bottom:68px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:999px;background:rgba(20,24,42,0.82);border:1px solid rgba(255,209,102,0.5);color:#ffe8a3;font-weight:600;opacity:0;transition:opacity 0.25s;pointer-events:none;';
    return el;
  }

  private createOverlay(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(8,10,20,0.78);backdrop-filter:blur(4px);gap:14px;text-align:center;';
    return el;
  }

  private showToast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastTimer = 2.0;
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);
      if (code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.showToast(muted ? 'Âm thanh: TẮT' : 'Âm thanh: BẬT');
      }
      if (code === 'KeyR' && this.engine.state !== 'playing') {
        this.restart();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.camYawDeg = (this.camYawDeg - dx * 0.35 + 360) % 360;
    });
    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });
  }

  private buildCurrentInput(): InputState {
    const input = createDefaultInput();
    let mx = 0;
    let mz = 0;
    // Camera faces +Z at yaw=0; in right-handed Three.js, screen-right is -X and screen-left is +X
    if (this.keys.has('KeyA')) mx += 1;
    if (this.keys.has('KeyD')) mx -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz -= 1;

    if (this.keys.has('ArrowLeft')) this.camYawDeg = (this.camYawDeg + 1.8) % 360;
    if (this.keys.has('ArrowRight')) this.camYawDeg = (this.camYawDeg - 1.8 + 360) % 360;

    input.move = [mx, mz];
    input.cam_yaw_deg = this.camYawDeg;
    input.jump = this.keys.has('Space');
    input.interact = this.keys.has('KeyE') || this.keys.has('Enter');
    input.pulse = this.keys.has('KeyQ') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    return input;
  }

  private handleEvents(events: EventRecord[], snap: SnapshotRecord): void {
    for (const ev of events) {
      switch (ev.name) {
        case 'mote_picked':
          this.audio.playMotePickup(Number(ev.data.carried ?? 1));
          break;
        case 'deposit':
          this.audio.playDeposit();
          this.showToast(`Nạp +${ev.data.amount} ánh sáng vào ${ev.data.lantern_id}`);
          break;
        case 'lantern_lit':
          this.audio.playLanternLit();
          this.showToast(`Đã thắp sáng Đèn Lồng Lớn ${ev.data.lantern_id}!`);
          break;
        case 'pulse':
          this.audio.playPulse();
          this.spawnPulseWave(snap.player.pos);
          this.showToast(
            `Tỏa Sáng! Đẩy lùi ${(ev.data.stunned_ids as string[]).length} Bóng Mực`
          );
          break;
        case 'player_hit':
          this.audio.playHit();
          this.showToast(
            `Bị Bóng Mực chạm! Mất 1 ngọn lửa, rơi ${ev.data.dropped} đom đóm`
          );
          break;
        case 'game_over': {
          const won = ev.data.result === 'won';
          this.audio.playGameOver(won);
          this.showGameOverOverlay(won, String(ev.data.reason), snap.score);
          break;
        }
      }
    }
  }

  private showGameOverOverlay(won: boolean, reason: string, score: number): void {
    const title = won ? 'Đảo Bến Đã Bừng Sáng!' : 'Sương Đen Đã Nuốt Chửng Đảo';
    const subtitle =
      reason === 'all_lit'
        ? 'Mây đã thắp sáng cả 5 Đèn Lồng Lớn trước bình minh.'
        : reason === 'no_flames'
          ? 'Mây đã mất hết ngọn lửa bảo vệ.'
          : 'Hết thời gian Đêm 1 trước khi thắp đủ đèn.';

    this.overlayEl.innerHTML = `
      <div style="padding:28px 36px;border-radius:16px;background:rgba(16,22,40,0.94);border:1px solid ${
        won ? '#ffd166' : '#c77dff'
      };max-width:420px;">
        <h2 style="margin:0 0 8px;color:${won ? '#ffd166' : '#d89eff'};">${title}</h2>
        <p style="margin:0 0 14px;color:#d6dce8;">${subtitle}</p>
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:18px;">Điểm cuối: ${score}</div>
        <button id="replay-btn" style="padding:10px 24px;border:none;border-radius:10px;background:#ffb84d;color:#121629;font-weight:700;font-size:15px;cursor:pointer;">
          Chơi lại (R)
        </button>
      </div>
    `;
    this.overlayEl.style.display = 'flex';
    const btn = this.overlayEl.querySelector('#replay-btn');
    btn?.addEventListener('click', () => this.restart());
  }

  private restart(): void {
    // Clean dynamic visuals
    for (const m of this.moteMeshes.values()) this.scene.remove(m);
    this.moteMeshes.clear();
    for (const s of this.shadeVisuals.values()) this.scene.remove(s.group);
    this.shadeVisuals.clear();
    for (const l of this.lanternVisuals.values()) this.scene.remove(l.group);
    this.lanternVisuals.clear();

    this.engine = new GameEngine(Date.now() & 0x7fffffff, 1);
    this.overlayEl.style.display = 'none';
    this.syncVisualsFromSnapshot(this.engine.getSnapshot(), 0);
    this.showToast('Bắt đầu lại Đêm 1 — Đảo Bến');
  }

  private syncVisualsFromSnapshot(snap: SnapshotRecord, dtVisual: number): void {
    this.elapsedVisual += dtVisual;

    // Player transform & hat lantern glow
    const prevX = this.playerGroup.position.x;
    const prevZ = this.playerGroup.position.z;
    this.playerGroup.position.set(snap.player.pos[0], snap.player.pos[1], snap.player.pos[2]);
    const dx = snap.player.pos[0] - prevX;
    const dz = snap.player.pos[2] - prevZ;
    if (Math.hypot(dx, dz) > 0.005) {
      this.playerHeading = Math.atan2(dx, dz);
    }
    this.playerGroup.rotation.y = this.playerHeading;

    const carryFactor = snap.player.carried / Math.max(1, this.engine.tuning.carry_capacity);
    this.playerHatLanternMat.emissiveIntensity = 0.6 + carryFactor * 1.6;
    this.playerLight.intensity = 1.6 + carryFactor * 3.0;

    // Lanterns + island brightening as lanterns are lit
    let litCount = 0;
    for (const l of snap.lanterns) {
      if (l.lit) litCount++;
      let vis = this.lanternVisuals.get(l.id);
      if (!vis) {
        vis = this.createLanternVisual(l.id, l.pos);
        this.lanternVisuals.set(l.id, vis);
      }
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const ratio = l.deposited / Math.max(1, this.engine.tuning.lantern_cost);
      if (l.lit) {
        vis.bulbMat.color.setHex(0xffe194);
        vis.bulbMat.emissiveIntensity = 1.8 + Math.sin(this.elapsedVisual * 4) * 0.15;
        vis.light.intensity = 12;
        vis.safeRingMat.opacity = 0.28 + Math.sin(this.elapsedVisual * 2.5) * 0.06;
        vis.progressRing.scale.setScalar(1.1);
      } else {
        vis.bulbMat.color.setHex(ratio > 0 ? 0xa37c42 : 0x3a4052);
        vis.bulbMat.emissiveIntensity = ratio * 0.85;
        vis.light.intensity = ratio * 3.5;
        vis.safeRingMat.opacity = 0;
        vis.progressRing.scale.setScalar(0.6 + ratio * 0.5);
      }
    }

    // Atmosphere warms & fog lifts with each lit lantern
    const progress = litCount / Math.max(1, snap.lanterns.length);
    this.fog.density = 0.024 - progress * 0.013;
    const skyColor = new THREE.Color(0x0a0d1c).lerp(new THREE.Color(0x282338), progress);
    this.scene.background = skyColor;
    this.fog.color.copy(skyColor);
    this.ambientLight.intensity = 0.72 + progress * 0.65;
    this.ambientLight.color.setHex(0x283556).lerp(new THREE.Color(0x7c5c44), progress);

    // Motes
    const activeMoteIds = new Set<string>();
    for (const m of snap.motes) {
      activeMoteIds.add(m.id);
      let mesh = this.moteMeshes.get(m.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          new THREE.MeshStandardMaterial({
            color: 0xffe066,
            emissive: 0xffae2b,
            emissiveIntensity: 1.5,
          })
        );
        this.scene.add(mesh);
        this.moteMeshes.set(m.id, mesh);
      }
      const bob = 0.65 + Math.sin(this.elapsedVisual * 3.2 + m.pos[0]) * 0.2;
      mesh.position.set(m.pos[0], bob, m.pos[2]);
      mesh.rotation.y = this.elapsedVisual * 2;
    }
    for (const [id, mesh] of this.moteMeshes.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(mesh);
        this.moteMeshes.delete(id);
      }
    }

    // Shades
    const activeShadeIds = new Set<string>();
    for (const s of snap.shades) {
      activeShadeIds.add(s.id);
      let vis = this.shadeVisuals.get(s.id);
      if (!vis) {
        vis = this.createShadeVisual(s.pos);
        this.shadeVisuals.set(s.id, vis);
      }
      const hover = Math.sin(this.elapsedVisual * 4 + s.pos[0]) * 0.14;
      vis.group.position.set(s.pos[0], s.pos[1] + hover, s.pos[2]);
      vis.group.lookAt(snap.player.pos[0], s.pos[1] + 1, snap.player.pos[2]);
      if (s.state === 'stunned') {
        vis.bodyMat.emissive.setHex(0xffb84d);
        vis.bodyMat.emissiveIntensity = 0.85;
        vis.eyeLeftMat.color.setHex(0xffe066);
        vis.eyeRightMat.color.setHex(0xffe066);
      } else {
        vis.bodyMat.emissive.setHex(0x3c1066);
        vis.bodyMat.emissiveIntensity = 0.5;
        vis.eyeLeftMat.color.setHex(0xc77dff);
        vis.eyeRightMat.color.setHex(0xc77dff);
      }
    }
    for (const [id, vis] of this.shadeVisuals.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(vis.group);
        this.shadeVisuals.delete(id);
      }
    }

    // Pulse waves
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const w = this.pulseWaves[i];
      w.age += dtVisual;
      const t = Math.min(1, w.age / w.maxAge);
      w.mesh.scale.setScalar(1 + t * w.maxRadius);
      w.mat.opacity = 0.8 * (1 - t);
      if (w.age >= w.maxAge) {
        this.scene.remove(w.mesh);
        this.pulseWaves.splice(i, 1);
      }
    }

    // Drift clouds gently
    for (const c of this.clouds) {
      c.userData.angle += dtVisual * 0.015;
      c.position.x = Math.cos(c.userData.angle) * c.userData.r;
      c.position.z = Math.sin(c.userData.angle) * c.userData.r;
    }

    // Third-person camera matching cam_yaw_deg (+Z forward when yaw=0)
    const rad = (this.camYawDeg * Math.PI) / 180;
    const camDist = 11.5;
    const camHeight = 6.2;
    const targetCamX = snap.player.pos[0] - Math.sin(rad) * camDist;
    const targetCamZ = snap.player.pos[2] - Math.cos(rad) * camDist;
    this.camera.position.lerp(
      new THREE.Vector3(targetCamX, snap.player.pos[1] + camHeight, targetCamZ),
      0.16
    );
    this.camera.lookAt(snap.player.pos[0], snap.player.pos[1] + 1.4, snap.player.pos[2]);

    // Update HUD
    const debug = this.engine.getRuntimeDebugInfo();
    const mins = Math.floor(snap.time_left_s / 60);
    const secs = Math.floor(snap.time_left_s % 60)
      .toString()
      .padStart(2, '0');
    const pulseReady =
      snap.player.carried >= this.engine.tuning.pulse_cost && debug.pulse_cooldown_s <= 0;

    this.hudEl.innerHTML = `
      <div style="background:rgba(12,16,30,0.72);padding:10px 14px;border-radius:10px;border:1px solid rgba(255,209,102,0.28);line-height:1.55;">
        <div style="font-weight:700;color:#ffd166;font-size:15px;">Đêm 1 — Đảo Bến</div>
        <div>Ngọn lửa: <b style="color:#ff9f43;">${'🔥'.repeat(snap.player.flames)}</b> (${snap.player.flames}/${this.engine.tuning.flames})</div>
        <div>Đom đóm cầm: <b style="color:#ffe066;">${snap.player.carried}/${this.engine.tuning.carry_capacity}</b> · Trên đảo: ${snap.motes_active}</div>
        <div>Đèn Lồng Lớn: <b style="color:#ffd166;">${litCount}/${snap.lanterns.length}</b></div>
        <div>Tỏa Sáng (Q/Shift): <b style="color:${pulseReady ? '#80ed99' : '#94a3b8'};">${
          pulseReady
            ? 'Sẵn sàng'
            : debug.pulse_cooldown_s > 0
              ? `Hồi ${debug.pulse_cooldown_s.toFixed(1)}s`
              : `Cần ${this.engine.tuning.pulse_cost} đom đóm`
        }</b></div>
      </div>
      <div style="background:rgba(12,16,30,0.72);padding:10px 14px;border-radius:10px;border:1px solid rgba(255,209,102,0.28);text-align:right;line-height:1.55;">
        <div>Thời gian: <b style="color:#fff;">${mins}:${secs}</b></div>
        <div>Điểm: <b style="color:#ffd166;">${snap.score}</b></div>
        <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">WASD: Di chuyển · Space: Nhảy · E: Nạp đèn</div>
        <div style="font-size:12px;color:#cbd5e1;">Q/Shift: Tỏa Sáng · Kéo chuột/←→: Xoay cam · M: Âm thanh</div>
      </div>
    `;

    if (this.toastTimer > 0) {
      this.toastTimer -= dtVisual;
      if (this.toastTimer <= 0) {
        this.toastEl.style.opacity = '0';
      }
    }
  }

  private loop = (nowMs: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;

    if (this.engine.state === 'playing') {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= DT && steps < 5 && this.engine.state === 'playing') {
        const input = this.buildCurrentInput();
        const events = this.engine.step(input);
        const snap = this.engine.getSnapshot();
        if (events.length > 0) {
          this.handleEvents(events, snap);
        }
        this.accumulator -= DT;
        steps++;
      }
    }

    this.syncVisualsFromSnapshot(this.engine.getSnapshot(), dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
  }
}

