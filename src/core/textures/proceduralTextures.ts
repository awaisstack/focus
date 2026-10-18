import * as THREE from 'three';

export interface VillageMaterialTextures {
  stoneWallMap: THREE.CanvasTexture;
  stoneWallNormal: THREE.CanvasTexture;
  stoneWallBump: THREE.CanvasTexture;
  terracottaRoofMap: THREE.CanvasTexture;
  slateRoofMap: THREE.CanvasTexture;
  thatchRoofMap: THREE.CanvasTexture;
  roofNormal: THREE.CanvasTexture;
  roofBump: THREE.CanvasTexture;
  halfTimberMap: THREE.CanvasTexture;
  halfTimberNormal: THREE.CanvasTexture;
  cobbleMap: THREE.CanvasTexture;
  cobbleNormal: THREE.CanvasTexture;
  meadowGrassMap: THREE.CanvasTexture;
  grassMeadowBump: THREE.CanvasTexture;
  logCabinWoodMap: THREE.CanvasTexture;
  logCabinWoodNormal: THREE.CanvasTexture;
  timberLogMap: THREE.CanvasTexture;
  timberLogBump: THREE.CanvasTexture;
}

let cachedTextures: VillageMaterialTextures | null = null;

function createConfiguredTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor = true,
  maxAnisotropy = 8
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Converts a grayscale heightmap canvas into a tangent-space RGB Normal Map
 * so Three.js PBR materials catch crisp golden-hour directional light on edges.
 */
