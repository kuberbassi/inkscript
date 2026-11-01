/**
 * Deterministic Seeded PRNG (Mulberry32)
 * Allows handwriting variations (slant, pressure, baseline wave, underline micro-interruptions)
 * to remain stable while editing, or re-roll cleanly with a single click.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1337;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  uniform(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

