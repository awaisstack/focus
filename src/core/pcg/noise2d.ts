import { cyrb128 } from './prng';

/**
 * Deterministic 2D Value Noise & Island Elevation Field
 * Allows both the pure TypeScript generator/validator and the Three.js renderer
 * to query exact terrain height h(x, z) and brook proximity without WebGL.
 */
export class SeededNoise2D {
  private readonly seedHash: number;

  constructor(seed: string) {
    const [h0] = cyrb128(seed);
    this.seedHash = h0;
  }

  private hashCoords(ix: number, iz: number): number {
    let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + this.seedHash;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  public sample(x: number, z: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

    const u = this.smoothstep(fx);
    const v = this.smoothstep(fz);

    const n00 = this.hashCoords(ix, iz);
    const n10 = this.hashCoords(ix + 1, iz);
    const n01 = this.hashCoords(ix, iz + 1);
    const n11 = this.hashCoords(ix + 1, iz + 1);

    const nx0 = this.lerp(n00, n10, u);
    const nx1 = this.lerp(n01, n11, u);
    return this.lerp(nx0, nx1, v);
  }

  public fbm(x: number, z: number, octaves = 3): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 0.14;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.sample(x * frequency, z * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= 0.5;
      frequency *= 2.02;
    }

    return value / maxAmplitude;
  }
}

/**
 * Returns the signed horizontal distance from point (x, z) to the center of the winding brook.
 */
export function getBrookCenterX(z: number): number {
  return 1.05 + Math.sin(z * 0.28) * 0.95;
}

export function isInsideBrookChannel(x: number, z: number, margin = 1.35): boolean {
  if (Math.abs(z) > 9.6) return false;
  const brookX = getBrookCenterX(z);
  return Math.abs(x - brookX) < margin;
}

/**
 * Evaluates deterministic terrain height at world coordinates (x, z)
 * matching our tiered 2.5D island sanctuary geometry.
 */
export function sampleIslandElevation(
  x: number,
  z: number,
  noise: SeededNoise2D
): number {
  const radialDist = Math.hypot(x, z);
  if (radialDist > 12.4) {
    return 0.15;
  }

  // Base meadow elevation
  let height = 0.98;

  // North-West Study & Scholar Plateau
  const distToNorthWestPlateau = Math.hypot(x - -3.2, z - -0.4);
  if (distToNorthWestPlateau < 5.6) {
    height = Math.max(height, 1.58);
  }

  // Upper Scholar Knoll
  const distToScholarKnoll = Math.hypot(x - -1.4, z - -3.2);
  if (distToScholarKnoll < 2.75) {
    height = Math.max(height, 1.88);
  }

  // Eastern Pine Trail Terrace
  const distToEastTerrace = Math.hypot(x - 5.2, z - -1.8);
  if (distToEastTerrace < 3.65) {
    height = Math.max(height, 1.45);
  }

  // Subtle seeded organic surface undulation
  const undulation = (noise.fbm(x + 20, z + 20, 2) - 0.5) * 0.14;
  return Number((height + undulation).toFixed(3));
}
