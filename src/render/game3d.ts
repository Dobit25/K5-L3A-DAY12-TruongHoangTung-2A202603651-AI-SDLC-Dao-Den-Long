import * as THREE from 'three';
import { DT, PALETTE } from '../core/config.js';
import { createDefaultInput, distXZ, GameEngine } from '../core/engine.js';
import { getNightMap } from '../core/maps.js';
import type { EventRecord, InputState, NightNumber, SnapshotRecord } from '../core/types.js';
import { LanternAudio } from './audio.js';

interface SavedSettings {
  volume: number;
  mouseSensitivity: number;
}

const SETTINGS_KEY = 'dao_den_long_settings_v1';

interface LanternVisual {
  id: string;
  group: THREE.Group;
  bulbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRingMat: THREE.MeshBasicMaterial;
  progressRing: THREE.Mesh;
}

interface ShadeVisual {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  rimMat: THREE.MeshBasicMaterial;
}

interface PulseWave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
  maxRadius: number;
}

type UiScreen = 'menu' | 'intro' | 'playing' | 'paused' | 'result' | 'dawn_victory';

export class DaoDenLongApp {
  private container: HTMLElement;
  private engine: GameEngine;
  private audio = new LanternAudio();
  private settings: SavedSettings;

  private currentNight: NightNumber = 1;
  private campaignScore = 0;
  private screen: UiScreen = 'menu';

  private scene: THREE.Scene;
  private worldGroup: THREE.Group;
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
  private drifterMeshes = new Map<string, THREE.Mesh>();
  private charmMeshes = new Map<string, THREE.Mesh>();
  private pulseWaves: PulseWave[] = [];
  private clouds: THREE.Mesh[] = [];
  private windLeaves: THREE.Points | null = null;

  private keys = new Set<string>();
  private pendingPauseToggle = false;
  private camYawDeg = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private lastCountdownSec = -1;
  private lastWindWarn = false;

  private hudEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private arrowEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private overlayEl: HTMLDivElement;
  private toastTimer = 0;

  private accumulator = 0;
  private lastFrameMs = performance.now();
  private elapsedVisual = 0;
  private rafId = 0;

