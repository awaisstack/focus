/**
 * Continuous mathematical valley heightmap shared by the 3D terrain mesh,
 * procedural generator, buildings, trees, fences, and villagers.
 */

export function getRiverCenterX(z: number): number {
  return 2.2 + Math.sin(z * 0.14) * 1.8;
}

export function isPointInRiver(x: number, z: number, margin = 1.65): boolean {
  if (Math.abs(z) > 42) return false;
  return Math.abs(x - getRiverCenterX(z)) < margin;
}

export function sampleValleyTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Riverbed channel carve
  const riverDist = Math.abs(x - getRiverCenterX(z));
  if (riverDist < 2.2 && Math.abs(z) < 42) {
    const t = Math.max(0, Math.min(1, riverDist / 2.2));
    const smooth = t * t * (3 - 2 * t);
    return -0.28 * (1 - smooth) + 0.92 * smooth;
  }

  // Base village meadow plateau (radius 0..14) is gently contoured around y = 1.0
  let height = 1.0;

  // North-West Guildhall & Windmill Knoll
  const nwDist = Math.hypot(x - -5.2, z - -2.4);
  if (nwDist < 6.5) {
    const factor = Math.cos((nwDist / 6.5) * (Math.PI / 2));
    height += factor * 0.72;
  }

  // North-East Watchtower Overlook
  const neDist = Math.hypot(x - 6.0, z - -2.8);
  if (neDist < 5.5) {
    const factor = Math.cos((neDist / 5.5) * (Math.PI / 2));
    height += factor * 0.55;
  }

  // Rolling Fabledom / Manor Lords outer valley hills (radius > 15)
  if (distFromCenter > 15) {
    const rim = (distFromCenter - 15) * 0.18;
    const hillWave =
      Math.sin(x * 0.12) * Math.cos(z * 0.12) * 1.6 +
      Math.sin(x * 0.05 + z * 0.07) * 2.2;
    height += Math.max(0, rim + hillWave * 0.45);
  } else {
    // Subtle micro-undulation on the meadow
    height += Math.sin(x * 0.35) * Math.cos(z * 0.35) * 0.06;
  }

  return Number(height.toFixed(3));
}
