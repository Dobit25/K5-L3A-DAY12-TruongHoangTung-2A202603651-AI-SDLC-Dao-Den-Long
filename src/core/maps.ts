import type { NightNumber, Vec3 } from './types.js';

export interface JumpPadSpec {
  id: string;
  pos: Vec3;
  radius: number;
  vy: number;
  vx: number;
  vz: number;
}

export interface CharmSpec {
  id: string;
  pos: Vec3;
}

export interface LanternSpec {
  id: string;
  pos: Vec3;
}

export interface NightMapSpec {
  night: NightNumber;
  name: string;
  elderQuote: string;
  durationS: number;
  spawnPos: Vec3;
  lanterns: LanternSpec[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeSpeed: number;
  shadeIntervalTicks: number;
  shadeMaxCount: number;
  jumpPads: JumpPadSpec[];
  charms: CharmSpec[];
  driftersEnabled: boolean;
  windEnabled: boolean;
}

function ringPoints(radius: number, count: number, startDeg: number, y = 0, cx = 0, cz = 0): Vec3[] {
  const pts: Vec3[] = [];
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * step) * Math.PI) / 180;
    pts.push([
      Math.round((cx + Math.cos(rad) * radius) * 1000) / 1000,
      y,
      Math.round((cz + Math.sin(rad) * radius) * 1000) / 1000,
    ]);
  }
  return pts;
}

function makeNight1(): NightMapSpec {
  return {
    night: 1,
    name: 'Đêm 1 — Đảo Bến',
    elderQuote: '“Sương đen đã phủ kín bến cũ. Hãy gom đom đóm thắp lại 5 ngọn đèn lớn trước bình minh, Mây nhé.”',
    durationS: 300,
    spawnPos: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 0, 25] },
      { id: 'L2', pos: [23.8, 0, 7.7] },
      { id: 'L3', pos: [14.7, 0, -20.2] },
      { id: 'L4', pos: [-14.7, 0, -20.2] },
      { id: 'L5', pos: [-23.8, 0, 7.7] },
    ],
    motePoints: [...ringPoints(12, 8, 0, 0), ...ringPoints(33, 16, 0, 0)],
    shadePoints: ringPoints(37, 12, 15, 0),
    shadeSpeed: 4.0,
    shadeIntervalTicks: 480, // 8s
    shadeMaxCount: 6,
    jumpPads: [],
    charms: [],
    driftersEnabled: false,
    windEnabled: false,
  };
}

function makeNight2(): NightMapSpec {
  // Pad 1 (20,0,18) -> center B (70,0,0)
  const dx1 = 70 - 20;
  const dz1 = 0 - 18;
  const d1 = Math.hypot(dx1, dz1);
  // Pad 2 (50,0,-18) -> center A (0,0,0)
  const dx2 = 0 - 50;
  const dz2 = 0 - -18;
  const d2 = Math.hypot(dx2, dz2);

  return {
    night: 2,
    name: 'Đêm 2 — Đảo Cau',
    elderQuote: '“Cầu tre nối hai bờ đảo cau rất hẹp, lại có Gió Lạc rình rập. Nhớ tận dụng bục nhảy và Bùa Gió!”',
    durationS: 330,
    spawnPos: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 0, 20] },
      { id: 'L2', pos: [17, 0, -10] },
      { id: 'L3', pos: [-17, 0, -10] },
      { id: 'L4', pos: [70, 0, 20] },
      { id: 'L5', pos: [87, 0, -10] },
      { id: 'L6', pos: [53, 0, -10] },
    ],
    motePoints: [
      ...ringPoints(10, 4, 0, 0, 0, 0),
      ...ringPoints(22, 8, 0, 0, 0, 0),
      ...ringPoints(10, 4, 0, 0, 70, 0),
      ...ringPoints(22, 8, 0, 0, 70, 0),
    ],
    shadePoints: [...ringPoints(26, 8, 22.5, 0, 0, 0), ...ringPoints(26, 8, 22.5, 0, 70, 0)],
    shadeSpeed: 4.0,
    shadeIntervalTicks: 420, // 7s
    shadeMaxCount: 8,
    jumpPads: [
      {
        id: 'JP1',
        pos: [20, 0, 18],
        radius: 1.0,
        vy: 14.0,
        vx: (dx1 / d1) * 24.0,
        vz: (dz1 / d1) * 24.0,
      },
      {
        id: 'JP2',
        pos: [50, 0, -18],
        radius: 1.0,
        vy: 14.0,
        vx: (dx2 / d2) * 24.0,
        vz: (dz2 / d2) * 24.0,
      },
    ],
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    driftersEnabled: true,
    windEnabled: false,
  };
}

function makeNight3(): NightMapSpec {
  const tier1Motes: Vec3[] = [];
  for (let deg = 20; deg <= 160; deg += 20) {
    const rad = (deg * Math.PI) / 180;
    tier1Motes.push([
      Math.round(Math.cos(rad) * 18 * 1000) / 1000,
      3,
      Math.round(Math.sin(rad) * 18 * 1000) / 1000,
    ]);
  }
  const tier2Motes: Vec3[] = [45, 135, 225, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [
      Math.round(Math.cos(rad) * 5 * 1000) / 1000,
      6,
      Math.round(Math.sin(rad) * 5 * 1000) / 1000,
    ] as Vec3;
  });

  return {
    night: 3,
    name: 'Đêm 3 — Đảo Chuông',
    elderQuote: '“Đêm cuối cùng trên Đảo Chuông ba tầng. Gió lớn sẽ nổi lên từng đợt — hãy thắp trọn 7 ngọn đèn đón bình minh!”',
    durationS: 360,
    spawnPos: [0, 0, -12],
    lanterns: [
      { id: 'L1', pos: [0, 6, 6] },
      { id: 'L2', pos: [18, 3, 10] },
      { id: 'L3', pos: [-18, 3, 10] },
      { id: 'L4', pos: [35, 0, -10] },
      { id: 'L5', pos: [-35, 0, -10] },
      { id: 'L6', pos: [20, 0, -35] },
      { id: 'L7', pos: [-20, 0, -35] },
    ],
    motePoints: [...ringPoints(34, 18, 0, 0), ...tier1Motes, ...tier2Motes],
    shadePoints: ringPoints(43, 16, 0, 0),
    shadeSpeed: 4.5,
    shadeIntervalTicks: 360, // 6s
    shadeMaxCount: 10,
    jumpPads: [
      {
        id: 'JP1',
        pos: [0, 3, 13],
        radius: 1.0,
        vy: 12.0,
        vx: 0,
        vz: -8.0,
      },
    ],
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ],
    driftersEnabled: true,
    windEnabled: true,
  };
}