  constructor(container: HTMLElement, seed = 2026) {
    this.container = container;
    this.settings = this.loadSettings();
    this.audio.setVolume(this.settings.volume);
    this.engine = new GameEngine(seed, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.fog = new THREE.FogExp2(PALETTE.fog, 0.015);
    this.scene.fog = this.fog;

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      320
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Standardized ambient intensity formula: 0.15 + 0.55 * (lit / total)
    this.ambientLight = new THREE.AmbientLight(0xdce6ff, 0.15);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x4b629e, PALETTE.cloudSea, 0.45);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xc8d8ff, 0.85);
    this.moonLight.position.set(28, 48, 22);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.moonLight);

    const { group, lanternMat, light } = this.buildMayModel();
    this.playerGroup = group;
    this.playerHatLanternMat = lanternMat;
    this.playerLight = light;
    this.scene.add(this.playerGroup);

    this.hudEl = this.createLayer('position:absolute;inset:0;pointer-events:none;');
    this.promptEl = this.createLayer(
      'position:absolute;bottom:108px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:8px;background:rgba(14,20,48,0.86);border:1px solid #F2C14E;color:#F5F1E6;font-weight:700;display:none;pointer-events:none;'
    );
    this.arrowEl = this.createLayer(
      'position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(14,20,48,0.85);border:2px solid #F2C14E;color:#F2C14E;display:none;align-items:center;justify-content:center;font-size:18px;font-weight:900;pointer-events:none;'
    );
    this.toastEl = this.createLayer(
      'position:absolute;bottom:146px;left:50%;transform:translateX(-50%);padding:7px 16px;border-radius:999px;background:rgba(14,20,48,0.88);border:1px solid #F2C14E;color:#F5F1E6;font-weight:600;opacity:0;transition:opacity 0.25s;pointer-events:none;'
    );
    this.overlayEl = this.createLayer(
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(14,20,48,0.82);backdrop-filter:blur(4px);'
    );

    this.container.append(this.hudEl, this.promptEl, this.arrowEl, this.toastEl, this.overlayEl);

    this.buildNightEnvironment(1);
    this.syncVisualsFromSnapshot(this.engine.getSnapshot(), 0);
    this.renderMainMenu();
    this.bindEvents();
    this.loop(performance.now());
  }

  private createLayer(css: string): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = css;
    return el;
  }

  private loadSettings(): SavedSettings {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedSettings>;
        return {
          volume: typeof parsed.volume === 'number' ? parsed.volume : 0.7,
          mouseSensitivity:
            typeof parsed.mouseSensitivity === 'number' ? parsed.mouseSensitivity : 0.35,
        };
      }
    } catch {
      // ignore storage errors
    }
    return { volume: 0.7, mouseSensitivity: 0.35 };
  }

  private saveSettings(): void {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore storage errors
    }
  }

  private clearDynamicVisuals(): void {
    for (const m of this.moteMeshes.values()) this.scene.remove(m);
    this.moteMeshes.clear();
    for (const s of this.shadeVisuals.values()) this.scene.remove(s.group);
    this.shadeVisuals.clear();
    for (const l of this.lanternVisuals.values()) this.scene.remove(l.group);
    this.lanternVisuals.clear();
    for (const d of this.drifterMeshes.values()) this.scene.remove(d);
    this.drifterMeshes.clear();
    for (const c of this.charmMeshes.values()) this.scene.remove(c);
    this.charmMeshes.clear();
  }

  private buildNightEnvironment(night: NightNumber): void {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.clouds = [];
    this.windLeaves = null;

    const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.92 });
    const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.88 });
    const seaMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cloudSea,
      roughness: 1,
      transparent: true,
      opacity: 0.82,
    });

    // Cloud sea plane at Y = -10
    const sea = new THREE.Mesh(new THREE.CircleGeometry(220, 48), seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(night === 2 ? 35 : 0, -10.5, 0);
    this.worldGroup.add(sea);

    if (night === 1) {
      // Đêm 1 — Đảo Bến (R=40)
      const island = new THREE.Mesh(new THREE.CylinderGeometry(40, 36, 5, 64), grassMat);
      island.position.y = -2.5;
      island.receiveShadow = true;
      this.worldGroup.add(island);

      const sandRing = new THREE.Mesh(new THREE.RingGeometry(36, 40, 64), sandMat);
      sandRing.rotation.x = -Math.PI / 2;
      sandRing.position.y = 0.02;
      this.worldGroup.add(sandRing);

      // Wooden pier
      for (let i = 0; i < 6; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.0), woodMat);
        plank.position.set(0, 0.06, 36 + i * 1.15);
        this.worldGroup.add(plank);
      }
    } else if (night === 2) {
      // Đêm 2 — Đảo Cau (2 islands A(0,0) R=28, B(70,0) R=28 + bamboo bridge x=[26,44], z=[-2,2])
      for (const cx of [0, 70]) {
        const isl = new THREE.Mesh(new THREE.CylinderGeometry(28, 25, 5, 48), grassMat);
        isl.position.set(cx, -2.5, 0);
        isl.receiveShadow = true;
        this.worldGroup.add(isl);

        const beach = new THREE.Mesh(new THREE.RingGeometry(24.5, 28, 48), sandMat);
        beach.rotation.x = -Math.PI / 2;
        beach.position.set(cx, 0.02, 0);
        this.worldGroup.add(beach);
      }

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 4), woodMat);
      bridge.position.set(35, -0.175, 0);
      bridge.receiveShadow = true;
      this.worldGroup.add(bridge);
    } else {
      // Đêm 3 — Đảo Chuông (3 tiers + 2 ramps + bell tower)
      const tier0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 41, 5, 64), grassMat);
      tier0.position.y = -2.5;
      tier0.receiveShadow = true;
      this.worldGroup.add(tier0);

      // Tier 1 half-annulus (12..24, z>0, Y=3)
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, 0, Math.PI, false);
      shape.absarc(0, 0, 12, Math.PI, 0, true);
      const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
      tier1Geo.rotateX(Math.PI / 2);
      const tier1 = new THREE.Mesh(tier1Geo, sandMat);
      tier1.position.y = 3;
      tier1.receiveShadow = true;
      this.worldGroup.add(tier1);

      // Tier 2 disk (R=8, Y=6)
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.2, 6, 40), sandMat);
      tier2.position.y = 3;
      tier2.receiveShadow = true;
      this.worldGroup.add(tier2);

      // 2 Straight Ramps at 30° and 150° (R=30->24, Y=0->3, width 3m)
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const rampLen = Math.hypot(6, 3);
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.3, 3.0), woodMat);
        ramp.position.set(Math.cos(rad) * 27, 1.5, Math.sin(rad) * 27);
        ramp.rotation.y = -rad;
        ramp.rotation.z = -Math.atan2(3, 6);
        this.worldGroup.add(ramp);
      }

      // Bell Tower at center of Tier 2 (R=2, H=8)
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9, 2.0, 8, 16),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
      );
      tower.position.set(0, 10, 0);
      tower.castShadow = true;
      this.worldGroup.add(tower);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfAndCharm, roughness: 0.75 })
      );
      roof.position.set(0, 15.1, 0);
      this.worldGroup.add(roof);

      // Wind leaf particles
      const leafPos: number[] = [];
      for (let i = 0; i < 120; i++) {
        leafPos.push(
          ((i * 19.3) % 80) - 40,
          1 + ((i * 7.1) % 8),
          ((i * 31.7) % 80) - 40
        );
      }
      const leafGeo = new THREE.BufferGeometry();
      leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafPos, 3));
      this.windLeaves = new THREE.Points(
        leafGeo,
        new THREE.PointsMaterial({ color: PALETTE.goldAccent, size: 0.45, transparent: true, opacity: 0 })
      );
      this.worldGroup.add(this.windLeaves);
    }

    // Jump pads
    const spec = getNightMap(night);
    for (const pad of spec.jumpPads) {
      const padMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(pad.radius, pad.radius * 1.15, 0.25, 20),
        new THREE.MeshStandardMaterial({
          color: PALETTE.goldAccent,
          emissive: PALETTE.lanternLit,
          emissiveIntensity: 0.65,
        })
      );
      padMesh.position.set(pad.pos[0], pad.pos[1] + 0.125, pad.pos[2]);
      this.worldGroup.add(padMesh);
    }

    // Drifting decorative clouds
    const cloudMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cloudSea,
      transparent: true,
      opacity: 0.65,
    });
    const centerX = night === 2 ? 35 : 0;
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const r = (night === 2 ? 68 : 54) + (i % 3) * 10;
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), cloudMat);
      cloud.scale.set(2, 0.35, 1.2);
      cloud.position.set(centerX + Math.cos(angle) * r, -6, Math.sin(angle) * r);
      cloud.userData = { angle, r, centerX };
      this.worldGroup.add(cloud);
      this.clouds.push(cloud);
    }

    // Starfield
    const starPositions: number[] = [];
    for (let i = 0; i < 280; i++) {
      const theta = ((i * 73.13) % 360) * (Math.PI / 180);
      const phi = (((i * 29.7) % 70) + 12) * (Math.PI / 180);
      const rad = 160;
      starPositions.push(
        centerX + rad * Math.cos(phi) * Math.cos(theta),
        rad * Math.sin(phi),
        rad * Math.cos(phi) * Math.sin(theta)
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.worldGroup.add(
      new THREE.Points(starGeo, new THREE.PointsMaterial({ color: PALETTE.moteCore, size: 0.85, fog: false }))
    );
  }

  private buildMayModel(): {
    group: THREE.Group;
    lanternMat: THREE.MeshStandardMaterial;
    light: THREE.PointLight;
  } {
    const group = new THREE.Group();

    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.25, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayRobe, roughness: 0.75 })
    );
    cloak.position.y = 0.65;
    cloak.castShadow = true;
    group.add(cloak);

    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.09, 8, 16),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfAndCharm, roughness: 0.65 })
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.18;
    group.add(scarf);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4d5b6, roughness: 0.65 })
    );
    head.position.y = 1.44;
    group.add(head);

    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 0.45, 18),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.85 })
    );
    hat.position.y = 1.78;
    hat.castShadow = true;
    group.add(hat);

    const lanternMat = new THREE.MeshStandardMaterial({
      color: PALETTE.lanternCore,
      emissive: PALETTE.lanternLit,
      emissiveIntensity: 0.9,
    });
    const miniLantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), lanternMat);
    miniLantern.position.set(0, 1.32, 0.68);
    group.add(miniLantern);

    const light = new THREE.PointLight(PALETTE.lanternLit, 2.2, 14);
    light.position.set(0, 1.4, 0.75);
    group.add(light);

    return { group, lanternMat, light };
  }

  private createLanternVisual(id: string, pos: [number, number, number]): LanternVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
    );
    pole.position.y = 1.6;
    group.add(pole);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: PALETTE.lanternOff,
      emissive: PALETTE.lanternLit,
      emissiveIntensity: 0,
    });
    const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), bulbMat);
    bulb.position.y = 3.4;
    group.add(bulb);

    const light = new THREE.PointLight(PALETTE.lanternLit, 0, 26);
    light.position.set(0, 3.5, 0);
    group.add(light);

    const safeRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternLit,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const safeRing = new THREE.Mesh(new THREE.RingGeometry(5.82, 6.0, 48), safeRingMat);
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.06;
    group.add(safeRing);

    const progressRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.2, 24),
      new THREE.MeshBasicMaterial({
        color: PALETTE.goldAccent,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    progressRing.rotation.x = -Math.PI / 2;
    progressRing.position.y = 0.07;
    group.add(progressRing);

    this.scene.add(group);
    return { id, group, bulbMat, light, safeRingMat, progressRing };
  }

  private createShadeVisual(pos: [number, number, number]): ShadeVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.shadeBody,
      emissive: PALETTE.shadeRim,
      emissiveIntensity: 0.4,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), bodyMat);
    body.scale.set(1, 1.35, 1);
    body.position.y = 1.0;
    group.add(body);

    const rimMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
    const eyeGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const e1 = new THREE.Mesh(eyeGeo, rimMat);
    e1.position.set(-0.22, 1.2, 0.6);
    const e2 = new THREE.Mesh(eyeGeo, rimMat);
    e2.position.set(0.22, 1.2, 0.6);
    group.add(e1, e2);

    this.scene.add(group);
    return { group, bodyMat, rimMat };
  }

  private spawnPulseWave(pos: [number, number, number]): void {
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternCore,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.85, 40), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos[0], pos[1] + 0.3, pos[2]);
    this.scene.add(mesh);
    this.pulseWaves.push({
      mesh,
      mat,
      age: 0,
      maxAge: 0.4,
      maxRadius: this.engine.tuning.pulse_radius,
    });
  }

  private showToast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastTimer = 2.0;
  }

  // ─── Campaign UI Screens ───
  private startNight(night: NightNumber, resetCampaign = false): void {
    if (resetCampaign) this.campaignScore = 0;
    this.currentNight = night;
    this.clearDynamicVisuals();
    this.engine = new GameEngine((Date.now() + night * 1337) & 0x7fffffff, night);
    this.buildNightEnvironment(night);
    this.lastCountdownSec = -1;
    this.lastWindWarn = false;
    this.syncVisualsFromSnapshot(this.engine.getSnapshot(), 0);
    this.renderNightIntro(night);
  }

  private renderMainMenu(): void {
    this.screen = 'menu';
    this.overlayEl.style.display = 'flex';
    this.overlayEl.innerHTML = `
      <div style="padding:32px 40px;border-radius:16px;background:rgba(14,20,48,0.95);border:1px solid #F2C14E;max-width:460px;text-align:center;color:#F5F1E6;">
        <h1 style="margin:0 0 8px;color:#F2C14E;font-size:30px;">ĐẢO ĐÈN LỒNG</h1>
        <p style="margin:0 0 22px;color:#cbd5e1;">Ba hòn đảo · Hành trình giữ lửa qua 3 Đêm</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="btn-play" style="padding:12px 20px;border:none;border-radius:10px;background:#FFB347;color:#0E1430;font-weight:800;font-size:16px;cursor:pointer;">Bắt đầu hành trình (Đêm 1)</button>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button id="btn-n1" style="flex:1;padding:8px;border:1px solid #F2C14E;border-radius:8px;background:transparent;color:#F5F1E6;cursor:pointer;">Đêm 1</button>
            <button id="btn-n2" style="flex:1;padding:8px;border:1px solid #F2C14E;border-radius:8px;background:transparent;color:#F5F1E6;cursor:pointer;">Đêm 2</button>
            <button id="btn-n3" style="flex:1;padding:8px;border:1px solid #F2C14E;border-radius:8px;background:transparent;color:#F5F1E6;cursor:pointer;">Đêm 3</button>
          </div>
          <button id="btn-settings" style="padding:10px;border:1px solid #8FA3B8;border-radius:10px;background:transparent;color:#F5F1E6;cursor:pointer;">Cài đặt</button>
        </div>
      </div>
    `;
    this.overlayEl.querySelector('#btn-play')?.addEventListener('click', () => {
      this.audio.startAmbient();
      this.startNight(1, true);
    });
    this.overlayEl.querySelector('#btn-n1')?.addEventListener('click', () => {
      this.audio.startAmbient();
      this.startNight(1, true);
    });
    this.overlayEl.querySelector('#btn-n2')?.addEventListener('click', () => {
      this.audio.startAmbient();
      this.startNight(2, true);
    });
    this.overlayEl.querySelector('#btn-n3')?.addEventListener('click', () => {
      this.audio.startAmbient();
      this.startNight(3, true);
    });
    this.overlayEl
      .querySelector('#btn-settings')
      ?.addEventListener('click', () => this.renderSettingsModal('menu'));
  }

  private renderNightIntro(night: NightNumber): void {
    this.screen = 'intro';
    const spec = getNightMap(night);
    this.overlayEl.style.display = 'flex';
    this.overlayEl.innerHTML = `
      <div style="padding:30px 38px;border-radius:16px;background:rgba(14,20,48,0.95);border:1px solid #F2C14E;max-width:480px;text-align:center;color:#F5F1E6;">
        <div style="color:#F2C14E;font-weight:700;letter-spacing:1px;font-size:13px;">LỜI ÔNG ĐĂNG</div>
        <h2 style="margin:8px 0 12px;color:#FFE9B0;">${spec.name}</h2>
        <p style="margin:0 0 18px;font-style:italic;line-height:1.6;color:#e2e8f0;">${spec.elderQuote}</p>
        <div style="font-size:13px;color:#cbd5e1;margin-bottom:20px;">
          Đèn cần thắp: <b>${spec.lanterns.length}</b> · Thời gian: <b>${Math.floor(spec.durationS / 60)}:${String(spec.durationS % 60).padStart(2, '0')}</b>
        </div>
        <button id="btn-begin" style="padding:11px 28px;border:none;border-radius:10px;background:#FFB347;color:#0E1430;font-weight:800;font-size:15px;cursor:pointer;">Bắt đầu Đêm ${night}</button>
      </div>
    `;
    this.overlayEl.querySelector('#btn-begin')?.addEventListener('click', () => {
      this.audio.startAmbient();
      this.screen = 'playing';
      this.overlayEl.style.display = 'none';
    });
  }

  private renderPauseMenu(): void {
    this.screen = 'paused';
    this.overlayEl.style.display = 'flex';
    this.overlayEl.innerHTML = `
      <div style="padding:28px 36px;border-radius:16px;background:rgba(14,20,48,0.95);border:1px solid #F2C14E;min-width:300px;text-align:center;color:#F5F1E6;">
        <h2 style="margin:0 0 16px;color:#F2C14E;">Tạm dừng</h2>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="p-resume" style="padding:10px;border:none;border-radius:8px;background:#FFB347;color:#0E1430;font-weight:700;cursor:pointer;">Tiếp tục (Esc / P)</button>
          <button id="p-restart" style="padding:10px;border:1px solid #F2C14E;border-radius:8px;background:transparent;color:#F5F1E6;cursor:pointer;">Chơi lại Đêm ${this.currentNight}</button>
          <button id="p-settings" style="padding:10px;border:1px solid #8FA3B8;border-radius:8px;background:transparent;color:#F5F1E6;cursor:pointer;">Cài đặt</button>
          <button id="p-menu" style="padding:10px;border:1px solid #FF5A5F;border-radius:8px;background:transparent;color:#FF5A5F;cursor:pointer;">Về menu chính</button>
        </div>
      </div>
    `;
    this.overlayEl.querySelector('#p-resume')?.addEventListener('click', () => this.togglePause());
    this.overlayEl
      .querySelector('#p-restart')
      ?.addEventListener('click', () => this.startNight(this.currentNight, false));
    this.overlayEl
      .querySelector('#p-settings')
      ?.addEventListener('click', () => this.renderSettingsModal('paused'));
    this.overlayEl
      .querySelector('#p-menu')
      ?.addEventListener('click', () => this.renderMainMenu());
  }

  private renderSettingsModal(returnTo: 'menu' | 'paused'): void {
    this.overlayEl.style.display = 'flex';
    this.overlayEl.innerHTML = `
      <div style="padding:28px 36px;border-radius:16px;background:rgba(14,20,48,0.96);border:1px solid #F2C14E;min-width:340px;color:#F5F1E6;">
        <h2 style="margin:0 0 16px;color:#F2C14E;text-align:center;">Cài đặt</h2>
        <label style="display:block;margin-bottom:14px;">
          Âm lượng: <b id="vol-val">${Math.round(this.settings.volume * 100)}%</b>
          <input id="vol-slider" type="range" min="0" max="1" step="0.05" value="${this.settings.volume}" style="width:100%;margin-top:6px;" />
        </label>
        <label style="display:block;margin-bottom:20px;">
          Độ nhạy chuột: <b id="sens-val">${this.settings.mouseSensitivity.toFixed(2)}</b>
          <input id="sens-slider" type="range" min="0.1" max="1.0" step="0.05" value="${this.settings.mouseSensitivity}" style="width:100%;margin-top:6px;" />
        </label>
        <button id="set-back" style="width:100%;padding:10px;border:none;border-radius:8px;background:#FFB347;color:#0E1430;font-weight:700;cursor:pointer;">Lưu & Quay lại</button>
      </div>
    `;
    const volSlider = this.overlayEl.querySelector('#vol-slider') as HTMLInputElement;
    const sensSlider = this.overlayEl.querySelector('#sens-slider') as HTMLInputElement;
    volSlider.addEventListener('input', () => {
      this.settings.volume = Number(volSlider.value);
      this.audio.setVolume(this.settings.volume);
      const lbl = this.overlayEl.querySelector('#vol-val');
      if (lbl) lbl.textContent = `${Math.round(this.settings.volume * 100)}%`;
      this.saveSettings();
    });
    sensSlider.addEventListener('input', () => {
      this.settings.mouseSensitivity = Number(sensSlider.value);
      const lbl = this.overlayEl.querySelector('#sens-val');
      if (lbl) lbl.textContent = this.settings.mouseSensitivity.toFixed(2);
      this.saveSettings();
    });
    this.overlayEl.querySelector('#set-back')?.addEventListener('click', () => {
      this.saveSettings();
      if (returnTo === 'menu') this.renderMainMenu();
      else this.renderPauseMenu();
    });
  }

  private renderNightResult(won: boolean, reason: string, nightScore: number): void {
    if (won) {
      this.campaignScore += nightScore;
      if (this.currentNight === 3) {
        this.screen = 'dawn_victory';
        this.overlayEl.style.display = 'flex';
        this.overlayEl.innerHTML = `
          <div style="padding:32px 42px;border-radius:16px;background:rgba(14,20,48,0.95);border:2px solid #F2C14E;max-width:460px;text-align:center;color:#F5F1E6;">
            <div style="color:#F2C14E;font-weight:700;">BÌNH MINH TRÊN QUẦN ĐẢO</div>
            <h2 style="margin:8px 0 12px;color:#FFE9B0;">Chúc Mừng Chiến Thắng!</h2>
            <p style="margin:0 0 14px;">Mây đã thắp sáng cả ba hòn đảo và đẩy lùi sương đen.</p>
            <div style="font-size:20px;margin-bottom:6px;">Điểm Đêm 3: <b style="color:#F2C14E;">${nightScore}</b></div>
            <div style="font-size:24px;font-weight:800;color:#FFB347;margin-bottom:20px;">Tổng điểm 3 Đêm: ${this.campaignScore}</div>
            <button id="btn-menu" style="padding:11px 26px;border:none;border-radius:10px;background:#FFB347;color:#0E1430;font-weight:800;cursor:pointer;">Về menu chính</button>
          </div>
        `;
        this.overlayEl.querySelector('#btn-menu')?.addEventListener('click', () => this.renderMainMenu());
        return;
      }
    }

    this.screen = 'result';
    this.overlayEl.style.display = 'flex';
    const nextNight = (this.currentNight + 1) as NightNumber;
    this.overlayEl.innerHTML = `
      <div style="padding:28px 36px;border-radius:16px;background:rgba(14,20,48,0.95);border:1px solid ${won ? '#F2C14E' : '#FF5A5F'};max-width:440px;text-align:center;color:#F5F1E6;">
        <h2 style="margin:0 0 10px;color:${won ? '#FFE9B0' : '#FF5A5F'};">${won ? `Hoàn thành Đêm ${this.currentNight}!` : `Thất bại ở Đêm ${this.currentNight}`}</h2>
        <p style="margin:0 0 14px;color:#cbd5e1;">${
          won
            ? 'Tất cả Đèn Lồng Lớn đã rực sáng!'
            : reason === 'no_flames'
              ? 'Mây đã mất hết Ngọn Lửa.'
              : 'Đã hết thời gian trước bình minh.'
        }</p>
        <div style="font-size:20px;font-weight:700;color:#F2C14E;margin-bottom:18px;">
          Điểm Đêm ${this.currentNight}: ${nightScore} · Tổng điểm: ${this.campaignScore}
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          ${
            won
              ? `<button id="btn-next" style="padding:10px 22px;border:none;border-radius:10px;background:#FFB347;color:#0E1430;font-weight:800;cursor:pointer;">Sang Đêm ${nextNight}</button>`
              : `<button id="btn-retry" style="padding:10px 22px;border:none;border-radius:10px;background:#FFB347;color:#0E1430;font-weight:800;cursor:pointer;">Chơi lại Đêm ${this.currentNight}</button>`
          }
          <button id="btn-menu" style="padding:10px 18px;border:1px solid #8FA3B8;border-radius:10px;background:transparent;color:#F5F1E6;cursor:pointer;">Menu</button>
        </div>
      </div>
    `;
    this.overlayEl.querySelector('#btn-next')?.addEventListener('click', () => this.startNight(nextNight, false));
    this.overlayEl
      .querySelector('#btn-retry')
      ?.addEventListener('click', () => this.startNight(this.currentNight, false));
    this.overlayEl.querySelector('#btn-menu')?.addEventListener('click', () => this.renderMainMenu());
  }

  private togglePause(): void {
    if (this.screen === 'playing') {
      this.pendingPauseToggle = true;
      this.renderPauseMenu();
    } else if (this.screen === 'paused') {
      this.pendingPauseToggle = true;
      this.screen = 'playing';
      this.overlayEl.style.display = 'none';
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && (this.screen === 'playing' || this.screen === 'paused')) {
        this.togglePause();
        return;
      }
      this.keys.add(e.code);
      if (e.code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.showToast(muted ? 'Âm thanh: TẮT' : 'Âm thanh: BẬT');
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
      if (!this.isDragging || this.screen !== 'playing') return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.camYawDeg = (this.camYawDeg - dx * this.settings.mouseSensitivity + 360) % 360;
    });
    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });
  }

  private buildCurrentInput(): InputState {
    const input = createDefaultInput();
    let mx = 0;
    let mz = 0;
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
    input.pulse = this.keys.has('KeyQ');
    input.dash = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    input.pause = this.pendingPauseToggle;
    this.pendingPauseToggle = false;
    return input;
  }

  private handleEvents(events: EventRecord[], snap: SnapshotRecord): void {
    for (const ev of events) {
      switch (ev.name) {
        case 'mote_picked':
          this.audio.playMotePickup(Number(ev.data.carried ?? 1));
          break;
        case 'dash':
          this.audio.playDash();
          break;
        case 'charm_picked':
          this.audio.playCharm();
          this.showToast('Nhặt Bùa Gió! Tốc độ 7.2 m/s & Lướt không hồi chiêu (10s)');
          break;
        case 'deposit':
          this.audio.playDeposit();
          this.showToast(`Nạp +${ev.data.amount} vào ${ev.data.lantern_id} (${ev.data.deposited}/10)`);
          break;
        case 'lantern_lit':
          this.audio.playLanternLit();
          this.showToast(`Đèn Lồng ${ev.data.lantern_id} đã bừng sáng!`);
          break;
        case 'pulse':
          this.audio.playPulse();
          this.spawnPulseWave(snap.player.pos);
          break;
        case 'player_hit':
          this.audio.playHit();
          this.showToast(
            ev.data.by === 'fall'
              ? 'Rơi khỏi đảo! Đang hồi sinh...'
              : `Bị Bóng Mực chạm! Rơi ${ev.data.dropped} đom đóm`
          );
          break;
        case 'shade_spawned':
          this.audio.playShadeSpawned();
          break;
        case 'drifter_steal':
          this.audio.playDrifterEvent();
          this.showToast(`Gió Lạc ${ev.data.drifter_id} cướp ${ev.data.amount} đom đóm!`);
          break;
        case 'drifter_drop':
          this.audio.playDrifterEvent();
          this.showToast(`Gió Lạc làm rơi lại ${ev.data.amount} đom đóm!`);
          break;
        case 'game_over': {
          const won = ev.data.result === 'won';
          this.audio.playGameOver(won);
          this.renderNightResult(won, String(ev.data.reason), snap.score);
          break;
        }
      }
    }
  }

  private syncVisualsFromSnapshot(snap: SnapshotRecord, dtVisual: number): void {
    this.elapsedVisual += dtVisual;

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
    this.playerHatLanternMat.emissiveIntensity = 0.6 + carryFactor * 1.5;
    this.playerLight.intensity = 1.6 + carryFactor * 2.8;

    // Lanterns + standardized ambient intensity = 0.15 + 0.55 * (lit / total)
    let litCount = 0;
    let nearestUnlit: { id: string; pos: [number, number, number]; deposited: number; dist: number } | null = null;
    for (const l of snap.lanterns) {
      if (l.lit) {
        litCount++;
      } else {
        const d = distXZ(snap.player.pos, l.pos);
        if (!nearestUnlit || d < nearestUnlit.dist) {
          nearestUnlit = { id: l.id, pos: l.pos, deposited: l.deposited, dist: d };
        }
      }

      let vis = this.lanternVisuals.get(l.id);
      if (!vis) {
        vis = this.createLanternVisual(l.id, l.pos);
        this.lanternVisuals.set(l.id, vis);
      }
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const ratio = l.deposited / Math.max(1, this.engine.tuning.lantern_cost);
      if (l.lit) {
        vis.bulbMat.color.setHex(PALETTE.lanternCore);
        vis.bulbMat.emissiveIntensity = 1.7 + Math.sin(this.elapsedVisual * 4) * 0.15;
        vis.light.intensity = 11;
        vis.safeRingMat.opacity = 0.28;
        vis.progressRing.scale.setScalar(1.1);
      } else {
        vis.bulbMat.color.setHex(PALETTE.lanternOff);
        vis.bulbMat.emissiveIntensity = ratio * 0.8;
        vis.light.intensity = ratio * 3.5;
        vis.safeRingMat.opacity = 0;
        vis.progressRing.scale.setScalar(0.55 + ratio * 0.55);
      }
    }

    const ratioLit = litCount / Math.max(1, snap.lanterns.length);
    this.ambientLight.intensity = 0.15 + 0.55 * ratioLit;
    this.fog.density = 0.018 - ratioLit * 0.008;

    // Motes
    const activeMoteIds = new Set<string>();
    for (const m of snap.motes) {
      activeMoteIds.add(m.id);
      let mesh = this.moteMeshes.get(m.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          new THREE.MeshStandardMaterial({
            color: PALETTE.moteCore,
            emissive: PALETTE.moteHalo,
            emissiveIntensity: 1.4,
          })
        );
        this.scene.add(mesh);
        this.moteMeshes.set(m.id, mesh);
      }
      const bob = m.pos[1] + 0.65 + Math.sin(this.elapsedVisual * 3.2 + m.pos[0]) * 0.18;
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
      vis.group.position.set(s.pos[0], s.pos[1], s.pos[2]);
      vis.group.lookAt(snap.player.pos[0], s.pos[1] + 1, snap.player.pos[2]);
      if (s.state === 'stunned') {
        vis.bodyMat.color.setHex(PALETTE.shadeStunned);
        vis.bodyMat.emissive.setHex(PALETTE.goldAccent);
        vis.rimMat.color.setHex(PALETTE.goldAccent);
      } else {
        vis.bodyMat.color.setHex(PALETTE.shadeBody);
        vis.bodyMat.emissive.setHex(PALETTE.shadeRim);
        vis.rimMat.color.setHex(PALETTE.shadeRim);
      }
    }
    for (const [id, vis] of this.shadeVisuals.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(vis.group);
        this.shadeVisuals.delete(id);
      }
    }

    // Drifters (Gió Lạc)
    const activeDrifterIds = new Set<string>();
    for (const d of snap.drifters) {
      activeDrifterIds.add(d.id);
      let mesh = this.drifterMeshes.get(d.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.15, 1.5),
          new THREE.MeshStandardMaterial({
            color: PALETTE.drifter,
            emissive: PALETTE.drifter,
            emissiveIntensity: 0.45,
          })
        );
        this.scene.add(mesh);
        this.drifterMeshes.set(d.id, mesh);
      }
      mesh.position.set(d.pos[0], d.pos[1] + 0.5 + Math.sin(this.elapsedVisual * 5) * 0.2, d.pos[2]);
      mesh.rotation.y = this.elapsedVisual * 2.5;
    }
    for (const [id, mesh] of this.drifterMeshes.entries()) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(mesh);
        this.drifterMeshes.delete(id);
      }
    }

    // Charms (Bùa Gió)
    for (const c of this.engine.getCharmPositions()) {
      let mesh = this.charmMeshes.get(c.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.75, 0.08),
          new THREE.MeshStandardMaterial({
            color: PALETTE.mayScarfAndCharm,
            emissive: PALETTE.goldAccent,
            emissiveIntensity: 0.5,
          })
        );
        this.scene.add(mesh);
        this.charmMeshes.set(c.id, mesh);
      }
      mesh.visible = c.available;
      mesh.position.set(c.pos[0], c.pos[1] + 0.9 + Math.sin(this.elapsedVisual * 3) * 0.15, c.pos[2]);
      mesh.rotation.y = this.elapsedVisual * 1.8;
    }

    // Night 3 Wind leaves & warning sound
    const windWarn = this.engine.getWindWarning();
    if (windWarn && !this.lastWindWarn && this.screen === 'playing') {
      this.audio.playWindWarning();
      this.showToast('Gió mạnh sắp thổi tới!');
    }
    this.lastWindWarn = windWarn;
    if (this.windLeaves) {
      const mat = this.windLeaves.material as THREE.PointsMaterial;
      mat.opacity = snap.wind.active ? 0.9 : windWarn ? 0.45 : 0;
      if (snap.wind.active || windWarn) {
        const wRad = (snap.wind.dir_deg * Math.PI) / 180;
        this.windLeaves.position.x = (this.windLeaves.position.x + Math.cos(wRad) * dtVisual * 8) % 20;
        this.windLeaves.position.z = (this.windLeaves.position.z + Math.sin(wRad) * dtVisual * 8) % 20;
      }
    }

    // Pulse waves & clouds
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

    for (const c of this.clouds) {
      c.userData.angle += dtVisual * 0.012;
      c.position.x = c.userData.centerX + Math.cos(c.userData.angle) * c.userData.r;
      c.position.z = Math.sin(c.userData.angle) * c.userData.r;
    }

    // Third-person camera
    const rad = (this.camYawDeg * Math.PI) / 180;
    const camDist = 11.5;
    const camHeight = 6.2;
    this.camera.position.lerp(
      new THREE.Vector3(
        snap.player.pos[0] - Math.sin(rad) * camDist,
        snap.player.pos[1] + camHeight,
        snap.player.pos[2] - Math.cos(rad) * camDist
      ),
      0.18
    );
    this.camera.lookAt(snap.player.pos[0], snap.player.pos[1] + 1.4, snap.player.pos[2]);

    // 10s final countdown audio tick
    const secCeil = Math.ceil(snap.time_left_s);
    if (this.screen === 'playing' && secCeil <= 10 && secCeil > 0 && secCeil !== this.lastCountdownSec) {
      this.lastCountdownSec = secCeil;
      this.audio.playCountdownTick();
    }

    // Full HUD (per Ticket-02 Part 3)
    const mins = Math.floor(snap.time_left_s / 60);
    const secs = Math.floor(snap.time_left_s % 60)
      .toString()
      .padStart(2, '0');
    const lowTime = snap.time_left_s <= 30;
    const blink = lowTime && Math.floor(this.elapsedVisual * 4) % 2 === 0;

    const moteSlots = Array.from({ length: 10 }, (_, idx) => {
      const filled = idx < snap.player.carried;
      return `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;margin:0 2px;background:${
        filled ? '#FFF6C2' : 'rgba(245,241,230,0.16)'
      };border:1px solid #F2C14E;"></span>`;
    }).join('');

    this.hudEl.innerHTML = `
      <div style="position:absolute;top:14px;left:16px;padding:8px 14px;border-radius:10px;background:rgba(14,20,48,0.78);border:1px solid rgba(242,193,78,0.35);color:#F5F1E6;">
        <div style="font-size:18px;">${'🔥'.repeat(snap.player.flames)}${'🖤'.repeat(Math.max(0, 3 - snap.player.flames))}</div>
        ${snap.player.charm_s > 0 ? `<div style="font-size:12px;color:#FF5A5F;font-weight:700;">Bùa Gió: ${snap.player.charm_s.toFixed(1)}s</div>` : ''}
      </div>

      <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:10px;background:rgba(14,20,48,0.82);border:1px solid ${
        lowTime ? '#FF5A5F' : 'rgba(242,193,78,0.35)'
      };color:${lowTime ? '#FF5A5F' : '#F5F1E6'};font-size:22px;font-weight:800;opacity:${blink ? 0.45 : 1};">
        ${mins}:${secs}
      </div>

      <div style="position:absolute;top:14px;right:16px;padding:8px 14px;border-radius:10px;background:rgba(14,20,48,0.78);border:1px solid rgba(242,193,78,0.35);text-align:right;color:#F5F1E6;">
        <div>Đèn: <b style="color:#FFB347;">${litCount}/${snap.lanterns.length}</b></div>
        <div>Điểm: <b style="color:#F2C14E;">${snap.score}</b></div>
      </div>

      <div style="position:absolute;bottom:18px;left:50%;transform:translateX(-50%);padding:8px 14px;border-radius:10px;background:rgba(14,20,48,0.82);border:1px solid rgba(242,193,78,0.4);text-align:center;">
        <div style="font-size:11px;color:#F5F1E6;margin-bottom:4px;">Đom đóm (${snap.player.carried}/10)</div>
        <div>${moteSlots}</div>
      </div>

      <div style="position:absolute;bottom:18px;right:16px;display:flex;gap:10px;">
        <div style="padding:8px 12px;border-radius:10px;background:rgba(14,20,48,0.82);border:1px solid ${
          snap.player.dash_cd_s <= 0 ? '#F2C14E' : '#5B5F6E'
        };color:#F5F1E6;text-align:center;min-width:74px;">
          <div style="font-size:11px;">Lướt (Shift)</div>
          <b>${snap.player.dash_cd_s <= 0 ? 'Sẵn sàng' : `${snap.player.dash_cd_s.toFixed(1)}s`}</b>
        </div>
        <div style="padding:8px 12px;border-radius:10px;background:rgba(14,20,48,0.82);border:1px solid ${
          snap.player.pulse_cd_s <= 0 && snap.player.carried >= 3 ? '#F2C14E' : '#5B5F6E'
        };color:#F5F1E6;text-align:center;min-width:86px;">
          <div style="font-size:11px;">Tỏa Sáng (Q)</div>
          <b>${snap.player.pulse_cd_s <= 0 ? (snap.player.carried >= 3 ? 'Sẵn sàng' : 'Cần 3') : `${snap.player.pulse_cd_s.toFixed(1)}s`}</b>
        </div>
      </div>
    `;

    // Interact prompt near unlit lantern
    if (this.screen === 'playing' && nearestUnlit && nearestUnlit.dist <= this.engine.tuning.interact_radius) {
      this.promptEl.style.display = 'block';
      this.promptEl.textContent = `E — Nạp ánh sáng (${nearestUnlit.deposited}/10)`;
    } else {
      this.promptEl.style.display = 'none';
    }

    // Off-screen arrow indicator toward nearest unlit lantern
    if (this.screen === 'playing' && nearestUnlit) {
      const worldTarget = new THREE.Vector3(nearestUnlit.pos[0], nearestUnlit.pos[1] + 3, nearestUnlit.pos[2]);
      const projected = worldTarget.project(this.camera);
      const offscreen =
        projected.z > 1 ||
        projected.x < -0.95 ||
        projected.x > 0.95 ||
        projected.y < -0.95 ||
        projected.y > 0.95;
      if (offscreen) {
        let sx = projected.x;
        let sy = projected.y;
        if (projected.z > 1) {
          sx = -sx;
          sy = -sy;
        }
        const angle = Math.atan2(sy, sx);
        const cx = window.innerWidth * 0.5 + Math.cos(angle) * (window.innerWidth * 0.42);
        const cy = window.innerHeight * 0.5 - Math.sin(angle) * (window.innerHeight * 0.38);
        this.arrowEl.style.display = 'flex';
        this.arrowEl.style.left = `${Math.round(cx - 18)}px`;
        this.arrowEl.style.top = `${Math.round(cy - 18)}px`;
        this.arrowEl.style.transform = `rotate(${Math.round((-angle * 180) / Math.PI)}deg)`;
        this.arrowEl.textContent = '➜';
      } else {
        this.arrowEl.style.display = 'none';
      }
    } else {
      this.arrowEl.style.display = 'none';
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dtVisual;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
  }

  private loop = (nowMs: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;

    if (this.screen === 'playing' || (this.screen === 'paused' && this.pendingPauseToggle)) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= DT && steps < 5 && (this.engine.state === 'playing' || this.engine.state === 'paused')) {
        const input = this.buildCurrentInput();
        const events = this.engine.step(input);
        const snap = this.engine.getSnapshot();
        if (events.length > 0) {
          this.handleEvents(events, snap);
        }
        this.accumulator -= DT;
        steps++;
        if (this.screen !== 'playing') break;
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
