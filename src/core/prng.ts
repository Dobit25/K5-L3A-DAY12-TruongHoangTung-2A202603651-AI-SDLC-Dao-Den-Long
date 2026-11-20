/**
 * Deterministic Mulberry32 PRNG.
 * Produces identical sequences across all platforms and JS engines for a given integer seed.
 */
export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed | 0) >>> 0;
  }

  /** Returns a deterministic float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a deterministic float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

