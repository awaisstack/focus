'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { useFocusStore } from '../../store/useFocusStore';
import { groundHeightAt, SeededRandom } from '../../core/pcg/prng';
import {
  BRIDGE_Z_COORDS,
  RIVER_HALF_WIDTH,
  clampPointOutOfRiver,
  evaluateCarpenterState,
  riverCenterXAtZ,
  shouldSpawnPlotWoodPile
} from '../../core/pcg/worldGenerator';
import { getSharedVillageTextures } from '../../core/textures/proceduralTextures';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';
import { soundscapeEngine } from '../../core/audio/soundscapeEngine';
import {
  BUILDING_ARCHETYPES,
  type LandmarkNode
} from '../../types/focus';
import {
  createStylizedOakTree,
  createInstancedGrassMeadow,
  natureTimeUniform
} from './StylizedNature';

/**
 * Unreal Engine-inspired ACES Golden-Hour Color Grade + Volumetric Depth Haze Shader
 */
const AtmosphericGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteDarkness: { value: 0.22 },
    vignetteOffset: { value: 1.16 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteDarkness;
    uniform float vignetteOffset;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb;

      // Warm golden-hour Tiny Glade / Unreal Engine atmospheric contrast curve
      col = pow(max(col, vec3(0.0)), vec3(0.95, 0.97, 1.02));
      col *= vec3(1.05, 1.02, 0.95);

      // Subtle atmospheric horizon lift in upper frame
      float skyFactor = smoothstep(0.52, 0.98, vUv.y);
      col = mix(col, col + vec3(0.03, 0.022, 0.01), skyFactor * 0.35);

      vec2 uv = (vUv - vec2(0.5)) * vec2(vignetteOffset);
      float vig = clamp(1.0 - dot(uv, uv) * vignetteDarkness, 0.78, 1.0);
      col *= vig;

      gl_FragColor = vec4(col, texel.a);
    }
  `
};

interface LandmarkRuntimeController {
  id: string;
  node: LandmarkNode;
  rootGroup: THREE.Group;
  completedModelGroup: THREE.Group;
  scaffoldingGroup: THREE.Group;
  foundationPlotGroup: THREE.Group;
  plotMarkerRing: THREE.Mesh;
  deferredCacheGroup: THREE.Group;
  vortexGroup: THREE.Group;
  helixGold: THREE.Mesh;
  helixCyan: THREE.Mesh;
  sparklePoints: THREE.Points;
  smokeParticles: THREE.Points;
  RotatingPart: THREE.Object3D | null;
  specialistGroup: THREE.Group;
  specialistMixer: THREE.AnimationMixer | null;
  specialistActions: Map<string, THREE.AnimationAction>;
  activeClipName: string;
}

interface FrontierTreeEntry {
  index: number;
  rootGroup: THREE.Group;
  treeContainer: THREE.Group;
  position: THREE.Vector3;
  isCleared: boolean;
  fellProgress: number;
  fallDirectionAngle: number;
  hasPlayedThud?: boolean;
}

export function FocusWorldCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const state = useFocusStore();

  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. WebGL Renderer with Physically Based ACES Tone Mapping & PCFSoftShadowMap
    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d8e6f2');
    // Volumetric exponential distance fog matching the golden-hour horizon
    scene.fog = new THREE.FogExp2('#dfeaf2', 0.0046);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 2. Golden-Hour Atmospheric Sky Dome with Mie Forward Scattering
    const sunDirection = new THREE.Vector3(0.58, 0.46, -0.67).normalize();
    const skyDomeGeo = new THREE.SphereGeometry(210, 48, 32);
    const fallbackSkyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: sunDirection },
        uZenithColor: { value: new THREE.Color('#4a7ab5') },
        uHorizonColor: { value: new THREE.Color('#f3d5b5') },
        uSunGlowColor: { value: new THREE.Color('#ffe8b3') }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunGlowColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float elev = clamp(dir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uZenithColor, pow(elev, 0.55));
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          sky += uSunGlowColor * pow(sunAmt, 8.0) * 0.42;
          sky += vec3(1.0, 0.96, 0.85) * smoothstep(0.996, 0.9995, sunAmt) * 1.4;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });
    const skyDomeMesh = new THREE.Mesh(skyDomeGeo, fallbackSkyMat);
    scene.add(skyDomeMesh);

    // 3. Dual Camera System: Perspective + 45° Isometric Orthographic RTS Camera
    const perspCamera = new THREE.PerspectiveCamera(38, width / height, 0.3, 450);

    const aspect = width / height;
    const orthoFrustum = 36;
    const orthoCamera = new THREE.OrthographicCamera(
      (-orthoFrustum * aspect) / 2,
      (orthoFrustum * aspect) / 2,
      orthoFrustum / 2,
      -orthoFrustum / 2,
      -200,
      450
    );
    orthoCamera.position.set(30, 32, 30);
    orthoCamera.lookAt(0, 0.8, 0);

    const initialStage = latestStateRef.current.cameraStage;
    if (initialStage === 'gate') {
      perspCamera.position.set(0, 5.2, 71.5);
    } else if (initialStage === 'cabin') {
      perspCamera.position.set(0, -33.52, 2.62);
    } else {
      perspCamera.position.set(0, 16.5, 25.5);
    }

    let activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspCamera;

    // 4. Post-Processing Pipeline (UnrealBloomPass + Atmospheric Grade)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, activeCamera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.0, // Disabled radioactive bloom for natural, soft golden-hour realism
      0.55,
      0.82
    );
    bloomPass.enabled = false;
    composer.addPass(bloomPass);

    const gradePass = new ShaderPass(AtmosphericGradeShader);
    composer.addPass(gradePass);

    // 5. OrbitControls
    const controls = new OrbitControls(perspCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minPolarAngle = 0.2;
    controls.minDistance = 8;
    controls.maxDistance = 95;

    if (initialStage === 'gate') {
      controls.target.set(0, 3.0, 55);
    } else if (initialStage === 'cabin') {
      controls.target.set(0, -33.60, -0.4);
    } else {
      controls.target.set(0, 0.8, 0.5);
    }

    const textures = getSharedVillageTextures();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/gltf/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const modelPromiseCache = new Map<string, Promise<THREE.Group>>();
    const characterPromiseCache = new Map<
      string,
      Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null>
    >();

    const HIDDEN_RPG_ACCESSORY_NODES = new Set([
      '1H_Wand',
      '2H_Staff',
      'Spellbook',
      'Spellbook_open',
      '1H_Sword',
      '1H_Sword_Offhand',
      '2H_Sword',
      'Badge_Shield',
      'Rectangle_Shield',
      'Round_Shield',
      'Spike_Shield',
      'Barbarian_Round_Shield',
      '1H_Axe_Offhand',
      '2H_Axe',
      'Mug',
      '1H_Crossbow',
      '2H_Crossbow',
      'Knife',
      'Knife_Offhand',
      'Throwable',
      'Wolf3D_Glasses'
    ]);

    function enhanceLoadedModel(
      root: THREE.Object3D,
      opts?: {
        isCharacter?: boolean;
        keepAxe?: boolean;
        tunicColorHex?: string;
        hairColorHex?: string;
        hasGlasses?: boolean;
        isBuilderMaya?: boolean;
      }
    ) {
      root.traverse((child) => {
        if (HIDDEN_RPG_ACCESSORY_NODES.has(child.name)) {
          if (opts?.keepAxe && child.name === '1H_Axe') {
            child.visible = true;
          } else {
            child.visible = false;
          }
        }
        if (child.name === '1H_Axe' && !opts?.keepAxe) {
          child.visible = false;
        }

        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.name.toLowerCase().includes('glasses')) {
            mesh.visible = !!opts?.hasGlasses;
          }
          mesh.castShadow = !isHeadless;
          mesh.receiveShadow = !isHeadless;

          // Eyelid & facial morph target reset / awake expression
          const skm = mesh as THREE.SkinnedMesh;
          if (skm.morphTargetDictionary && skm.morphTargetInfluences) {
            const dict = skm.morphTargetDictionary;
            const inf = skm.morphTargetInfluences;
            // Always keep eyes wide open and prevent eyelid blink/closed from obscuring eyes
            for (const [key, idx] of Object.entries(dict)) {
              const lower = key.toLowerCase();
              if (lower.includes('blink') || lower.includes('closed') || lower.includes('squint')) {
                inf[idx] = 0;
              }
            }
            if (opts?.isBuilderMaya) {
              if (dict.mouthSmile !== undefined) inf[dict.mouthSmile] = 0.68;
              if (dict.browInnerUp !== undefined) inf[dict.browInnerUp] = 0.22;
              if (dict.eyeWideLeft !== undefined) inf[dict.eyeWideLeft] = 0.14;
              if (dict.eyeWideRight !== undefined) inf[dict.eyeWideRight] = 0.14;
            } else if (opts?.hasGlasses) {
              if (dict.mouthSmile !== undefined) inf[dict.mouthSmile] = 0.22;
              if (dict.browDownLeft !== undefined) inf[dict.browDownLeft] = 0.08;
              if (dict.browDownRight !== undefined) inf[dict.browDownRight] = 0.08;
            }
          }

          const oldMat = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material;
          if (oldMat && (oldMat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = oldMat as THREE.MeshStandardMaterial;
            if (stdMat.map) {
              stdMat.map.colorSpace = THREE.SRGBColorSpace;
              stdMat.map.anisotropy = isHeadless
                ? 1
                : renderer.capabilities.getMaxAnisotropy();
            }
            if (opts?.isCharacter) {
              const matName = (stdMat.name || '').toLowerCase();
              const isEye =
                matName.includes('eye') || mesh.name.toLowerCase().includes('eye');
              const isSkin =
                matName.includes('skin') ||
                matName.includes('head') ||
                matName.includes('body');
              const isOutfitTop = matName.includes('outfit_top');
              const isHair = matName.includes('hair');

              const baseColor = stdMat.color.clone();
              if (isEye) {
                // Ensure eye cornea and sclera have 100% bright, pure diffuse reflectance
                baseColor.set('#ffffff');
              }
              if (isOutfitTop && opts?.tunicColorHex) {
                baseColor.set(opts.tunicColorHex);
              }
              if (isHair && opts?.hairColorHex) {
                baseColor.set(opts.hairColorHex);
              }

              const hairCol =
                isHair && opts?.hairColorHex ? new THREE.Color(opts.hairColorHex) : null;
              const tunicCol =
                isOutfitTop && opts?.tunicColorHex
                  ? new THREE.Color(opts.tunicColorHex)
                  : null;

              const physMat = new THREE.MeshPhysicalMaterial({
                map: stdMat.map,
                normalMap: stdMat.normalMap,
                roughnessMap: stdMat.roughnessMap,
                color: baseColor,
                emissive: hairCol
                  ? hairCol.clone().multiplyScalar(0.42)
                  : tunicCol
                    ? tunicCol.clone().multiplyScalar(0.35)
                    : new THREE.Color(0, 0, 0),
                roughness: isEye ? 0.08 : isHair ? 0.52 : isSkin ? 0.42 : 0.64,
                metalness: 0.02,
                sheen: isHair ? 0.92 : isSkin ? 0.65 : 0.28,
                sheenRoughness: 0.45,
                sheenColor: hairCol ?? new THREE.Color(isSkin ? '#ffbfa0' : '#f5e1c8'),
                clearcoat: isEye ? 1.0 : 0.06,
                clearcoatRoughness: isEye ? 0.05 : 0.35,
                envMapIntensity: 0.95
              });
              mesh.material = physMat;
            } else {
              // Upgrade building/prop materials to calibrated PBR with subtle micro-relief
              const matName = (stdMat.name || mesh.name || '').toLowerCase();
              const isRoof =
                matName.includes('roof') ||
                matName.includes('tile') ||
                matName.includes('slate');
              const isStone =
                matName.includes('stone') ||
                matName.includes('brick') ||
                matName.includes('wall');
              const isMetal =
                matName.includes('iron') ||
                matName.includes('metal') ||
                matName.includes('anvil');

              const pbrMat = new THREE.MeshPhysicalMaterial({
                map: stdMat.map,
                normalMap: stdMat.normalMap ?? (isStone ? textures.stoneWallNormal : null),
                normalScale: new THREE.Vector2(0.35, 0.35),
                bumpMap: isStone ? textures.stoneWallBump : textures.timberLogBump,
                bumpScale: isStone ? 0.04 : 0.025,
                color: stdMat.color,
                roughness: isMetal ? 0.32 : isRoof ? 0.52 : isStone ? 0.78 : 0.66,
                metalness: isMetal ? 0.78 : 0.04,
                clearcoat: isRoof ? 0.18 : 0.04,
                clearcoatRoughness: 0.42,
                envMapIntensity: 0.92
              });
              mesh.material = pbrMat;
            }
          }
        }
      });
    }

    function loadGltfTemplate(url: string): Promise<THREE.Group> {
      let existingPromise = modelPromiseCache.get(url);
      if (!existingPromise) {
        existingPromise = new Promise<THREE.Group>((resolve) => {
          gltfLoader.load(
            url,
            (gltf) => {
              enhanceLoadedModel(gltf.scene);
              resolve(gltf.scene);
            },
            undefined,
            () => resolve(new THREE.Group())
          );
        });
        modelPromiseCache.set(url, existingPromise);
      }
      return existingPromise.then((template) => template.clone(true));
    }

    const sharedKayKitAnimationsPromise = new Promise<THREE.AnimationClip[]>((resolve) => {
      gltfLoader.load(
        '/assets/models/characters/Knight.glb',
        (gltf) => resolve(gltf.animations || []),
        undefined,
        () => resolve([])
      );
    });

    function loadRiggedCharacter(
      url: string,
      opts?: {
        keepAxe?: boolean;
        tunicColorHex?: string;
        hairColorHex?: string;
        hasGlasses?: boolean;
        isBuilderMaya?: boolean;
      }
    ): Promise<{ clone: THREE.Group; animations: THREE.AnimationClip[] } | null> {
      let existingPromise = characterPromiseCache.get(url);
      if (!existingPromise) {
        existingPromise = new Promise((resolve) => {
          gltfLoader.load(
            url,
            (gltf) => {
              resolve({
                scene: gltf.scene,
                animations: gltf.animations || []
              });
            },
            undefined,
            () => resolve(null)
          );
        });
        characterPromiseCache.set(url, existingPromise);
      }
      return existingPromise.then(async (cached) => {
        if (!cached) return null;
        const cloned = SkeletonUtils.clone(cached.scene) as THREE.Group;
        const leftUpLeg = cloned.getObjectByName('LeftUpLeg');
        const isHumanRig = Boolean(leftUpLeg || cloned.getObjectByName('LeftArm'));
        const isIdentityBindRig = Boolean(
          leftUpLeg && Math.abs(leftUpLeg.quaternion.w) > 0.9
        );
        cloned.userData.isIdentityBindRig = isIdentityBindRig;

        cloned.traverse((obj) => {
          if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
            obj.frustumCulled = false;
          }
        });

        if (isHumanRig) {
          // Immediately place arms/hands into a natural relaxed standing pose so character never flashes T-pose/A-pose
          const lArm = cloned.getObjectByName('LeftArm');
          const rArm = cloned.getObjectByName('RightArm');
          const lFore = cloned.getObjectByName('LeftForeArm');
          const rFore = cloned.getObjectByName('RightForeArm');
          const lHand = cloned.getObjectByName('LeftHand');
          const rHand = cloned.getObjectByName('RightHand');
          if (isIdentityBindRig) {
            lArm?.quaternion.set(0.088, 0.172, -0.582, 0.79);
            rArm?.quaternion.set(0.088, -0.172, 0.582, 0.79);
            lFore?.quaternion.set(0.065, 0.015, 0.025, 0.997);
            rFore?.quaternion.set(0.065, -0.015, -0.025, 0.997);
            lHand?.quaternion.set(-0.04, -0.08, -0.05, 0.995);
            rHand?.quaternion.set(-0.04, 0.08, 0.05, 0.995);
          } else {
            lArm?.quaternion.set(0.555, 0.218, 0.181, 0.782);
            rArm?.quaternion.set(0.543, -0.291, -0.172, 0.769);
            lFore?.quaternion.set(0.003, -0.015, 0.074, 0.997);
            rFore?.quaternion.set(0.004, 0.018, -0.087, 0.996);
            lHand?.quaternion.set(-0.14, -0.214, 0.125, 0.959);
            rHand?.quaternion.set(-0.24, 0.312, -0.087, 0.915);
          }
          cloned.updateMatrixWorld(true);
        }

        enhanceLoadedModel(cloned, {
          isCharacter: true,
          keepAxe: opts?.keepAxe,
          tunicColorHex: opts?.tunicColorHex,
          hairColorHex: opts?.hairColorHex,
          hasGlasses: opts?.hasGlasses,
          isBuilderMaya: opts?.isBuilderMaya
        });
        if (opts?.keepAxe) {
          const rightHand =
            cloned.getObjectByName('handslot.r') ||
            cloned.getObjectByName('hand.r') ||
            cloned.getObjectByName('RightHand');
          if (rightHand && !rightHand.getObjectByName('woodcutter_axe')) {
            const axeGroup = new THREE.Group();
            axeGroup.name = 'woodcutter_axe';
            const axeHaft = new THREE.Mesh(
              new THREE.CylinderGeometry(0.02, 0.022, 0.58, 8),
              new THREE.MeshStandardMaterial({ color: '#54361c', roughness: 0.85 })
            );
            axeHaft.position.set(0, 0.16, 0);
            const axeHead = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 0.14, 0.18),
              new THREE.MeshStandardMaterial({
                color: '#4a5568',
                metalness: 0.8,
                roughness: 0.35
              })
            );
            axeHead.position.set(0, 0.38, 0.06);
            axeGroup.add(axeHaft, axeHead);
            axeGroup.rotation.x = Math.PI / 2;
            rightHand.add(axeGroup);
          }
        }
        let anims = cached.animations;
        if (!anims || anims.length === 0) {
          anims = await sharedKayKitAnimationsPromise;
        }
        anims = (anims || []).filter(
          (a) => a.name !== 'T-Pose' && a.name !== 'TPose'
        );
        return { clone: cloned, animations: anims };
      });
    }

    // 6. Physically Based Golden-Hour Valley Lighting & Soft Shadows
    const hemiLight = new THREE.HemisphereLight('#fff4de', '#3d562e', 1.05);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#ffe2ad', 1.75);
    sunLight.position.set(42, 38, -46);
    sunLight.castShadow = !isHeadless;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 165;
    const d = 46;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.radius = 3.5; // Soft shadow penumbra
    sunLight.shadow.bias = -0.00025;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#9ec5f0', 0.62);
    rimLight.position.set(-36, 26, 32);
    scene.add(rimLight);

    // 7. Cohesive Valley Terrain with EASTERN Boundary River (x ≈ 21.5) & Connected Village Green
    const worldRoot = new THREE.Group();
    scene.add(worldRoot);

    const terrainGeo = new THREE.PlaneGeometry(240, 240, 160, 160);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors: number[] = [];
    const cMeadow = new THREE.Color('#4f7932');
    const cLush = new THREE.Color('#3b5e23');
    const cHill = new THREE.Color('#61853f');
    const cDirtPath = new THREE.Color('#b6976b');
    const cCobblePlaza = new THREE.Color('#9e886c');
    const cRiverbank = new THREE.Color('#7a6d56');
    const tmpColor = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      let vy = groundHeightAt(vx, vz, latestStateRef.current.worldSeed);

      // Eastern boundary river channel (x ≈ 21.5)
      const riverX = riverCenterXAtZ(vz);
      const distToRiver = Math.abs(vx - riverX);

      // Keep main village settlement floor (x ∈ [-15, +15], z ∈ [-15, +13]) flat & level
      if (vx > -15.5 && vx < 15.5 && vz > -15.0 && vz < 13.5) {
        vy *= 0.16;
      }

      // Carve the eastern boundary river bed smoothly
      if (distToRiver < RIVER_HALF_WIDTH) {
        const riverDepth =
          Math.cos((distToRiver / RIVER_HALF_WIDTH) * (Math.PI * 0.5)) * 0.95;
        vy = -riverDepth;
      }

      // Gentle alpine valley slopes outside the settlement & east of the river
      if (vx < -24 || vx > 30) {
        const edgeDist = vx < -24 ? Math.abs(vx + 24) : Math.abs(vx - 30);
        vy += Math.pow(edgeDist / 28, 1.45) * 4.8;
      }

      posAttr.setY(i, vy);

      // Village roads: Central Plaza ring (r ≈ 4.2 around (0, 1)), West/East Avenues (x = ±4.5), and Bridge Promenade
      const distFromHub = Math.hypot(vx, vz - 1.0);
      const onCentralPlaza = distFromHub < 3.6 && distFromHub > 1.2;
      const onWestAvenue = Math.abs(vx - -4.4) < 1.35 && vz > -12 && vz < 10;
      const onEastAvenue = Math.abs(vx - 4.4) < 1.35 && vz > -12 && vz < 10;
      const onBridgeRoad =
        (Math.abs(vz - BRIDGE_Z_COORDS[0]) < 1.3 ||
          Math.abs(vz - BRIDGE_Z_COORDS[1]) < 1.3) &&
        vx >= 4.0 &&
        vx <= riverX + 4.5;

      if (distToRiver < RIVER_HALF_WIDTH + 0.55) {
        tmpColor.copy(cRiverbank);
      } else if (onCentralPlaza) {
        tmpColor.copy(cCobblePlaza);
      } else if (onWestAvenue || onEastAvenue || onBridgeRoad) {
        tmpColor.copy(cDirtPath);
      } else if (vy > 1.8) {
        tmpColor.copy(cHill);
      } else {
        const n = (Math.sin(vx * 0.16) + Math.cos(vz * 0.16)) * 0.25 + 0.5;
        tmpColor.copy(cMeadow).lerp(cLush, n);
      }
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      bumpMap: textures.grassMeadowBump,
      bumpScale: 0.09,
      roughness: 0.88,
      metalness: 0.01
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = !isHeadless;
    worldRoot.add(terrainMesh);

    // 7b. 3D Instanced Wind-Swaying Grass Blades Across Meadow
    const grassResult = createInstancedGrassMeadow({
      count: 2800,
      isHeadless,
      groundHeightFn: (x: number, z: number) =>
        groundHeightAt(x, z, latestStateRef.current.worldSeed),
      isObstacleFn: (x: number, z: number) => {
        const inRiver = Math.abs(x - riverCenterXAtZ(z)) < RIVER_HALF_WIDTH + 1.2;
        const inPlaza = Math.hypot(x, z) < 6.5;
        return inRiver || inPlaza;
      }
    });
    worldRoot.add(grassResult.instancedMesh);

    // 8. Sparkling Eastern Boundary River Ribbon (x = riverCenterXAtZ(z))
    const riverGeo = new THREE.PlaneGeometry(RIVER_HALF_WIDTH * 1.9, 165, 16, 140);
    riverGeo.rotateX(-Math.PI / 2);
    const rPos = riverGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i);
      const rz = rPos.getZ(i);
      rPos.setX(i, rx + riverCenterXAtZ(rz));
    }
    riverGeo.computeVertexNormals();

    const riverShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color('#1d4e6b') },
        uShallowColor: { value: new THREE.Color('#4f9ec2') },
        uFoamColor: { value: new THREE.Color('#f8fafc') }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float w = sin(pos.z * 0.7 - uTime * 2.6) * 0.038 + cos(pos.x * 1.5 + uTime * 2.0) * 0.022;
          pos.y += w;
          vWave = w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          float bankFoam = smoothstep(0.36, 0.49, abs(vUv.x - 0.5));
          float rapids = smoothstep(0.56, 0.95, sin(vUv.y * 85.0 - uTime * 4.0) * cos(vUv.x * 24.0));
          vec3 water = mix(uDeepColor, uShallowColor, 0.5 + vWave * 6.0);
          water = mix(water, uFoamColor, bankFoam * 0.58 + rapids * 0.35);
          gl_FragColor = vec4(water, 0.9);
        }
      `
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverShaderMat);
    riverMesh.position.y = -0.14;
    worldRoot.add(riverMesh);

    // 9. Animated Volumetric Valley Mist (AnimatedFog) & Golden Dust Motes
    const animatedFogShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color('#f1f5f9') }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uFogColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vec2 p = vWorldPos.xz * 0.065;
          float n1 = sin(p.x * 1.7 + uTime * 0.22) * cos(p.y * 1.4 - uTime * 0.18);
          float n2 = sin((p.x + p.y) * 2.5 - uTime * 0.31) * 0.5;
          float mist = smoothstep(-0.2, 0.85, (n1 + n2) * 0.5 + 0.5);
          float radialFade = 1.0 - smoothstep(14.0, 52.0, length(vWorldPos.xz));
          float alpha = mist * radialFade * 0.14;
          gl_FragColor = vec4(uFogColor, alpha);
        }
      `
    });

    const fogLayer1 = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      animatedFogShaderMat
    );
    fogLayer1.rotation.x = -Math.PI / 2;
    fogLayer1.position.set(6, 0.55, 0);
    worldRoot.add(fogLayer1);

    const fogLayer2 = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      animatedFogShaderMat
    );
    fogLayer2.rotation.x = -Math.PI / 2;
    fogLayer2.position.set(12, 1.35, -4);
    worldRoot.add(fogLayer2);

    // 10. Stone Bridges Over the Eastern River & Central Village Well (Zero Random Wood Pile Clutter!)
    const environmentGroup = new THREE.Group();
    worldRoot.add(environmentGroup);

    void loadGltfTemplate('/assets/models/buildings/building_bridge_A.gltf').then(
      (bridgeLower) => {
        bridgeLower.position.set(
          riverCenterXAtZ(BRIDGE_Z_COORDS[1]),
          0.06,
          BRIDGE_Z_COORDS[1]
        );
        bridgeLower.rotation.y = Math.PI * 0.5;
        bridgeLower.scale.set(3.8, 3.6, 4.2);
        environmentGroup.add(bridgeLower);

        const bridgeUpper = bridgeLower.clone(true);
        bridgeUpper.position.set(
          riverCenterXAtZ(BRIDGE_Z_COORDS[0]),
          0.06,
          BRIDGE_Z_COORDS[0]
        );
        bridgeUpper.rotation.y = Math.PI * 0.5;
        environmentGroup.add(bridgeUpper);
      }
    );

    // Central Village Well at the Heart of the Settlement (0, 0, 1.0)
    void loadGltfTemplate('/assets/models/buildings/building_well_green.gltf').then(
      (well) => {
        well.position.set(0.0, 0.03, 1.0);
        well.scale.setScalar(3.2);
        environmentGroup.add(well);
      }
    );

    // Natural Riverbank Rocks Along the Eastern Stream (No loose wood piles on grass!)
    const rockPlacements: Array<{
      url: string;
      pos: [number, number, number];
      rot: number;
      scale: number;
    }> = [
      {
        url: '/assets/models/nature/rock_single_A.gltf',
        pos: [riverCenterXAtZ(2.5) - 3.1, -0.08, 2.5],
        rot: 0.5,
        scale: 3.1
      },
      {
        url: '/assets/models/nature/rock_single_B.gltf',
        pos: [riverCenterXAtZ(-1.4) + 3.0, -0.08, -1.4],
        rot: 1.4,
        scale: 2.9
      },
      {
        url: '/assets/models/nature/rock_single_A.gltf',
        pos: [riverCenterXAtZ(-8.2) - 3.0, -0.08, -8.2],
        rot: 2.1,
        scale: 3.3
      }
    ];
    for (const r of rockPlacements) {
      void loadGltfTemplate(r.url).then((obj) => {
        obj.position.set(r.pos[0], r.pos[1], r.pos[2]);
        obj.rotation.y = r.rot;
        obj.scale.setScalar(r.scale);
        environmentGroup.add(obj);
      });
    }

    // Wildflower Clusters in the Meadow
    const flowerColors = ['#facc15', '#f472b6', '#60a5fa', '#fb923c', '#ffffff'];
    const flowerGeo = new THREE.DodecahedronGeometry(0.1, 0);
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.24, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#2d5a1e', roughness: 0.9 });
    const flowerRng = new SeededRandom(latestStateRef.current.worldSeed + 303);
    for (let i = 0; i < 48; i++) {
      const fz = flowerRng.range(-16, 14);
      const fx = flowerRng.range(-15, 16);
      if (Math.hypot(fx, fz - 1.0) < 5.2) continue;
      if (Math.abs(fx - riverCenterXAtZ(fz)) < RIVER_HALF_WIDTH + 1.5) continue;
      const fy = groundHeightAt(fx, fz, latestStateRef.current.worldSeed);
      const patch = new THREE.Group();
      patch.position.set(fx, Math.max(0, fy * 0.16), fz);
      const fMat = new THREE.MeshStandardMaterial({
        color: flowerColors[i % flowerColors.length],
        roughness: 0.6
      });
      for (let b = 0; b < 3; b++) {
        const bx = (b - 1) * 0.22;
        const bz = ((b % 2) - 0.5) * 0.18;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(bx, 0.12, bz);
        const blossom = new THREE.Mesh(flowerGeo, fMat);
        blossom.position.set(bx, 0.25, bz);
        patch.add(stem, blossom);
      }
      environmentGroup.add(patch);
    }

    // 11. Perimeter Pine Forest & Controlled Frontier Tree-Clearing (No left-over wood clutter!)
    const treeUrls = [
      '/assets/models/nature/trees_A_large.gltf',
      '/assets/models/nature/trees_B_large.gltf',
      '/assets/models/nature/trees_A_medium.gltf',
      '/assets/models/nature/trees_B_medium.gltf',
      '/assets/models/nature/tree_single_A.gltf',
      '/assets/models/nature/tree_single_B.gltf'
    ];
    const rng = new SeededRandom(latestStateRef.current.worldSeed + 777);

    const frontierTrees: FrontierTreeEntry[] = [];
    const frontierGroup = new THREE.Group();
    worldRoot.add(frontierGroup);

    const frontierCoords: Array<{ x: number; z: number; dist: number; angle: number }> = [];
    for (let i = 0; i < 32; i++) {
      const ring = Math.floor(i / 11);
      const angle =
        ((i % 11) / 11) * Math.PI * 2 + ring * 0.26 + rng.range(-0.08, 0.08);
      const radius = 16.5 + ring * 5.0 + rng.range(-0.8, 0.8);
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      // Keep eastern river channel and southern camera vista clear
      if (Math.abs(tx - riverCenterXAtZ(tz)) < RIVER_HALF_WIDTH + 2.2) continue;
      if (tz > 13.0 && Math.abs(tx) < 10.5) continue;
      frontierCoords.push({ x: tx, z: tz, dist: Math.hypot(tx, tz), angle });
    }
    frontierCoords.sort((a, b) => a.dist - b.dist);

    frontierCoords.forEach((fc, idx) => {
      const rootGroup = new THREE.Group();
      const ty = Math.max(
        0,
        groundHeightAt(fc.x, fc.z, latestStateRef.current.worldSeed) * 0.25
      );
      rootGroup.position.set(fc.x, ty, fc.z);

      const treeContainer = new THREE.Group();
      rootGroup.add(treeContainer);
      frontierGroup.add(rootGroup);

      const scale = rng.range(1.15, 1.45);
      const rotY = rng.range(0, Math.PI * 2);

      const oakTree = createStylizedOakTree(idx % 4, scale, idx * 37 + 101);
      oakTree.rotation.y = rotY;
      treeContainer.add(oakTree);

      const initiallyCleared = idx < latestStateRef.current.clearedTreesCount;
      if (initiallyCleared) {
        treeContainer.visible = false;
      }

      frontierTrees.push({
        index: idx,
        rootGroup,
        treeContainer,
        position: new THREE.Vector3(fc.x, ty, fc.z),
        isCleared: initiallyCleared,
        fellProgress: initiallyCleared ? 1 : 0,
        fallDirectionAngle: fc.angle,
        hasPlayedThud: initiallyCleared
      });
    });

    // Outer Permanent Forest with Gnarled Stylized Oak Trees & Misty Mountains
    for (let i = 0; i < 44; i++) {
      const angle = (i / 44) * Math.PI * 2 + rng.range(-0.04, 0.04);
      const radius = rng.range(32, 54);
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius - 3;
      if (tz > 18 && Math.abs(tx) < 12) continue;
      if (Math.abs(tx - riverCenterXAtZ(tz)) < RIVER_HALF_WIDTH + 1.8) continue;

      const scale = rng.range(1.35, 1.85);
      const rotY = rng.range(0, Math.PI * 2);
      const ty = Math.max(
        0,
        groundHeightAt(tx, tz, latestStateRef.current.worldSeed)
      );

      const oakTree = createStylizedOakTree(i % 4, scale, i * 53 + 999);
      oakTree.position.set(tx, ty - 0.05, tz);
      oakTree.rotation.y = rotY;
      environmentGroup.add(oakTree);
    }

    const mountainUrls = [
      '/assets/models/nature/mountain_A_grass_trees.gltf',
      '/assets/models/nature/mountain_B_grass_trees.gltf',
      '/assets/models/nature/hills_A_trees.gltf',
      '/assets/models/nature/hills_B_trees.gltf'
    ];
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      if (Math.sin(angle) > 0.6 && Math.abs(Math.cos(angle)) < 0.4) continue;
      const dist = 58 + (i % 3) * 8;
      const mx = Math.cos(angle) * dist;
      const mz = Math.sin(angle) * dist - 6;
      const my = groundHeightAt(mx, mz, latestStateRef.current.worldSeed);
      const mUrl = mountainUrls[i % mountainUrls.length];

      void loadGltfTemplate(mUrl).then((mtn) => {
        mtn.position.set(mx, my - 0.3, mz);
        mtn.rotation.y = angle + Math.PI * 0.5;
        mtn.scale.setScalar(10.0 + (i % 3) * 2.4);
        environmentGroup.add(mtn);
      });
    }

    // 12. Carpenter Crew with Audited AI State Machine (Idle/Assisting when capacity is sufficient!)
    const lumberjackSquad: Array<{
      group: THREE.Group;
      mixer: THREE.AnimationMixer;
      idleAction: THREE.AnimationAction | null;
      chopAction: THREE.AnimationAction | null;
      walkAction: THREE.AnimationAction | null;
      currentMode: 'IDLE' | 'CHOP' | 'WALK';
    }> = [];

    for (let c = 0; c < 2; c++) {
      void loadRiggedCharacter('/assets/models/characters/Barbarian.glb', {
        keepAxe: true,
        tunicColorHex: c === 0 ? '#63381e' : '#2b442b'
      }).then((res) => {
        if (!res) return;
        const { clone, animations } = res;
        clone.scale.setScalar(0.54);
        clone.position.set(c === 0 ? -4.8 : -3.6, 0.05, 4.6);
        worldRoot.add(clone);

        const mixer = new THREE.AnimationMixer(clone);
        const idleClip =
          animations.find((a) => a.name === 'Idle') ??
          animations.find((a) => a.name.includes('Idle')) ??
          animations[0];
        const chopClip =
          animations.find((a) => a.name.includes('Chop')) ??
          animations.find((a) => a.name.includes('Attack')) ??
          idleClip;
        const walkClip =
          animations.find((a) => a.name === 'Walking_A') ??
          animations.find((a) => a.name.includes('Walk')) ??
          idleClip;

        const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
        const chopAction = chopClip ? mixer.clipAction(chopClip) : null;
        const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
        if (idleAction) {
          idleAction.play();
          mixer.update(0);
        }

        lumberjackSquad.push({
          group: clone,
          mixer,
          idleAction,
          chopAction,
          walkAction,
          currentMode: 'IDLE'
        });
      });
    }

    // 13. 3D Village Gatehouse at z=58
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, 58);
    worldRoot.add(gateGroup);

    let leftGateDoorPivot: THREE.Group | null = null;
    let rightGateDoorPivot: THREE.Group | null = null;

    void loadGltfTemplate('/assets/models/buildings/building_tower_A_green.gltf').then(
      (towerL) => {
        towerL.position.set(-4.6, 0, 0);
        towerL.scale.setScalar(4.4);
        gateGroup.add(towerL);

        const towerR = towerL.clone(true);
        towerR.position.set(4.6, 0, 0);
        gateGroup.add(towerR);
      }
    );

    void loadGltfTemplate('/assets/models/buildings/wall_straight.gltf').then(
      (wall) => {
        const wL = wall.clone(true);
        wL.position.set(-9.2, 0, 0);
        wL.scale.setScalar(4.2);
        gateGroup.add(wL);

        const wR = wall.clone(true);
        wR.position.set(9.2, 0, 0);
        wR.scale.setScalar(4.2);
        gateGroup.add(wR);
      }
    );

    const doorWoodMat = new THREE.MeshStandardMaterial({
      map: textures.timberLogMap,
      bumpMap: textures.timberLogBump,
      bumpScale: 0.08,
      roughness: 0.72
    });
    leftGateDoorPivot = new THREE.Group();
    leftGateDoorPivot.position.set(-2.3, 0, 0.2);
    const leftDoorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.25, 3.8, 0.26),
      doorWoodMat
    );
    leftDoorMesh.position.set(1.12, 1.9, 0);
    leftDoorMesh.castShadow = !isHeadless;
    leftGateDoorPivot.add(leftDoorMesh);
    gateGroup.add(leftGateDoorPivot);

    rightGateDoorPivot = new THREE.Group();
    rightGateDoorPivot.position.set(2.3, 0, 0.2);
    const rightDoorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.25, 3.8, 0.26),
      doorWoodMat
    );
    rightDoorMesh.position.set(-1.12, 1.9, 0);
    rightDoorMesh.castShadow = !isHeadless;
    rightGateDoorPivot.add(rightDoorMesh);
    gateGroup.add(rightGateDoorPivot);

    // 14. Cozy 3D Log Cabin Interior
    const cabinGroup = new THREE.Group();
    cabinGroup.position.set(0, -35, 0);
    scene.add(cabinGroup);

    const cabinWallMat = new THREE.MeshStandardMaterial({
      color: '#5a3821',
      map: textures.timberLogMap,
      bumpMap: textures.timberLogBump,
      bumpScale: 0.14,
      roughness: 0.82,
      metalness: 0.02
    });

    const cabinFloorMat = new THREE.MeshStandardMaterial({
      color: '#462a17',
      map: textures.timberLogMap,
      bumpMap: textures.timberLogBump,
      bumpScale: 0.16,
      roughness: 0.78,
      metalness: 0.01
    });

    const cabinFloor = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.3, 12),
      cabinFloorMat
    );
    cabinFloor.position.set(0, -0.15, 0);
    cabinFloor.receiveShadow = !isHeadless;
    cabinGroup.add(cabinFloor);

    const cabinCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.3, 12),
      cabinWallMat
    );
    cabinCeiling.position.set(0, 3.65, 0);
    cabinGroup.add(cabinCeiling);

    // Heavy dark oak ceiling rafters creating dramatic vanishing-point depth along Z
    const rafterGeoZ = new THREE.BoxGeometry(0.28, 0.36, 11);
    const rafterMat = new THREE.MeshStandardMaterial({
      color: '#341f11',
      map: textures.timberLogMap,
      roughness: 0.88
    });
    for (const rx of [-3.8, -1.9, 0, 1.9, 3.8]) {
      const rafter = new THREE.Mesh(rafterGeoZ, rafterMat);
      rafter.position.set(rx, 3.42, 0);
      rafter.castShadow = !isHeadless;
      cabinGroup.add(rafter);
    }
    const rafterGeoX = new THREE.BoxGeometry(12.5, 0.26, 0.32);
    for (const rz of [-2.0, 0.8]) {
      const crossBeam = new THREE.Mesh(rafterGeoX, rafterMat);
      crossBeam.position.set(0, 3.38, rz);
      cabinGroup.add(crossBeam);
    }

    // Heavy round log perimeter walls
    for (let row = 0; row < 10; row++) {
      const backLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 13, 14),
        cabinWallMat
      );
      backLog.rotation.z = Math.PI / 2;
      backLog.position.set(0, 0.2 + row * 0.38, -3.15);
      backLog.receiveShadow = !isHeadless;
      cabinGroup.add(backLog);

      const leftLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 11, 14),
        cabinWallMat
      );
      leftLog.rotation.x = Math.PI / 2;
      leftLog.position.set(-4.8, 0.2 + row * 0.38, 0);
      cabinGroup.add(leftLog);

      const rightLog = leftLog.clone();
      rightLog.position.set(4.8, 0.2 + row * 0.38, 0);
      cabinGroup.add(rightLog);
    }

    // Deep Stone Fireplace & Recessed Hearth Breast
    const hearthStoneMat = new THREE.MeshStandardMaterial({
      color: '#55473e',
      map: textures.stoneWallMap,
      normalMap: textures.stoneWallNormal,
      bumpMap: textures.stoneWallBump,
      bumpScale: 0.14,
      roughness: 0.88,
      metalness: 0.01
    });
    const chimneyHearth = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3.8, 1.35),
      hearthStoneMat
    );
    chimneyHearth.position.set(0, 1.9, -2.75);
    chimneyHearth.receiveShadow = !isHeadless;
    cabinGroup.add(chimneyHearth);

    // Heavy rustic wooden mantel beam
    const mantelBeam = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.22, 0.44),
      rafterMat
    );
    mantelBeam.position.set(0, 1.62, -2.05);
    mantelBeam.castShadow = !isHeadless;
    cabinGroup.add(mantelBeam);

    // Stone arch framing the firebox
    const cobbleGeo = new THREE.DodecahedronGeometry(0.18, 1);
    for (let s = 0; s < 16; s++) {
      const stone = new THREE.Mesh(cobbleGeo, hearthStoneMat);
      const angle = (s / 15) * Math.PI;
      stone.position.set(
        Math.cos(angle) * 0.78,
        0.58 + Math.sin(angle) * 0.65,
        -2.08
      );
      stone.scale.set(1.2, 0.85, 0.7);
      cabinGroup.add(stone);
    }

    // Recessed dark firebox cavity
    const fireboxDark = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.15, 0.8),
      new THREE.MeshBasicMaterial({ color: '#0c0603' })
    );
    fireboxDark.position.set(0, 0.62, -2.35);
    cabinGroup.add(fireboxDark);

    // Burning glowing fireplace logs with embers
    const emberLogMat = new THREE.MeshStandardMaterial({
      color: '#32160b',
      map: textures.timberLogMap,
      bumpMap: textures.timberLogBump,
      bumpScale: 0.15,
      roughness: 0.9,
      emissive: '#ff4805',
      emissiveIntensity: 1.6
    });
    const logGeo1 = new THREE.CylinderGeometry(0.08, 0.09, 0.95, 10);
    const hearthLog1 = new THREE.Mesh(logGeo1, emberLogMat);
    hearthLog1.rotation.z = 0.14;
    hearthLog1.rotation.y = 0.3;
    hearthLog1.position.set(-0.06, 0.18, -2.18);
    cabinGroup.add(hearthLog1);

    const hearthLog2 = new THREE.Mesh(logGeo1, emberLogMat);
    hearthLog2.rotation.z = -0.22;
    hearthLog2.rotation.y = -0.25;
    hearthLog2.position.set(0.12, 0.24, -2.22);
    cabinGroup.add(hearthLog2);

    const hearthLog3 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.75, 10), emberLogMat);
    hearthLog3.rotation.x = 0.35;
    hearthLog3.position.set(0.02, 0.32, -2.12);
    cabinGroup.add(hearthLog3);

    // Woven Hearth Rug on Floor
    const rugGeo = new THREE.PlaneGeometry(3.6, 2.3);
    const rugCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let rugTex: THREE.Texture | null = null;
    if (rugCanvas) {
      rugCanvas.width = 256;
      rugCanvas.height = 160;
      const rc = rugCanvas.getContext('2d');
      if (rc) {
        rc.fillStyle = '#6b2014';
        rc.fillRect(0, 0, 256, 160);
        rc.strokeStyle = '#c49744';
        rc.lineWidth = 10;
        rc.strokeRect(12, 12, 232, 136);
        rc.strokeStyle = '#38120b';
        rc.lineWidth = 4;
        rc.strokeRect(26, 26, 204, 108);
        rc.fillStyle = '#8f331d';
        rc.fillRect(36, 36, 184, 88);
        rc.fillStyle = '#c49744';
        rc.beginPath();
        rc.moveTo(128, 48);
        rc.lineTo(176, 80);
        rc.lineTo(128, 112);
        rc.lineTo(80, 80);
        rc.closePath();
        rc.fill();
      }
      rugTex = new THREE.CanvasTexture(rugCanvas);
    }
    const rugMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      color: rugTex ? '#ffffff' : '#6b2014',
      roughness: 0.95,
      metalness: 0.0
    });
    const rugMesh = new THREE.Mesh(rugGeo, rugMat);
    rugMesh.rotation.x = -Math.PI / 2;
    rugMesh.position.set(0, 0.015, -0.65);
    rugMesh.receiveShadow = !isHeadless;
    cabinGroup.add(rugMesh);

    // Multi-Layer 3D Additive Fire Planes
    const fireShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          float n = sin(uv.y * 11.0 - uTime * 8.0 + sin(uv.x * 9.0 + uTime * 3.5)) * 0.5 + 0.5;
          float shape = (1.0 - uv.y) * smoothstep(0.5, 0.06, abs(uv.x - 0.5 + (n - 0.5) * 0.22 * uv.y));
          float intensity = smoothstep(0.12, 0.88, shape * (0.65 + 0.35 * n));
          vec3 col = mix(vec3(0.98, 0.22, 0.02), vec3(1.0, 0.82, 0.28), uv.y * 0.85 + intensity * 0.35);
          gl_FragColor = vec4(col * intensity * 1.35, intensity);
        }
      `
    });
    const firePlane1 = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.0), fireShaderMat);
    firePlane1.position.set(0, 0.66, -2.05);
    cabinGroup.add(firePlane1);

    const firePlane2 = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 1.12), fireShaderMat);
    firePlane2.position.set(0.04, 0.72, -2.25);
    firePlane2.scale.setScalar(0.92);
    cabinGroup.add(firePlane2);

    // Floating Warm Hearth Ember Particles
    const emberCount = 32;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    const emberData: Array<{ x: number; y: number; z: number; speed: number; seed: number }> = [];
    for (let e = 0; e < emberCount; e++) {
      const ex = (Math.random() - 0.5) * 0.9;
      const ey = 0.3 + Math.random() * 2.4;
      const ez = -2.15 + (Math.random() - 0.5) * 0.5;
      emberPos[e * 3] = ex;
      emberPos[e * 3 + 1] = ey;
      emberPos[e * 3 + 2] = ez;
      emberData.push({
        x: ex,
        y: ey,
        z: ez,
        speed: 0.28 + Math.random() * 0.35,
        seed: Math.random() * Math.PI * 2
      });
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = new THREE.PointsMaterial({
      color: '#ffa33a',
      size: 0.045,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const emberPoints = new THREE.Points(emberGeo, emberMat);
    cabinGroup.add(emberPoints);

    // Hanging Wrought-Iron Lanterns from Ceiling Beams
    const createHangingLantern = (x: number, z: number) => {
      const lGroup = new THREE.Group();
      lGroup.position.set(x, 2.35, z);
      
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 1.05),
        new THREE.MeshStandardMaterial({ color: '#1a1816', metalness: 0.9, roughness: 0.3 })
      );
      rod.position.set(0, 0.52, 0);
      lGroup.add(rod);

      const cage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 0.28, 6),
        new THREE.MeshStandardMaterial({ color: '#2b241c', metalness: 0.85, roughness: 0.4 })
      );
      lGroup.add(cage);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe294' })
      );
      lGroup.add(core);

      const lLight = new THREE.PointLight('#ffba52', 1.4, 6.5, 1.25);
      lLight.position.set(0, 0, 0);
      lGroup.add(lLight);

      cabinGroup.add(lGroup);
    };
    createHangingLantern(-2.1, 0.35);
    createHangingLantern(2.1, 0.35);

    // Cinematic Unreal-Engine 3-Point Lighting Setup
    const cabinFireLight = new THREE.PointLight('#ff7a18', 2.6, 9.5, 1.2);
    cabinFireLight.position.set(0, 0.95, -1.7);
    cabinFireLight.castShadow = !isHeadless;
    cabinGroup.add(cabinFireLight);

    const cabinKeyLight = new THREE.PointLight('#ffe6be', 1.25, 9, 1.15);
    cabinKeyLight.position.set(0, 1.7, 2.2);
    cabinGroup.add(cabinKeyLight);

    // Dual High-Intensity Golden Rim Lights right behind character silhouettes!
    const cabinRimLightL = new THREE.PointLight('#ffba66', 2.3, 6.2, 1.1);
    cabinRimLightL.position.set(-1.25, 1.6, -0.12);
    cabinGroup.add(cabinRimLightL);

    const cabinRimLightR = new THREE.PointLight('#ffba66', 2.3, 6.2, 1.1);
    cabinRimLightR.position.set(1.25, 1.6, -0.12);
    cabinGroup.add(cabinRimLightR);

    // Atmospheric Props: Medieval Wall Banners & Set-back Furniture (No giant orange block!)
    void loadGltfTemplate('/assets/models/props/banner-green.glb').then((bg) => {
      bg.position.set(-1.95, 2.25, -3.05);
      bg.scale.setScalar(1.15);
      cabinGroup.add(bg);
    });
    void loadGltfTemplate('/assets/models/props/banner-red.glb').then((br) => {
      br.position.set(1.95, 2.25, -3.05);
      br.scale.setScalar(1.15);
      cabinGroup.add(br);
    });
    void loadGltfTemplate('/assets/models/props/table_medium.gltf').then((tbl) => {
      tbl.position.set(2.85, 0, -2.15);
      tbl.rotation.y = -0.35;
      tbl.scale.setScalar(1.1);
      cabinGroup.add(tbl);
    });
    void loadGltfTemplate('/assets/models/props/barrel.gltf').then((bL) => {
      bL.position.set(-2.65, 0, -2.1);
      bL.scale.setScalar(1.35);
      cabinGroup.add(bL);
    });
    void loadGltfTemplate('/assets/models/props/crate.gltf').then((crL) => {
      crL.position.set(-2.25, 0, -2.4);
      crL.rotation.y = 0.28;
      crL.scale.setScalar(1.15);
      cabinGroup.add(crL);
    });

    const cabinCharacterMixers: Array<{
      id: string;
      mixer: THREE.AnimationMixer;
      root: THREE.Group;
      idleAction: THREE.AnimationAction | null;
      speakAction: THREE.AnimationAction | null;
      baseRotY: number;
      talkWeight: number;
    }> = [];

    const cabinHumanSpecs = [
      {
        id: 'elena',
        url: '/assets/models/characters/villager_elena.glb',
        pos: [-0.85, 0.0, 0.42] as [number, number, number],
        rotY: 0.28,
        scale: 1.0,
        tunicColorHex: '#4a3224',
        hairColorHex: '#22150f',
        talkClip: 'Talking_1',
        hasGlasses: false,
        isBuilderMaya: false
      },
      {
        id: 'clara',
        url: '/assets/models/characters/villager_clara.glb',
        pos: [-0.32, 0.0, 0.22] as [number, number, number],
        rotY: 0.06,
        scale: 1.0,
        tunicColorHex: '#1e4834', // Scholar emerald/teal tunic
        hairColorHex: '#141414', // Jet black hair
        talkClip: 'Talking_1',
        hasGlasses: true, // Distinctive scholar spectacles!
        isBuilderMaya: false
      },
      {
        id: 'maya',
        url: '/assets/models/characters/villager_clara.glb',
        pos: [0.32, 0.0, 0.22] as [number, number, number],
        rotY: -0.06,
        scale: 0.98,
        tunicColorHex: '#6b2218', // Master builder warm terracotta & crimson leather
        hairColorHex: '#b86a34', // Rich warm auburn hair!
        talkClip: 'Talking_0',
        hasGlasses: false,
        isBuilderMaya: true
      },
      {
        id: 'alden',
        url: '/assets/models/characters/readyplayer.glb',
        pos: [0.85, 0.0, 0.42] as [number, number, number],
        rotY: -0.28,
        scale: 1.0,
        tunicColorHex: '#25442e', // Forest green vest with collar
        hairColorHex: '#2a1a10',
        talkClip: 'Talking_1',
        hasGlasses: false,
        isBuilderMaya: false
      }
    ];

    void new Promise<{
      clips: THREE.AnimationClip[];
      sourceBindWorldQuats: Map<string, THREE.Quaternion>;
    }>((resolve) => {
      gltfLoader.load(
        '/assets/models/characters/anim_pack.glb',
        (gltf) => {
          const sourceBindWorldQuats = new Map<string, THREE.Quaternion>();
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((node) => {
            if (node.name) {
              sourceBindWorldQuats.set(
                node.name,
                node.getWorldQuaternion(new THREE.Quaternion())
              );
            }
          });
          const rawClips = gltf.animations || [];
          const sanitizedClips = rawClips.map((clip) => {
            const c = clip.clone();
            // Retain only bone rotation (.quaternion) tracks.
            c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion'));
            return c;
          });
          resolve({ clips: sanitizedClips, sourceBindWorldQuats });
        },
        undefined,
        () => resolve({ clips: [], sourceBindWorldQuats: new Map() })
      );
    }).then(({ clips: sharedHumanAnims, sourceBindWorldQuats }) => {
      const identityQuat = new THREE.Quaternion();

      const retargetClipForCharacter = (
        clip: THREE.AnimationClip,
        targetRoot: THREE.Group,
        isIdentityRig: boolean
      ): THREE.AnimationClip => {
        const qSrc = new THREE.Quaternion();
        const qDst = new THREE.Quaternion();
        const qInvBone = new THREE.Quaternion();
        const qPrev = new THREE.Quaternion();

        const retargetedTracks = clip.tracks.flatMap((track) => {
          if (!track.name.endsWith('.quaternion')) return [];
          const rawTarget = track.name.slice(0, -'.quaternion'.length);
          const boneName = rawTarget.split('/').pop() || rawTarget;
          const bone = targetRoot.getObjectByName(boneName);
          if (!bone) return [];
          const clonedTrack = track.clone();
          const parentName = bone?.parent?.name;
          const qBindBone = sourceBindWorldQuats.get(boneName);
          const qBindParent =
            (parentName ? sourceBindWorldQuats.get(parentName) : undefined) ??
            identityQuat;

          const vals = clonedTrack.values;
          const out = new Float32Array(vals.length);
          if (qBindBone) {
            qInvBone.copy(qBindBone).invert();
          }

          for (let i = 0; i < vals.length; i += 4) {
            qSrc.set(vals[i], vals[i + 1], vals[i + 2], vals[i + 3]);
            if (isIdentityRig && qBindBone) {
              // Retarget from anim_pack ReadyPlayerMe bind space to identity-baked bind space (villager_elena.glb)
              qDst.copy(qBindParent).multiply(qSrc).multiply(qInvBone).normalize();
            } else {
              qDst.copy(qSrc).normalize();
            }

            // Ensure continuous quaternion hemisphere (prevents 180/360° leg & shoulder flips during crossfade/interpolation)
            if (i === 0) {
              if (bone && qDst.dot(bone.quaternion) < 0) {
                qDst.set(-qDst.x, -qDst.y, -qDst.z, -qDst.w);
              }
            } else if (qPrev.dot(qDst) < 0) {
              qDst.set(-qDst.x, -qDst.y, -qDst.z, -qDst.w);
            }
            qPrev.copy(qDst);

            out[i] = qDst.x;
            out[i + 1] = qDst.y;
            out[i + 2] = qDst.z;
            out[i + 3] = qDst.w;
          }
          clonedTrack.values = out;
          return [clonedTrack];
        });

        return new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
      };

      const applyClipFrameZeroToPose = (
        clip: THREE.AnimationClip,
        targetRoot: THREE.Group
      ) => {
        for (const track of clip.tracks) {
          if (!track.name.endsWith('.quaternion') || track.values.length < 4) continue;
          const rawTarget = track.name.slice(0, -'.quaternion'.length);
          const boneName = rawTarget.split('/').pop() || rawTarget;
          const bone = targetRoot.getObjectByName(boneName);
          if (bone) {
            bone.quaternion.set(
              track.values[0],
              track.values[1],
              track.values[2],
              track.values[3]
            );
          }
        }
        targetRoot.updateMatrixWorld(true);
      };

      for (const spec of cabinHumanSpecs) {
        void loadRiggedCharacter(spec.url, {
          tunicColorHex: spec.tunicColorHex,
          hairColorHex: spec.hairColorHex,
          hasGlasses: spec.hasGlasses,
          isBuilderMaya: spec.isBuilderMaya
        }).then((res) => {
          if (!res) return;
          const { clone } = res;
          clone.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
          clone.rotation.y = spec.rotY;
          clone.scale.setScalar(spec.scale);
          cabinGroup.add(clone);

          const isIdentityRig = Boolean(clone.userData.isIdentityBindRig);
          const baseIdle =
            sharedHumanAnims.find((a) => a.name === 'Idle') ?? sharedHumanAnims[0];
          const baseSpeak =
            sharedHumanAnims.find((a) => a.name === spec.talkClip) ?? baseIdle;

          let idleClip: THREE.AnimationClip | null = null;
          let speakClip: THREE.AnimationClip | null = null;

          if (baseIdle) {
            idleClip = retargetClipForCharacter(baseIdle, clone, isIdentityRig);
            // Lock character rest pose to Idle Frame 0 BEFORE AnimationMixer binds PropertyMixers,
            // so fallback/rest pose is always relaxed arms & grounded legs (never T-pose or A-pose).
            applyClipFrameZeroToPose(idleClip, clone);
          }
          if (baseSpeak) {
            speakClip = retargetClipForCharacter(baseSpeak, clone, isIdentityRig);
          }

          const mixer = new THREE.AnimationMixer(clone);
          const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
          const speakAction = speakClip ? mixer.clipAction(speakClip) : null;

          if (idleAction) {
            idleAction.enabled = true;
            idleAction.setEffectiveTimeScale(1);
            idleAction.setEffectiveWeight(1);
            idleAction.play();
          }
          if (speakAction && speakAction !== idleAction) {
            speakAction.enabled = true;
            speakAction.setEffectiveTimeScale(1);
            speakAction.setEffectiveWeight(0);
            speakAction.play();
          }
          mixer.update(0);

          cabinCharacterMixers.push({
            id: spec.id,
            mixer,
            root: clone,
            idleAction,
            speakAction,
            baseRotY: spec.rotY,
            talkWeight: 0
          });
        });
      }
    });

    // 15. Dynamic Village Landmarks (Wood piles ONLY on active/staked plots!)
    const landmarksGroup = new THREE.Group();
    worldRoot.add(landmarksGroup);
    const landmarkControllers = new Map<string, LandmarkRuntimeController>();

    function createChimneySmokeParticles(): THREE.Points {
      const count = 18;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const t = i / count;
        positions[i * 3] = Math.sin(i * 1.7) * (0.12 + t * 0.35);
        positions[i * 3 + 1] = 3.2 + t * 2.8;
        positions[i * 3 + 2] = Math.cos(i * 1.3) * (0.12 + t * 0.35);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: '#f1f5f9',
        size: 0.42,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
      });
      return new THREE.Points(geo, mat);
    }

    function createTransformationVortex(): {
      vortexGroup: THREE.Group;
      helixGold: THREE.Mesh;
      helixCyan: THREE.Mesh;
      sparklePoints: THREE.Points;
    } {
      const vortexGroup = new THREE.Group();
      vortexGroup.visible = false;

      const buildHelixGeo = (
        radius: number,
        height: number,
        turns: number,
        phase: number
      ) => {
        const pts: THREE.Vector3[] = [];
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const angle = t * Math.PI * 2 * turns + phase;
          const r = radius * (1 - t * 0.22);
          pts.push(
            new THREE.Vector3(
              Math.cos(angle) * r,
              t * height + 0.2,
              Math.sin(angle) * r
            )
          );
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        return new THREE.TubeGeometry(curve, 64, 0.065, 8, false);
      };

      const goldMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const cyanMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const helixGold = new THREE.Mesh(buildHelixGeo(2.8, 5.2, 2.6, 0), goldMat);
      const helixCyan = new THREE.Mesh(
        buildHelixGeo(2.95, 5.0, 2.6, Math.PI),
        cyanMat
      );
      vortexGroup.add(helixGold, helixCyan);

      const pCount = 45;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        const a = (i / pCount) * Math.PI * 2 * 4;
        const r = 1.4 + (i % 7) * 0.25;
        pPos[i * 3] = Math.cos(a) * r;
        pPos[i * 3 + 1] = (i / pCount) * 5.2;
        pPos[i * 3 + 2] = Math.sin(a) * r;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        color: '#fef08a',
        size: 0.22,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sparklePoints = new THREE.Points(pGeo, pMat);
      vortexGroup.add(sparklePoints);

      return { vortexGroup, helixGold, helixCyan, sparklePoints };
    }

    const markerRingGeo = new THREE.RingGeometry(1.6, 1.78, 32);
    markerRingGeo.rotateX(-Math.PI / 2);

    function syncVillageLandmarks(
      nodes: LandmarkNode[],
      previewThriving: boolean,
      selectedLandmarkId: string | null
    ) {
      const incomingIds = new Set(nodes.map((n) => n.id));
      for (const [existingId, ctrl] of landmarkControllers.entries()) {
        if (!incomingIds.has(existingId)) {
          landmarksGroup.remove(ctrl.rootGroup);
          landmarkControllers.delete(existingId);
        }
      }

      for (const node of nodes) {
        let ctrl = landmarkControllers.get(node.id);
        const arch =
          BUILDING_ARCHETYPES[node.category] ?? BUILDING_ARCHETYPES.GUILD_WORKSHOP;

        if (!ctrl) {
          const rootGroup = new THREE.Group();
          const groundY = Math.max(
            0,
            groundHeightAt(
              node.position[0],
              node.position[2],
              latestStateRef.current.worldSeed
            ) * 0.16
          );
          rootGroup.position.set(node.position[0], groundY, node.position[2]);
          rootGroup.rotation.y = node.rotationY;
          rootGroup.userData = { landmarkId: node.id };

          // Soft contact shadow disc under every landmark for crisp grounding
          const contactDisc = new THREE.Mesh(
            new THREE.CircleGeometry(2.6, 28),
            new THREE.MeshBasicMaterial({
              color: '#141f0c',
              transparent: true,
              opacity: 0.34,
              depthWrite: false
            })
          );
          contactDisc.rotation.x = -Math.PI / 2;
          contactDisc.position.y = 0.015;
          rootGroup.add(contactDisc);

          const completedModelGroup = new THREE.Group();
          const scaffoldingGroup = new THREE.Group();
          const foundationPlotGroup = new THREE.Group();
          const deferredCacheGroup = new THREE.Group();
          const specialistGroup = new THREE.Group();
          const smokeParticles = createChimneySmokeParticles();

          // Subtle flat stone boundary ring for unstarted queued plots (Zero wood pile clutter!)
          const plotMarkerRing = new THREE.Mesh(
            markerRingGeo,
            new THREE.MeshBasicMaterial({
              color: arch.accentHex,
              transparent: true,
              opacity: 0.32,
              depthWrite: false
            })
          );
          plotMarkerRing.position.y = 0.025;
          plotMarkerRing.userData = { landmarkId: node.id };

          rootGroup.add(
            completedModelGroup,
            scaffoldingGroup,
            foundationPlotGroup,
            plotMarkerRing,
            deferredCacheGroup,
            specialistGroup,
            smokeParticles
          );

          const { vortexGroup, helixGold, helixCyan, sparklePoints } =
            createTransformationVortex();
          rootGroup.add(vortexGroup);

          landmarksGroup.add(rootGroup);

          ctrl = {
            id: node.id,
            node,
            rootGroup,
            completedModelGroup,
            scaffoldingGroup,
            foundationPlotGroup,
            plotMarkerRing,
            deferredCacheGroup,
            vortexGroup,
            helixGold,
            helixCyan,
            sparklePoints,
            smokeParticles,
            RotatingPart: null,
            specialistGroup,
            specialistMixer: null,
            specialistActions: new Map(),
            activeClipName: ''
          };
          landmarkControllers.set(node.id, ctrl);

          void loadGltfTemplate(arch.completedGltf).then((guildMesh) => {
            guildMesh.scale.setScalar(3.85);
            guildMesh.traverse((c) => {
              c.userData = { landmarkId: node.id };
              if (
                c.name.includes('blades') ||
                c.name.includes('saw') ||
                c.name.includes('waterwheel')
              ) {
                if (ctrl) ctrl.RotatingPart = c;
              }
            });
            completedModelGroup.add(guildMesh);

            if (node.category === 'MILL_GRANARY') {
              void loadGltfTemplate('/assets/models/buildings/building_grain.gltf').then(
                (grain) => {
                  grain.position.set(2.6, 0.02, 0.6);
                  grain.scale.setScalar(3.1);
                  completedModelGroup.add(grain);
                }
              );
            }
          });

          void loadGltfTemplate('/assets/models/buildings/building_scaffolding.gltf').then(
            (scaff) => {
              scaff.scale.setScalar(3.85);
              scaff.traverse((c) => {
                c.userData = { landmarkId: node.id };
              });
              scaffoldingGroup.add(scaff);
            }
          );
          void loadGltfTemplate('/assets/models/buildings/building_stage_B.gltf').then(
            (stageB) => {
              stageB.scale.setScalar(3.65);
              stageB.traverse((c) => {
                c.userData = { landmarkId: node.id };
              });
              scaffoldingGroup.add(stageB);
            }
          );

          void loadGltfTemplate('/assets/models/buildings/building_stage_A.gltf').then(
            (stageA) => {
              stageA.scale.setScalar(3.65);
              stageA.traverse((c) => {
                c.userData = { landmarkId: node.id };
              });
              foundationPlotGroup.add(stageA);
            }
          );
          void loadGltfTemplate('/assets/models/props/resource_lumber.gltf').then(
            (lum) => {
              lum.position.set(1.5, 0.05, 1.1);
              lum.scale.setScalar(2.4);
              foundationPlotGroup.add(lum);
            }
          );

          void loadGltfTemplate('/assets/models/props/crate_A_big.gltf').then((cr) => {
            cr.position.set(-0.4, 0.05, 0);
            cr.scale.setScalar(2.2);
            deferredCacheGroup.add(cr);
          });

          void loadRiggedCharacter(arch.characterGlb, {
            keepAxe: node.category === 'GUILD_WORKSHOP'
          }).then((res) => {
            if (!res || !ctrl) return;
            const { clone, animations } = res;
            clone.position.set(1.9, 0.05, 2.1);
            clone.rotation.y = -0.55;
            clone.scale.setScalar(0.54);
            clone.traverse((c) => {
              c.userData = { landmarkId: node.id };
            });
            specialistGroup.add(clone);

            const mixer = new THREE.AnimationMixer(clone);
            ctrl.specialistMixer = mixer;
            for (const clip of animations) {
              ctrl.specialistActions.set(clip.name, mixer.clipAction(clip));
            }

            // Immediately evaluate landmark state and trigger animation so character NEVER T-poses!
            const isCompletedNow = ctrl.node.isCompleted || previewThriving;
            const isBuildingNow = !isCompletedNow && !ctrl.node.isDeferred;
            const desiredClip = isCompletedNow
              ? 'Cheer'
              : isBuildingNow
              ? '1H_Melee_Attack_Chop'
              : 'Idle';
            const actionToPlay =
              ctrl.specialistActions.get(desiredClip) ??
              ctrl.specialistActions.get('1H_Melee_Attack_Chop') ??
              ctrl.specialistActions.get('Interact') ??
              ctrl.specialistActions.get('Idle') ??
              (animations[0] ? mixer.clipAction(animations[0]) : null);
            if (actionToPlay) {
              actionToPlay.reset().play();
              mixer.update(0);
              ctrl.activeClipName = desiredClip;
            }

            const rightHandBone =
              clone.getObjectByName('handslot.r') ||
              clone.getObjectByName('hand.r') ||
              clone.getObjectByName('RightHand');

            // Attach builder mallet to right hand
            if (rightHandBone && !rightHandBone.getObjectByName('builder_mallet')) {
              const malletGroup = new THREE.Group();
              malletGroup.name = 'builder_mallet';
              const handle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.018, 0.34, 8),
                new THREE.MeshStandardMaterial({ color: '#5a3d28', roughness: 0.8 })
              );
              handle.position.set(0, 0.10, 0);
              const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.10, 0.08, 0.08),
                new THREE.MeshStandardMaterial({ color: '#2a1b12', metalness: 0.2, roughness: 0.7 })
              );
              head.position.set(0, 0.22, 0);
              malletGroup.add(handle, head);
              malletGroup.rotation.x = Math.PI / 2;
              rightHandBone.add(malletGroup);
            }

            if (rightHandBone) {
              const mallet = rightHandBone.getObjectByName('builder_mallet');
              if (mallet) mallet.visible = isBuildingNow;
            }

            // If building or waiting for goal completion, position builder right at the scaffold facing timbers!
            if (isBuildingNow) {
              clone.position.set(0.65, 0.05, 1.45);
              clone.rotation.y = -2.35;
            } else {
              clone.position.set(1.9, 0.05, 2.1);
              clone.rotation.y = -0.55;
            }
          });
        }

        ctrl.node = node;
        const showCompleted = node.isCompleted || previewThriving;
        const showActiveConstruction = !showCompleted && !node.isDeferred;
        const showStakedWoodPile =
          !showCompleted && shouldSpawnPlotWoodPile(node, selectedLandmarkId);
        const showDeferred = !showCompleted && node.isDeferred;

        ctrl.completedModelGroup.visible = showCompleted || showActiveConstruction;
        if (showActiveConstruction) {
          ctrl.completedModelGroup.scale.set(0.86, 0.65, 0.86);
        } else {
          ctrl.completedModelGroup.scale.set(1, 1, 1);
        }

        ctrl.smokeParticles.visible = showCompleted;
        ctrl.scaffoldingGroup.visible = showActiveConstruction;
        ctrl.foundationPlotGroup.visible =
          showStakedWoodPile && !showActiveConstruction;
        ctrl.plotMarkerRing.visible =
          !showCompleted && !showActiveConstruction && !showDeferred;
        ctrl.deferredCacheGroup.visible = showDeferred;
        ctrl.specialistGroup.visible = showCompleted || showActiveConstruction;

        const desiredClip = showCompleted
          ? 'Cheer'
          : showActiveConstruction
          ? '1H_Melee_Attack_Chop'
          : 'Idle';
        if (
          ctrl.specialistMixer &&
          ctrl.specialistActions.size > 0 &&
          ctrl.activeClipName !== desiredClip
        ) {
          const nextAction =
            ctrl.specialistActions.get(desiredClip) ??
            ctrl.specialistActions.get('Interact') ??
            ctrl.specialistActions.get('Idle');
          if (nextAction) {
            ctrl.specialistActions.forEach((a) => a.stop());
            nextAction.reset().play();
            ctrl.activeClipName = desiredClip;
          }
        }
      }
    }

    syncVillageLandmarks(
      latestStateRef.current.landmarks,
      latestStateRef.current.previewThrivingTown,
      latestStateRef.current.selectedLandmarkId
    );

    // 16. Villagers Strolling Along Dry NavMesh Village Roads (Never Over River Water!)
    const patrolVillagers: Array<{
      group: THREE.Group;
      mixer: THREE.AnimationMixer;
      routeType: 'PLAZA_RING' | 'WEST_AVENUE' | 'EAST_PROMENADE' | 'BRIDGE_CROSSING';
      speed: number;
      phase: number;
      minCompletedRequired: number;
    }> = [];

    const patrolSpecs: Array<{
      url: string;
      routeType: 'PLAZA_RING' | 'WEST_AVENUE' | 'EAST_PROMENADE' | 'BRIDGE_CROSSING';
      speed: number;
      phase: number;
      minCompleted: number;
      tunicColorHex: string;
    }> = [
      {
        url: '/assets/models/characters/Rogue_Hooded.glb',
        routeType: 'PLAZA_RING',
        speed: 0.32,
        phase: 0,
        minCompleted: 0,
        tunicColorHex: '#d97706'
      },
      {
        url: '/assets/models/characters/Rogue.glb',
        routeType: 'WEST_AVENUE',
        speed: 0.28,
        phase: 1.5,
        minCompleted: 0,
        tunicColorHex: '#dc2626'
      },
      {
        url: '/assets/models/characters/Mage.glb',
        routeType: 'EAST_PROMENADE',
        speed: 0.26,
        phase: 3.1,
        minCompleted: 0,
        tunicColorHex: '#2563eb'
      },
      {
        url: '/assets/models/characters/Knight.glb',
        routeType: 'BRIDGE_CROSSING',
        speed: 0.30,
        phase: 4.5,
        minCompleted: 0,
        tunicColorHex: '#475569'
      }
    ];

    for (const pSpec of patrolSpecs) {
      void loadRiggedCharacter(pSpec.url, { tunicColorHex: pSpec.tunicColorHex }).then((res) => {
        if (!res) return;
        const { clone, animations } = res;
        clone.scale.setScalar(0.52);
        worldRoot.add(clone);
        const mixer = new THREE.AnimationMixer(clone);
        const walkClip =
          animations.find((a) => a.name === 'Walking_A') ??
          animations.find((a) => a.name === 'Walking_B') ??
          animations.find((a) => a.name.includes('Walk')) ??
          animations[0];
        if (walkClip) {
          const walkAct = mixer.clipAction(walkClip);
          walkAct.time = pSpec.phase;
          walkAct.play();
          mixer.update(0);
        }
        patrolVillagers.push({
          group: clone,
          mixer,
          routeType: pSpec.routeType,
          speed: pSpec.speed,
          phase: pSpec.phase,
          minCompletedRequired: pSpec.minCompleted
        });
      });
    }

    // 17. Raycasting for 3D Building Selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent) => {
      soundscapeEngine.unlockAndStart();
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) {
        return;
      }
      if (latestStateRef.current.cameraStage !== 'village') return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, activeCamera);
      const intersects = raycaster.intersectObjects(landmarksGroup.children, true);
      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if (curr.userData?.landmarkId) {
            voiceoverEngine.playWoodClick();
            latestStateRef.current.selectLandmark(curr.userData.landmarkId);
            return;
          }
          curr = curr.parent;
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    renderer.domElement.addEventListener('mouseup', handlePointerUp);

    // 18. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const asp = w / h;

      perspCamera.aspect = asp;
      perspCamera.updateProjectionMatrix();

      orthoCamera.left = (-orthoFrustum * asp) / 2;
      orthoCamera.right = (orthoFrustum * asp) / 2;
      orthoCamera.top = orthoFrustum / 2;
      orthoCamera.bottom = -orthoFrustum / 2;
      orthoCamera.updateProjectionMatrix();

      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 19. Main Animation Loop
    let reqId = 0;
    const clock = new THREE.Clock();
    let lastKnownPulse = latestStateRef.current.transformationPulse;
    let lastKnownSelectedId = latestStateRef.current.selectedLandmarkId;
    let lastKnownStage: string = '';
    const desiredCamPos = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();
    const projVec = new THREE.Vector3();

    let lastHeadlessRenderTime = 0;
    let lastWoodChopTime = 0;
    let lastHammerTapTime = 0;
    let lastCabinCrackleTime = 0;
    let nextCabinCrackleDelay = 3000;

    const animate = (nowMs = 0) => {
      reqId = requestAnimationFrame(animate);
      if (isHeadless && nowMs - lastHeadlessRenderTime < 80) {
        return;
      }
      lastHeadlessRenderTime = nowMs;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const st = latestStateRef.current;

      riverShaderMat.uniforms.uTime.value = elapsed;
      fireShaderMat.uniforms.uTime.value = elapsed;
      animatedFogShaderMat.uniforms.uTime.value = elapsed;
      natureTimeUniform.value = elapsed;

      const isCabin = st.cameraStage === 'cabin';
      cabinGroup.visible = isCabin;
      worldRoot.visible = !isCabin;
      skyDomeMesh.visible = !isCabin;
      scene.background = new THREE.Color(isCabin ? '#1b0e07' : '#d8e6f2');
      sunLight.intensity = isCabin ? 0.05 : 1.75;
      hemiLight.intensity = isCabin ? 0.38 : 1.05;
      rimLight.intensity = isCabin ? 0.12 : 0.62;
      cabinFireLight.intensity = 1.1 + Math.sin(elapsed * 9.0) * 0.18;

      if (
        st.transformationPulse !== lastKnownPulse ||
        st.selectedLandmarkId !== lastKnownSelectedId
      ) {
        lastKnownPulse = st.transformationPulse;
        lastKnownSelectedId = st.selectedLandmarkId;
        syncVillageLandmarks(
          st.landmarks,
          st.previewThrivingTown,
          st.selectedLandmarkId
        );
      }

      const useOrtho =
        st.cameraStage === 'village' && st.cameraProjection === 'ISOMETRIC_RTS';
      activeCamera = useOrtho ? orthoCamera : perspCamera;
      renderPass.camera = activeCamera;
      controls.object = activeCamera;

      if (st.cameraStage !== lastKnownStage) {
        lastKnownStage = st.cameraStage;
        if (st.cameraStage === 'cabin') {
          soundscapeEngine.transitionToPreset('AMBER_STILLNESS');
        } else {
          soundscapeEngine.transitionToPreset('MORNING_BREEZE');
        }

        if (st.cameraStage === 'gate') {
          perspCamera.position.set(0, 5.2, 71.5);
          controls.target.set(0, 3.0, 55);
          perspCamera.lookAt(controls.target);
        } else if (st.cameraStage === 'cabin') {
          perspCamera.position.set(0, -33.52, 2.62);
          controls.target.set(0, -33.60, -0.4);
          perspCamera.lookAt(controls.target);
        } else if (st.cameraStage === 'village') {
          perspCamera.position.set(0, 16.5, 25.5);
          orthoCamera.position.set(30, 32, 30);
          controls.target.set(0, 0.8, 0.5);
          activeCamera.lookAt(controls.target);
          controls.update();
        }
      }

      if (st.cameraStage === 'gate') {
        controls.enabled = false;
        desiredCamPos.set(Math.sin(elapsed * 0.25) * 0.8, 5.2, 71.5);
        desiredTarget.set(0, 3.0, 55);
        perspCamera.position.lerp(desiredCamPos, 0.06);
        controls.target.lerp(desiredTarget, 0.08);
        perspCamera.lookAt(controls.target);
      } else if (st.cameraStage === 'cabin') {
        controls.enabled = false;
        if (nowMs - lastCabinCrackleTime > nextCabinCrackleDelay) {
          soundscapeEngine.playCabinFireCrackle();
          lastCabinCrackleTime = nowMs;
          nextCabinCrackleDelay = 2200 + Math.random() * 2600;
        }
        const audioEnergy = voiceoverEngine.getVoiceAmplitude();
        desiredCamPos.set(
          Math.sin(elapsed * 0.35) * 0.05,
          -33.52 + Math.cos(elapsed * 0.45) * 0.02,
          2.62
        );
        desiredTarget.set(0, -33.60 + audioEnergy * 0.02, -0.4);
        perspCamera.position.lerp(desiredCamPos, 0.08);
        controls.target.lerp(desiredTarget, 0.08);
        perspCamera.lookAt(controls.target);

        // Dynamic hearth fire light flicker & fire shader
        cabinFireLight.intensity =
          2.4 + Math.sin(elapsed * 12.0) * 0.4 + Math.cos(elapsed * 19.0) * 0.25;
        fireShaderMat.uniforms.uTime.value = elapsed;

        // Floating hearth ember particles update
        const emberPositions = emberPoints.geometry.attributes.position.array as Float32Array;
        for (let e = 0; e < emberCount; e++) {
          const ed = emberData[e];
          ed.y += dt * ed.speed;
          if (ed.y > 2.85) {
            ed.y = 0.3 + Math.random() * 0.2;
            ed.x = (Math.random() - 0.5) * 0.8;
            ed.z = -2.15 + (Math.random() - 0.5) * 0.4;
          }
          emberPositions[e * 3] = ed.x + Math.sin(elapsed * 2.2 + ed.seed) * 0.06;
          emberPositions[e * 3 + 1] = ed.y;
          emberPositions[e * 3 + 2] = ed.z + Math.cos(elapsed * 1.8 + ed.seed) * 0.04;
        }
        emberPoints.geometry.attributes.position.needsUpdate = true;

        const isSpeaking = audioEnergy > 0.08;

        for (let i = 0; i < cabinCharacterMixers.length; i++) {
          const cm = cabinCharacterMixers[i];
          const shouldSpeak =
            isSpeaking &&
            (cm.id === 'elena' ||
              cm.id === 'maya' ||
              cm.id === 'clara' ||
              cm.id === 'alden');
          if (cm.speakAction && cm.idleAction && cm.speakAction !== cm.idleAction) {
            const targetTalk = shouldSpeak ? 1 : 0;
            const blendSpeed = shouldSpeak ? 7.5 : 4.5;
            cm.talkWeight +=
              (targetTalk - cm.talkWeight) * Math.min(1, dt * blendSpeed);
            if (cm.talkWeight < 0.001) cm.talkWeight = 0;
            if (cm.talkWeight > 0.999) cm.talkWeight = 1;
            cm.idleAction.enabled = true;
            cm.idleAction.setEffectiveWeight(1 - cm.talkWeight);
            cm.speakAction.enabled = true;
            cm.speakAction.setEffectiveWeight(cm.talkWeight);
          } else if (cm.idleAction) {
            cm.idleAction.enabled = true;
            cm.idleAction.setEffectiveWeight(1);
          }
          cm.mixer.update(dt);
          if (isSpeaking) {
            cm.root.rotation.y =
              cm.baseRotY + Math.sin(elapsed * 5.5 + i) * 0.03 * audioEnergy;
          } else {
            cm.root.rotation.y =
              cm.baseRotY + Math.sin(elapsed * 1.1 + i * 1.4) * 0.015;
          }
        }
      } else {
        controls.enabled = true;
        controls.update();
      }

      if (leftGateDoorPivot && rightGateDoorPivot) {
        const targetDoorAngle = st.cameraStage === 'gate' ? 0 : Math.PI * 0.62;
        leftGateDoorPivot.rotation.y +=
          (-targetDoorAngle - leftGateDoorPivot.rotation.y) * 0.08;
        rightGateDoorPivot.rotation.y +=
          (targetDoorAngle - rightGateDoorPivot.rotation.y) * 0.08;
      }

      // Update Frontier Tree-Felling & Audited Carpenter AI State Machine
      const targetClearedCount = st.previewThrivingTown
        ? frontierTrees.length
        : Math.min(frontierTrees.length, st.clearedTreesCount);

      let activeFellingTree: FrontierTreeEntry | null = null;

      for (const ft of frontierTrees) {
        const shouldBeCleared = ft.index < targetClearedCount;
        if (shouldBeCleared) {
          if (ft.fellProgress < 1.0) {
            ft.isCleared = true;
            ft.fellProgress = Math.min(1.0, ft.fellProgress + dt * 0.45);
            if (ft.fellProgress >= 0.82 && !ft.hasPlayedThud) {
              soundscapeEngine.playTreeFellCrackle(ft.position.x);
              ft.hasPlayedThud = true;
            }
            if (ft.fellProgress < 0.35) {
              const shake = Math.sin(elapsed * 36.0) * 0.06;
              ft.treeContainer.rotation.z = shake;
            } else {
              const fallT = (ft.fellProgress - 0.35) / 0.65;
              const tilt = fallT * fallT * (Math.PI * 0.48);
              ft.treeContainer.rotation.z = Math.cos(ft.fallDirectionAngle) * tilt;
              ft.treeContainer.rotation.x = Math.sin(ft.fallDirectionAngle) * tilt;
            }
            if (!activeFellingTree) {
              activeFellingTree = ft;
            }
          } else {
            ft.treeContainer.visible = false;
          }
        } else {
          ft.isCleared = false;
          ft.fellProgress = 0;
          ft.hasPlayedThud = false;
          ft.treeContainer.visible = true;
          ft.treeContainer.rotation.set(0, 0, 0);
        }
      }

      const plotCapacity = Math.max(8, 8 + Math.floor(st.clearedTreesCount / 2));
      const activeTreeClearWindowMs = Math.max(
        0,
        4000 - (Date.now() - st.lastTreeClearAt)
      );
      const activeBuildPlot = st.landmarks.find(
        (l) => l.isNextStep && !l.isCompleted && !l.isDeferred
      );
      const carpenterAiState = evaluateCarpenterState({
        totalTasksCount: st.tasks.length,
        plotCapacity,
        villageLumber: st.villageLumber,
        activeTreeClearWindowMs: activeFellingTree ? 2500 : activeTreeClearWindowMs,
        hasActiveConstruction: Boolean(activeBuildPlot)
      });

      for (let c = 0; c < lumberjackSquad.length; c++) {
        const lj = lumberjackSquad[c];
        lj.mixer.update(dt);

        if (carpenterAiState === 'CHOPPING_FRONTIER_TREE' && activeFellingTree) {
          if (c === 0 && nowMs - lastWoodChopTime > 1100) {
            soundscapeEngine.playWoodChop(activeFellingTree.position.x);
            lastWoodChopTime = nowMs;
          }
          if (lj.currentMode !== 'CHOP' && lj.chopAction) {
            lj.idleAction?.stop();
            lj.walkAction?.stop();
            lj.chopAction.reset().play();
            lj.currentMode = 'CHOP';
          }
          const offsetAngle = c === 0 ? 0.6 : -0.6;
          const rawX = activeFellingTree.position.x + Math.cos(offsetAngle) * 1.45;
          const rawZ = activeFellingTree.position.z + Math.sin(offsetAngle) * 1.45;
          const [safeX, safeZ] = clampPointOutOfRiver(rawX, rawZ);
          lj.group.position.x += (safeX - lj.group.position.x) * Math.min(1, dt * 4.5);
          lj.group.position.z += (safeZ - lj.group.position.z) * Math.min(1, dt * 4.5);
          lj.group.position.y = activeFellingTree.position.y + 0.05;
          lj.group.lookAt(
            activeFellingTree.position.x,
            activeFellingTree.position.y + 0.8,
            activeFellingTree.position.z
          );
        } else {
          if (activeBuildPlot && c === 0 && nowMs - lastHammerTapTime > 1400) {
            soundscapeEngine.playHammerTap(activeBuildPlot.position[0]);
            lastHammerTapTime = nowMs;
          }
          // Village capacity is sufficient: carpenters rest/assist at their guild station (NOT chopping trees!)
          if (lj.currentMode !== 'IDLE' && lj.idleAction) {
            lj.chopAction?.stop();
            lj.walkAction?.stop();
            lj.idleAction.reset().play();
            lj.currentMode = 'IDLE';
          }
          const stationX = activeBuildPlot
            ? activeBuildPlot.position[0] + (c === 0 ? -2.1 : 2.1)
            : c === 0
            ? -4.8
            : -3.5;
          const stationZ = activeBuildPlot
            ? activeBuildPlot.position[2] + 1.8
            : 4.4;
          const [safeX, safeZ] = clampPointOutOfRiver(stationX, stationZ);
          lj.group.position.x += (safeX - lj.group.position.x) * Math.min(1, dt * 3.5);
          lj.group.position.z += (safeZ - lj.group.position.z) * Math.min(1, dt * 3.5);
          lj.group.position.y = 0.05;
          if (activeBuildPlot) {
            lj.group.lookAt(
              activeBuildPlot.position[0],
              0.8,
              activeBuildPlot.position[2]
            );
          } else {
            lj.group.lookAt(0, 0.8, 1.0);
          }
        }
      }

      // Update Strolling Villagers along Dry NavMesh Village Roads (Never Walking on Water!)
      const completedCount = st.landmarks.filter((l) => l.isCompleted).length;
      for (const pv of patrolVillagers) {
        const isUnlocked =
          st.previewThrivingTown || completedCount >= pv.minCompletedRequired;
        pv.group.visible = isUnlocked;
        if (isUnlocked) {
          pv.mixer.update(dt);
          const t = elapsed * pv.speed + pv.phase;
          let rawX = 0;
          let rawZ = 0;
          let bridgeHeightOffset = 0;

          if (pv.routeType === 'PLAZA_RING') {
            // Circular stroll around the Central Village Well at (0, 1.0)
            rawX = Math.cos(t) * 3.6;
            rawZ = 1.0 + Math.sin(t) * 3.6;
          } else if (pv.routeType === 'WEST_AVENUE') {
            rawX = -4.4;
            rawZ = Math.sin(t * 0.7) * 8.5;
          } else if (pv.routeType === 'EAST_PROMENADE') {
            rawX = 4.4;
            rawZ = Math.cos(t * 0.7) * 8.5;
          } else {
            // Walks strictly along the Lower Stone Bridge approach at z = 6.5
            rawZ = BRIDGE_Z_COORDS[1];
            const bridgeCenter = riverCenterXAtZ(rawZ);
            rawX = bridgeCenter - 6.5 + Math.sin(t * 0.8) * 4.5;
            const distFromBridgeCenter = Math.abs(rawX - bridgeCenter);
            if (distFromBridgeCenter < 3.2) {
              bridgeHeightOffset =
                Math.cos((distFromBridgeCenter / 3.2) * (Math.PI * 0.5)) * 0.42;
            }
          }

          const isBridgeRoute =
            pv.routeType !== 'PLAZA_RING' &&
            pv.routeType !== 'WEST_AVENUE' &&
            pv.routeType !== 'EAST_PROMENADE';
          let vx = rawX;
          let vz = rawZ;
          let vy = 0.04;
          if (isBridgeRoute) {
            vx = rawX;
            vz = rawZ;
            vy = 0.85 + bridgeHeightOffset;
          } else {
            const clamped = clampPointOutOfRiver(rawX, rawZ);
            vx = clamped[0];
            vz = clamped[1];
            vy =
              Math.max(0.04, groundHeightAt(vx, vz, st.worldSeed) * 0.16) +
              bridgeHeightOffset;
          }
          const prevX = pv.group.position.x;
          const prevZ = pv.group.position.z;
          pv.group.position.set(vx, vy, vz);
          const dx = vx - prevX;
          const dz = vz - prevZ;
          if (Math.hypot(dx, dz) > 0.001) {
            pv.group.rotation.y = Math.atan2(dx, dz);
          }
        }
      }

      // Temporary Transformation Rings: ONLY visible during 3.8s Replan window AND ONLY on changed plots!
      const msSinceTransform = Date.now() - st.lastTransformationAt;
      const isTransformingNow =
        st.lastTransformationAt > 0 &&
        msSinceTransform >= 0 &&
        msSinceTransform < 3800;
      const ringEnvelope = isTransformingNow
        ? Math.sin(Math.min(1, msSinceTransform / 3800) * Math.PI)
        : 0;

      for (const ctrl of landmarkControllers.values()) {
        if (ctrl.RotatingPart) {
          ctrl.RotatingPart.rotation.z += dt * 1.65;
        }

        if (ctrl.specialistMixer && ctrl.specialistGroup.visible) {
          ctrl.specialistMixer.update(dt);
        }

        if (ctrl.smokeParticles.visible) {
          ctrl.smokeParticles.rotation.y = elapsed * 0.35;
          ctrl.smokeParticles.position.y = (elapsed * 0.45) % 0.8;
        }

        if (
          isTransformingNow &&
          ringEnvelope > 0.01 &&
          ctrl.node.wasJustTransformed
        ) {
          ctrl.vortexGroup.visible = true;
          ctrl.vortexGroup.rotation.y = elapsed * 2.6;
          const goldMat = ctrl.helixGold.material as THREE.MeshBasicMaterial;
          const cyanMat = ctrl.helixCyan.material as THREE.MeshBasicMaterial;
          const sparkMat = ctrl.sparklePoints.material as THREE.PointsMaterial;

          goldMat.opacity = ringEnvelope * (ctrl.node.isDeferred ? 0.92 : 0.72);
          cyanMat.opacity = ringEnvelope * (ctrl.node.isDeferred ? 0.25 : 0.85);
          sparkMat.opacity = ringEnvelope * 0.9;
        } else {
          ctrl.vortexGroup.visible = false;
        }
      }

      if (isHeadless) {
        renderer.render(scene, activeCamera);
      } else {
        composer.render();
      }
    };

    reqId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown);
      renderer.domElement.removeEventListener('mouseup', handlePointerUp);
      renderer.dispose();
      dracoLoader.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative inset-0 w-full h-full overflow-hidden select-none">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}

export default FocusWorldCanvas;
