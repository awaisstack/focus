import * as THREE from 'three';

/**
 * Shared Wind & Time Uniform for all nature shaders (Grass, Oak Leaves, Boughs)
 */
export const natureTimeUniform = { value: 0 };

/**
 * Creates a stylized foliage shader material with:
 * - Dynamic wind sway on boughs
 * - High-frequency fluttering leaf displacement
 * - 3-tier artistic color gradient (Sunlit highlight, lush midtone, deep shade)
 * - Soft directional backlight / subsurface translucency
 */
export function createFoliageShaderMaterial(options?: {
  sunHighlightHex?: string;
  lushMidtoneHex?: string;
  deepShadowHex?: string;
}): THREE.ShaderMaterial {
  const sunHighlight = new THREE.Color(options?.sunHighlightHex ?? '#a4e83c');
  const lushMidtone = new THREE.Color(options?.lushMidtoneHex ?? '#3b8826');
  const deepShadow = new THREE.Color(options?.deepShadowHex ?? '#154418');

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: natureTimeUniform,
      uSunHighlight: { value: sunHighlight },
      uLushMidtone: { value: lushMidtone },
      uDeepShadow: { value: deepShadow },
      uLightDir: { value: new THREE.Vector3(0.55, 0.75, -0.35).normalize() }
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying float vHeight;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vHeight = position.y;

        // 1. Gentle low-frequency bough sway in the breeze
        float boughSwayX = sin(uTime * 2.2 + worldPos.x * 0.35 + worldPos.y * 0.5) * 0.08 * max(0.0, position.y);
        float boughSwayZ = cos(uTime * 1.8 + worldPos.z * 0.35) * 0.06 * max(0.0, position.y);

        // 2. High-frequency fluttering leaf ripple across foliage lobes
        float leafFlutter = sin(uTime * 5.5 + position.x * 7.0 + position.y * 6.0 + position.z * 5.0) * 0.032;

        vec3 displaced = position;
        displaced.x += boughSwayX;
        displaced.z += boughSwayZ;
        displaced += normal * leafFlutter;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunHighlight;
      uniform vec3 uLushMidtone;
      uniform vec3 uDeepShadow;
      uniform vec3 uLightDir;

      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying float vHeight;

      void main() {
        vec3 n = normalize(vNormal);
        // Stylized hemispherical diffuse lighting
        float nDotL = dot(n, uLightDir);
        float diffuse = clamp(nDotL * 0.5 + 0.5, 0.0, 1.0);

        // Height & upward-facing blend for golden sunlight on crown
        float upBlend = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
        float sunCatch = smoothstep(0.35, 0.95, diffuse * 0.65 + upBlend * 0.35);

        // Underside deep shadow in canopy crevices
        float shade = smoothstep(0.45, 0.05, diffuse);

        vec3 col = mix(uLushMidtone, uSunHighlight, sunCatch * 0.85);
        col = mix(col, uDeepShadow, shade * 0.75);

        // Soft backlight translucency (sunlight glowing through leaf lobes)
        float backlight = max(0.0, dot(-n, uLightDir)) * 0.22;
        col += uSunHighlight * backlight;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * Creates an ancient, stylized broadleaf Oak Tree with:
 * - Gnarly twisting trunk and sprawling buttress roots gripping into the earth
 * - Multi-lobed cloud canopy clusters with wind animation
 * - 4 distinct artistic variants matching the reference art style
 */
export function createStylizedOakTree(
  variant: number = 0,
  scale: number = 1.0,
  seed: number = 42
): THREE.Group {
  const treeGroup = new THREE.Group();

  // Pseudo-random helper from seed
  let s = seed + variant * 1013;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // 1. Organic Oak Bark Material
  const barkMat = new THREE.MeshStandardMaterial({
    color: '#52341b',
    roughness: 0.92,
    metalness: 0.02
  });
  const rootMossMat = new THREE.MeshStandardMaterial({
    color: '#3d4a22',
    roughness: 0.95,
    metalness: 0.01
  });

  // 2. Trunk & Gnarled Buttress Roots
  const trunkGroup = new THREE.Group();
  treeGroup.add(trunkGroup);

  const trunkHeight = 2.8 + (variant % 2) * 0.6;
  const baseRadius = 0.55 + (variant === 0 ? 0.22 : 0.08);
  const topRadius = 0.32;

  const trunkGeo = new THREE.CylinderGeometry(
    topRadius,
    baseRadius,
    trunkHeight,
    12,
    8
  );
  // Deform trunk vertices for organic gnarled bark twists
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    // Twist along height + subtle bulges
    const twist = Math.sin(y * 1.5 + angle * 2.0) * 0.06;
    const flare = Math.exp(-y * 1.2) * 0.15; // wide root flare at ground
    pos.setX(i, pos.getX(i) * (1.0 + flare) + Math.sin(y * 2.0) * 0.08);
    pos.setZ(i, pos.getZ(i) * (1.0 + flare) + Math.cos(y * 1.6) * 0.06);
  }
  trunkGeo.computeVertexNormals();

  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
  trunkMesh.position.y = trunkHeight / 2;
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  trunkGroup.add(trunkMesh);

  // Sprawling Buttress Roots (5 organic root lobes digging into the soil)
  const rootCount = 5;
  for (let r = 0; r < rootCount; r++) {
    const rootAngle = (r / rootCount) * Math.PI * 2 + rnd() * 0.35;
    const rootLength = baseRadius * (1.6 + rnd() * 0.7);
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(rootAngle) * baseRadius * 0.7, 0.45, Math.sin(rootAngle) * baseRadius * 0.7),
      new THREE.Vector3(Math.cos(rootAngle) * baseRadius * 1.3, 0.16, Math.sin(rootAngle) * baseRadius * 1.3),
      new THREE.Vector3(Math.cos(rootAngle) * (baseRadius + rootLength), 0.02, Math.sin(rootAngle) * (baseRadius + rootLength))
    ]);
    const rootGeo = new THREE.TubeGeometry(rootCurve, 8, 0.18, 8, false);
    const rootMesh = new THREE.Mesh(rootGeo, r % 2 === 0 ? rootMossMat : barkMat);
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    trunkGroup.add(rootMesh);
  }

  // Branching boughs holding the canopy
  const boughCount = variant === 3 ? 2 : 4; // Variant 3 is twin-trunk grove
  const boughTips: THREE.Vector3[] = [];
  for (let b = 0; b < boughCount; b++) {
    const boughAngle = (b / boughCount) * Math.PI * 2 + (variant === 2 ? 0.4 : 0);
    const reach = 1.1 + rnd() * 0.5;
    const boughHeight = trunkHeight * 0.85 + (b % 2) * 0.4;
    const startPt = new THREE.Vector3(0, boughHeight, 0);
    const tipPt = new THREE.Vector3(
      Math.cos(boughAngle) * reach,
      boughHeight + 0.7 + rnd() * 0.4,
      Math.sin(boughAngle) * reach
    );
    boughTips.push(tipPt);

    const boughCurve = new THREE.CatmullRomCurve3([
      startPt,
      new THREE.Vector3(
        Math.cos(boughAngle) * reach * 0.4,
        boughHeight + 0.3,
        Math.sin(boughAngle) * reach * 0.4
      ),
      tipPt
    ]);
    const boughGeo = new THREE.TubeGeometry(boughCurve, 6, 0.14, 6, false);
    const boughMesh = new THREE.Mesh(boughGeo, barkMat);
    boughMesh.castShadow = true;
    trunkGroup.add(boughMesh);
  }

  // 3. Volumetric Multi-Lobe Canopy (Layered billowy foliage lobes)
  const foliageMat = createFoliageShaderMaterial({
    sunHighlightHex: variant === 0 ? '#b2ea44' : variant === 2 ? '#92de32' : '#a2e438',
    lushMidtoneHex: variant === 0 ? '#388824' : variant === 2 ? '#2e7c20' : '#3c8e26',
    deepShadowHex: '#144217'
  });

  const canopyGroup = new THREE.Group();
  treeGroup.add(canopyGroup);

  // Generate 8 to 11 overlapping deformed foliage lobes
  const lobeCount = variant === 0 ? 11 : 8;
  const lobeGeo = new THREE.IcosahedronGeometry(1.0, 2);
  // Organic deformation on the base sphere
  const lPos = lobeGeo.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    const vx = lPos.getX(i);
    const vy = lPos.getY(i);
    const vz = lPos.getZ(i);
    const bump =
      Math.sin(vx * 3.5 + vy * 4.0) * 0.12 +
      Math.cos(vy * 3.0 + vz * 3.5) * 0.1;
    lPos.setXYZ(i, vx * (1.0 + bump), vy * (1.0 + bump), vz * (1.0 + bump));
  }
  lobeGeo.computeVertexNormals();

  for (let l = 0; l < lobeCount; l++) {
    const lobeMesh = new THREE.Mesh(lobeGeo, foliageMat);
    let lx = 0;
    let ly = trunkHeight + 0.8;
    let lz = 0;
    let lScale = 1.0;

    if (l === 0) {
      // Central high crown
      ly = trunkHeight + 1.6;
      lScale = 1.35;
    } else if (l <= boughTips.length) {
      // Anchor over bough tips
      const tip = boughTips[l - 1];
      lx = tip.x;
      ly = tip.y + 0.2;
      lz = tip.z;
      lScale = 1.15 + rnd() * 0.35;
    } else {
      // Mid-tier filler lobes creating the billowy broad oak shape
      const phi = (l / lobeCount) * Math.PI * 2 + rnd() * 0.4;
      const rad = 1.2 + rnd() * 0.7;
      lx = Math.cos(phi) * rad;
      ly = trunkHeight + 0.4 + rnd() * 1.1;
      lz = Math.sin(phi) * rad;
      lScale = 0.95 + rnd() * 0.4;
    }

    lobeMesh.position.set(lx, ly, lz);
    lobeMesh.scale.set(lScale, lScale * 0.88, lScale * 1.05);
    lobeMesh.castShadow = true;
    canopyGroup.add(lobeMesh);
  }

  treeGroup.scale.setScalar(scale);
  return treeGroup;
}

