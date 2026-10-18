/**
 * Deterministic Seeded Pseudorandom Number Generator (PRNG) & Coherent 2D Noise
 * Supports both cyrb128-isolated streams (JAHAN pipeline) and SeededRandom / groundHeightAt (3D village).
 */

export type PrngFunction = () => number;

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0
  ];
}

export function mulberry32(seedInt: number): PrngFunction {
  let a = seedInt >>> 0;
  return function nextRandom(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPrng(seedString: string): PrngFunction {
  const [s0] = cyrb128(seedString);
  return mulberry32(s0);
}

export interface IsolatedPrngStreams {
  terrain: PrngFunction;
  landmarks: PrngFunction;
  paths: PrngFunction;
  decorations: PrngFunction;
}

export function createIsolatedStreams(
  worldSeed: string,
  repairAttempt = 0
): IsolatedPrngStreams {
  const normalized = `${worldSeed.trim()}::v1`;
  return {
    terrain: createPrng(`${normalized}::terrain`),
    landmarks: createPrng(`${normalized}::landmarks::attempt-${repairAttempt}`),
    paths: createPrng(`${normalized}::paths`),
    decorations: createPrng(`${normalized}::decorations`)
  };
}

export function randomRange(
  rng: PrngFunction,
  min: number,
  max: number
): number {
  return min + rng() * (max - min);
}

export function randomInt(
  rng: PrngFunction,
  minInclusive: number,
  maxInclusive: number
): number {
  return Math.floor(randomRange(rng, minInclusive, maxInclusive + 1));
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1337;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public intRange(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  public pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

export function hashCoordinates(x: number, z: number, seed = 42): number {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x: number, z: number, seed = 42): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;

  const u = smoothstep(xf);
  const v = smoothstep(zf);

  const n00 = hashCoordinates(xi, zi, seed);
  const n10 = hashCoordinates(xi + 1, zi, seed);
  const n01 = hashCoordinates(xi, zi + 1, seed);
  const n11 = hashCoordinates(xi + 1, zi + 1, seed);

  const nx0 = n00 + u * (n10 - n00);
  const nx1 = n01 + u * (n11 - n01);

  return nx0 + v * (nx1 - nx0);
}

export function groundHeightAt(x: number, z: number, seed = 1042): number {
  const distFromPlaza = Math.hypot(x, z - 1.0);
  if (distFromPlaza < 11.5) {
    return 0;
  }
  const distFromCabin = Math.hypot(x, z - 28.0);
  if (distFromCabin < 7.0) {
    return 0;
  }
  const rimFactor = Math.min(1, (distFromPlaza - 11.5) / 14.0);
  const n1 = valueNoise2D(x * 0.14, z * 0.14, seed);
  const n2 = valueNoise2D(x * 0.31, z * 0.31, seed + 17) * 0.5;
  return rimFactor * rimFactor * (n1 + n2) * 1.65;
}