function heightCanvasToNormalCanvas(
  heightCanvas: HTMLCanvasElement,
  strength = 3.2
): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const dstCtx = normalCanvas.getContext('2d')!;
  const dstImg = dstCtx.createImageData(w, h);
  const dstData = dstImg.data;

  const sampleHeight = (x: number, y: number): number => {
    const cx = (x + w) % w;
    const cy = (y + h) % h;
    return srcData[(cy * w + cx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sampleHeight(x - 1, y);
      const hR = sampleHeight(x + 1, y);
      const hU = sampleHeight(x, y - 1);
      const hD = sampleHeight(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz) || 1;

      const idx = (y * w + x) * 4;
      dstData[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      dstData[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      dstData[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      dstData[idx + 3] = 255;
    }
  }

  dstCtx.putImageData(dstImg, 0, 0);
  return normalCanvas;
}

export function getVillageTextures(maxAnisotropy = 8): VillageMaterialTextures | null {
  if (typeof document === 'undefined') return null;
  if (cachedTextures) return cachedTextures;

  const res = 256; // Fast, crisp procedural resolution for both GPU and headless software WebGL

  // 1. Stone Masonry Texture, Bump & Normal Map
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = res;
  stoneCanvas.height = res;
  const sCtx = stoneCanvas.getContext('2d')!;

  const stoneBumpCanvas = document.createElement('canvas');
  stoneBumpCanvas.width = res;
  stoneBumpCanvas.height = res;
  const sbCtx = stoneBumpCanvas.getContext('2d')!;

  sCtx.fillStyle = '#6E6559';
  sCtx.fillRect(0, 0, res, res);
  sbCtx.fillStyle = '#1A1A1A';
  sbCtx.fillRect(0, 0, res, res);

  const stonePalette = ['#D8CFC0', '#C6BBA8', '#B8AD99', '#E2D9C8', '#ABA08E'];
  const rows = 8;
  const rowH = res / rows;

  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -18;
    while (x < res) {
      const w = 32 + ((r * 37 + x * 13) & 15);
      const pad = 3;
      const tone =
        stonePalette[Math.abs(r * 7 + Math.floor(x / 12)) % stonePalette.length];

      sCtx.fillStyle = tone;
      sCtx.beginPath();
      sCtx.roundRect(x + pad / 2, r * rowH + pad / 2, w - pad, rowH - pad, 5);
      sCtx.fill();

      sbCtx.fillStyle = '#EBEBEB';
      sbCtx.beginPath();
      sbCtx.roundRect(x + pad / 2, r * rowH + pad / 2, w - pad, rowH - pad, 5);
      sbCtx.fill();

      x += w;
    }
  }
  const stoneNormalCanvas = heightCanvasToNormalCanvas(stoneBumpCanvas, 3.6);

  // 2. Roof Shingle & Golden Thatch Textures + Normal Map
  const terraCanvas = document.createElement('canvas');
  terraCanvas.width = res;
  terraCanvas.height = res;
  const tCtx = terraCanvas.getContext('2d')!;

  const slateCanvas = document.createElement('canvas');
  slateCanvas.width = res;
  slateCanvas.height = res;
  const slCtx = slateCanvas.getContext('2d')!;

  const thatchCanvas = document.createElement('canvas');
  thatchCanvas.width = res;
  thatchCanvas.height = res;
  const thCtx = thatchCanvas.getContext('2d')!;

  const roofBumpCanvas = document.createElement('canvas');
  roofBumpCanvas.width = res;
  roofBumpCanvas.height = res;
  const rbCtx = roofBumpCanvas.getContext('2d')!;

  const terraTones = ['#B83B2B', '#A33022', '#C94635', '#8F281B', '#BD3E2E'];
  const slateTones = ['#244D78', '#1D4066', '#2E5C8A', '#193759', '#295480'];
  const thatchTones = ['#A6723F', '#946232', '#B5814C', '#825529', '#AD7944'];

  const shingleRows = 12;
  const shingleCols = 10;
  const shH = res / shingleRows;
  const shW = res / shingleCols;

  for (let r = 0; r < shingleRows; r++) {
    const offsetX = (r % 2) * (shW * 0.5);
    for (let c = -1; c <= shingleCols; c++) {
      const idx = Math.abs(r * 17 + c * 31) % 5;
      const sx = c * shW + offsetX;
      const sy = r * shH;

      tCtx.fillStyle = terraTones[idx];
      tCtx.fillRect(sx + 1, sy + 1, shW - 2, shH - 2);
      tCtx.fillStyle = 'rgba(30, 10, 5, 0.42)';
      tCtx.fillRect(sx, sy + shH - 3, shW, 3);

      slCtx.fillStyle = slateTones[idx];
      slCtx.fillRect(sx + 1, sy + 1, shW - 2, shH - 2);
      slCtx.fillStyle = 'rgba(10, 18, 32, 0.45)';
      slCtx.fillRect(sx, sy + shH - 3, shW, 3);

      thCtx.fillStyle = thatchTones[idx];
      thCtx.fillRect(sx, sy, shW, shH - 1);
      thCtx.fillStyle = 'rgba(42, 24, 10, 0.36)';
      thCtx.fillRect(sx, sy + shH - 3, shW, 3);

      rbCtx.fillStyle = '#E0E0E0';
      rbCtx.fillRect(sx + 1, sy + 1, shW - 2, shH - 3);
      rbCtx.fillStyle = '#202020';
      rbCtx.fillRect(sx, sy + shH - 3, shW, 3);
    }
  }
  const roofNormalCanvas = heightCanvasToNormalCanvas(roofBumpCanvas, 4.0);

  // 3. Half-Timbered Medieval Plaster & Aged Oak Framing + Normal Map
  const timberCanvas = document.createElement('canvas');
  timberCanvas.width = res;
  timberCanvas.height = res;
  const tmCtx = timberCanvas.getContext('2d')!;

  const timberHeightCanvas = document.createElement('canvas');
  timberHeightCanvas.width = res;
  timberHeightCanvas.height = res;
  const thmCtx = timberHeightCanvas.getContext('2d')!;

  tmCtx.fillStyle = '#F7EBD4';
  tmCtx.fillRect(0, 0, res, res);
  thmCtx.fillStyle = '#909090';
  thmCtx.fillRect(0, 0, res, res);

  for (let i = 0; i < 360; i++) {
    tmCtx.fillStyle =
      i % 2 === 0 ? 'rgba(205, 185, 155, 0.25)' : 'rgba(255, 250, 240, 0.28)';
    tmCtx.fillRect((i * 73) % res, (i * 139) % res, 6, 6);
  }

  tmCtx.fillStyle = '#4B2E19';
  thmCtx.fillStyle = '#FFFFFF';
  const beamPositions = [0, 120, 242];
  for (const by of beamPositions) {
    tmCtx.fillRect(0, by, res, 14);
    thmCtx.fillRect(0, by, res, 14);
  }
  for (let vx = 0; vx < res; vx += 64) {
    tmCtx.fillRect(vx, 0, 12, res);
    thmCtx.fillRect(vx, 0, 12, res);
  }

  tmCtx.strokeStyle = '#4B2E19';
  tmCtx.lineWidth = 10;
  thmCtx.strokeStyle = '#FFFFFF';
  thmCtx.lineWidth = 10;

  const drawBraces = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.moveTo(10, 130);
    ctx.lineTo(60, 246);
    ctx.moveTo(124, 130);
    ctx.lineTo(74, 246);
    ctx.moveTo(138, 130);
    ctx.lineTo(188, 246);
    ctx.moveTo(250, 130);
    ctx.lineTo(200, 246);
    ctx.moveTo(10, 12);
    ctx.lineTo(60, 122);
    ctx.moveTo(198, 12);
    ctx.lineTo(250, 122);
    ctx.stroke();
  };
  drawBraces(tmCtx);
  drawBraces(thmCtx);

  const halfTimberNormalCanvas = heightCanvasToNormalCanvas(
    timberHeightCanvas,
    3.5
  );

  // 4. Sandy-Cobblestone Village Road Texture + Normal Map
  const cobbleCanvas = document.createElement('canvas');
  cobbleCanvas.width = res;
  cobbleCanvas.height = res;
  const cCtx = cobbleCanvas.getContext('2d')!;

  const cobbleBump = document.createElement('canvas');
  cobbleBump.width = res;
  cobbleBump.height = res;
  const cbCtx = cobbleBump.getContext('2d')!;

  cCtx.fillStyle = '#B8A27E';
  cCtx.fillRect(0, 0, res, res);
  cbCtx.fillStyle = '#303030';
  cbCtx.fillRect(0, 0, res, res);

  const cobbleTones = ['#D6C6AA', '#C4B293', '#DDD0B8', '#A89576', '#CAB99B'];
  for (let ry = 8; ry < res; ry += 16) {
    for (let rx = 8; rx < res; rx += 18) {
      const jitterX = ((ry * 13 + rx * 7) % 5) - 2;
      const jitterY = ((rx * 11 + ry * 5) % 5) - 2;
      cCtx.fillStyle =
        cobbleTones[Math.abs(rx + ry) % cobbleTones.length] || '#C4B293';
      cCtx.beginPath();
      cCtx.ellipse(rx + jitterX, ry + jitterY, 7, 5.5, 0.2, 0, Math.PI * 2);
      cCtx.fill();

      cbCtx.fillStyle = '#E5E5E5';
      cbCtx.beginPath();
      cbCtx.ellipse(rx + jitterX, ry + jitterY, 6.5, 5, 0.2, 0, Math.PI * 2);
      cbCtx.fill();
    }
  }
  const cobbleNormalCanvas = heightCanvasToNormalCanvas(cobbleBump, 3.0);

  // 5. Lush Painterly Golden-Hour Meadow Texture
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = res;
  grassCanvas.height = res;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#588534';
  gCtx.fillRect(0, 0, res, res);

  const meadowPatches = ['#65943C', '#4D782D', '#76A646', '#85B34E', '#446B27'];
  for (let i = 0; i < 450; i++) {
    const gx = (i * 97) % res;
    const gy = (i * 157) % res;
    const rad = 6 + (i % 14);
    gCtx.fillStyle = meadowPatches[i % meadowPatches.length];
    gCtx.beginPath();
    gCtx.arc(gx, gy, rad, 0, Math.PI * 2);
    gCtx.fill();
  }

  // 6. Rich Hewn Timber Log Cabin Wall Texture + Normal Map (for Screenshot 4 Cabin Interior)
  const logCanvas = document.createElement('canvas');
  logCanvas.width = res;
  logCanvas.height = res;
  const lCtx = logCanvas.getContext('2d')!;

  const logBump = document.createElement('canvas');
  logBump.width = res;
  logBump.height = res;
  const lbCtx = logBump.getContext('2d')!;

  const logRows = 6;
  const logH = res / logRows;
  for (let r = 0; r < logRows; r++) {
    const y0 = r * logH;
    const grad = lCtx.createLinearGradient(0, y0, 0, y0 + logH);
    grad.addColorStop(0, '#2A1409');
    grad.addColorStop(0.2, '#5C3319');
    grad.addColorStop(0.5, '#6E3E20');
    grad.addColorStop(0.85, '#4A2711');
    grad.addColorStop(1, '#1E0D05');
    lCtx.fillStyle = grad;
    lCtx.fillRect(0, y0, res, logH);

    const bGrad = lbCtx.createLinearGradient(0, y0, 0, y0 + logH);
    bGrad.addColorStop(0, '#181818');
    bGrad.addColorStop(0.5, '#F0F0F0');
    bGrad.addColorStop(1, '#181818');
    lbCtx.fillStyle = bGrad;
    lbCtx.fillRect(0, y0, res, logH);

    // Fine wood grain streaks
    lCtx.fillStyle = 'rgba(28, 12, 4, 0.28)';
    for (let g = 0; g < 14; g++) {
      const gy = y0 + 4 + ((g * 19 + r * 7) % (logH - 8));
      lCtx.fillRect((g * 37) % res, gy, 48, 1.5);
    }
  }
  const logNormalCanvas = heightCanvasToNormalCanvas(logBump, 3.8);

  cachedTextures = {
    stoneWallMap: createConfiguredTexture(stoneCanvas, 2, 2, true, maxAnisotropy),
    stoneWallNormal: createConfiguredTexture(stoneNormalCanvas, 2, 2, false, maxAnisotropy),
    stoneWallBump: createConfiguredTexture(stoneBumpCanvas, 2, 2, false, maxAnisotropy),
    terracottaRoofMap: createConfiguredTexture(terraCanvas, 2, 2, true, maxAnisotropy),
    slateRoofMap: createConfiguredTexture(slateCanvas, 2, 2, true, maxAnisotropy),
    thatchRoofMap: createConfiguredTexture(thatchCanvas, 2, 2, true, maxAnisotropy),
    roofNormal: createConfiguredTexture(roofNormalCanvas, 2, 2, false, maxAnisotropy),
    roofBump: createConfiguredTexture(roofBumpCanvas, 2, 2, false, maxAnisotropy),
    halfTimberMap: createConfiguredTexture(timberCanvas, 2, 1, true, maxAnisotropy),
    halfTimberNormal: createConfiguredTexture(halfTimberNormalCanvas, 2, 1, false, maxAnisotropy),
    cobbleMap: createConfiguredTexture(cobbleCanvas, 5, 5, true, maxAnisotropy),
    cobbleNormal: createConfiguredTexture(cobbleNormalCanvas, 5, 5, false, maxAnisotropy),
    meadowGrassMap: createConfiguredTexture(grassCanvas, 12, 12, true, maxAnisotropy),
    grassMeadowBump: createConfiguredTexture(grassCanvas, 12, 12, false, maxAnisotropy),
    logCabinWoodMap: createConfiguredTexture(logCanvas, 3, 2, true, maxAnisotropy),
    logCabinWoodNormal: createConfiguredTexture(logNormalCanvas, 3, 2, false, maxAnisotropy),
    timberLogMap: createConfiguredTexture(logCanvas, 3, 2, true, maxAnisotropy),
    timberLogBump: createConfiguredTexture(logBump, 3, 2, false, maxAnisotropy)
  };

  return cachedTextures;
}

export function getSharedVillageTextures(maxAnisotropy = 8): VillageMaterialTextures {
  return getVillageTextures(maxAnisotropy)!;
}