/**
 * Creates an InstancedMesh of 3D Stylized Swaying Grass Clumps
 * covering the settlement ground and riverbanks, with wind-wave vertex displacement
 */
export function createInstancedGrassMeadow(options: {
  count?: number;
  width?: number;
  depth?: number;
  isHeadless?: boolean;
  groundHeightFn: (x: number, z: number) => number;
  isObstacleFn: (x: number, z: number) => boolean;
  seed?: number;
}): { instancedMesh: THREE.InstancedMesh; grassMaterial: THREE.ShaderMaterial } {
  const count = options.count ?? 2600;
  const seed = options.seed ?? 12345;

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Cross-blade stylized grass geometry (3 intersecting quads angled at 60 deg)
  const bladeGeo = new THREE.BufferGeometry();
  const bladeWidth = 0.14;
  const bladeHeight = 0.42;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let q = 0; q < 3; q++) {
    const angle = (q / 3) * Math.PI;
    const cosA = Math.cos(angle) * (bladeWidth / 2);
    const sinA = Math.sin(angle) * (bladeWidth / 2);

    const baseIdx = q * 4;
    // Bottom left, bottom right, top right, top left
    positions.push(-cosA, 0, -sinA);
    uvs.push(0, 0);

    positions.push(cosA, 0, sinA);
    uvs.push(1, 0);

    positions.push(cosA * 0.4, bladeHeight, sinA * 0.4);
    uvs.push(1, 1);

    positions.push(-cosA * 0.4, bladeHeight, -sinA * 0.4);
    uvs.push(0, 1);

    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
  }

  bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bladeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bladeGeo.setIndex(indices);
  bladeGeo.computeVertexNormals();

  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: natureTimeUniform,
      uRootColor: { value: new THREE.Color('#2a4f16') },
      uTipColor: { value: new THREE.Color('#7ec42a') },
      uSunColor: { value: new THREE.Color('#a8e83c') }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        vWorldPos = instancePos.xyz;

        // Wind wave across the meadow
        float windWave = sin(uTime * 3.2 + instancePos.x * 0.35 + instancePos.z * 0.28);
        float sway = windWave * uv.y * 0.18;

        vec3 transformed = position;
        transformed.x += sway;
        transformed.z += sway * 0.75;

        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uRootColor;
      uniform vec3 uTipColor;
      uniform vec3 uSunColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        // Gradient from dark earth root to bright sun-lit blade tip
        vec3 col = mix(uRootColor, uTipColor, smoothstep(0.1, 0.85, vUv.y));
        // Dappled sunshine highlights
        float sunDapple = sin(vWorldPos.x * 0.4 + vWorldPos.z * 0.4) * 0.5 + 0.5;
        col = mix(col, uSunColor, sunDapple * vUv.y * 0.35);

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const instancedMesh = new THREE.InstancedMesh(bladeGeo, grassMat, count);
  const dummy = new THREE.Object3D();

  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 6;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    // Scatter across village green: x in [-24, 18], z in [-20, 18]
    const gx = -24 + rnd() * 42;
    const gz = -20 + rnd() * 38;

    if (options.isObstacleFn(gx, gz)) continue;

    const gy = options.groundHeightFn(gx, gz);
    if (gy < 0.05) continue; // do not spawn in water

    dummy.position.set(gx, gy, gz);
    const clumpScale = 0.85 + rnd() * 0.55;
    dummy.scale.set(clumpScale, clumpScale * (0.9 + rnd() * 0.4), clumpScale);
    dummy.rotation.y = rnd() * Math.PI * 2;
    dummy.updateMatrix();

    instancedMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }

  instancedMesh.count = placed;
  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.receiveShadow = !options.isHeadless;

  return { instancedMesh, grassMaterial: grassMat };
}