const NIGHT_MAPS: Record<NightNumber, NightMapSpec> = {
  1: makeNight1(),
  2: makeNight2(),
  3: makeNight3(),
};

export function getNightMap(night: NightNumber): NightMapSpec {
  return NIGHT_MAPS[night];
}

const NIGHT3_RAMP_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6]; // 30° and 150°

function getNight3RampY(x: number, z: number): number | null {
  for (const angle of NIGHT3_RAMP_ANGLES) {
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);
    const vx = -uz;
    const vz = ux;
    const s = x * ux + z * uz;
    const perp = Math.abs(x * vx + z * vz);
    if (s >= 24 && s <= 30 && perp <= 1.5) {
      return 3.0 * ((30 - s) / 6.0);
    }
  }
  return null;
}

/**
 * Returns all valid surface heights at (x, z) for the given night, sorted descending.
 */
export function getSurfacesAt(night: NightNumber, x: number, z: number): number[] {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? [0] : [];
  }

  if (night === 2) {
    const onA = Math.hypot(x, z) <= 28;
    const onB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
    return onA || onB || onBridge ? [0] : [];
  }

  // Night 3 — Đảo Chuông (3 tiers + 2 ramps)
  const r = Math.hypot(x, z);
  const surfaces: number[] = [];
  if (r <= 8) surfaces.push(6);
  if (r >= 12 && r <= 24 && z > 0) surfaces.push(3);
  const rampY = getNight3RampY(x, z);
  if (rampY !== null) surfaces.push(rampY);
  if (r <= 45) surfaces.push(0);
  surfaces.sort((a, b) => b - a);
  return surfaces;
}

/**
 * Highest walkable surface at (x, z) that is reachable from currentY (cannot climb vertical cliffs).
 */
export function getSupportY(night: NightNumber, x: number, z: number, currentY: number): number | null {
  const surfaces = getSurfacesAt(night, x, z);
  for (const sy of surfaces) {
    if (sy <= currentY + 0.55) {
      return sy;
    }
  }
  return null;
}

/**
 * Returns whether horizontal movement to (nx, nz) at height curY hits a solid obstacle or vertical cliff wall.
 */
export function resolveObstacleAndCliff(
  night: NightNumber,
  oldX: number,
  oldZ: number,
  newX: number,
  newZ: number,
  curY: number
): { x: number; z: number; blocked: boolean } {
  if (night !== 3) {
    return { x: newX, z: newZ, blocked: false };
  }

  let x = newX;
  let z = newZ;
  let blocked = false;

  // Bell tower cylinder at (0, 0) on Tier 2 (radius 2m, Y in [6, 14])
  if (curY >= 5.5 && curY < 14.0) {
    const r = Math.hypot(x, z);
    if (r < 2.0) {
      const nx = r > 1e-6 ? x / r : 1;
      const nz = r > 1e-6 ? z / r : 0;
      x = nx * 2.0;
      z = nz * 2.0;
      blocked = true;
    }
  }

  // Vertical cliff check: cannot walk horizontally into Tier 1 (Y=3) or Tier 2 (Y=6) from below
  // unless currently on a ramp seamlessly reaching that height
  const rNew = Math.hypot(x, z);
  const onRampNew = getNight3RampY(x, z) !== null;
  const onRampOld = getNight3RampY(oldX, oldZ) !== null;

  // Tier 2 solid pedestal wall (r <= 8, height 0..6): block entry when strictly below 5.45
  if (rNew < 8.0 && curY < 5.45) {
    const rOld = Math.hypot(oldX, oldZ);
    if (rOld >= 7.99) {
      const nx = rNew > 1e-6 ? x / rNew : 1;
      const nz = rNew > 1e-6 ? z / rNew : 0;
      x = nx * 8.01;
      z = nz * 8.01;
      blocked = true;
    }
  }

  // Tier 1 solid wall (12 <= r <= 24, z > 0, height 0..3): block entry when below 2.45 and not via ramp
  if (curY < 2.45 && rNew >= 12.0 && rNew <= 24.0 && z > 0 && !onRampNew && !onRampOld) {
    const rOld = Math.hypot(oldX, oldZ);
    const wasInTier1 = rOld >= 12.0 && rOld <= 24.0 && oldZ > 0;
    if (!wasInTier1) {
      x = oldX;
      z = oldZ;
      blocked = true;
    }
  }

  return { x, z, blocked };
}

export function isPointOnGround(night: NightNumber, x: number, z: number): boolean {
  return getSurfacesAt(night, x, z).length > 0;
}

export function getHighestGroundY(night: NightNumber, x: number, z: number): number | null {
  const s = getSurfacesAt(night, x, z);
  return s.length > 0 ? s[0] : null;
}

