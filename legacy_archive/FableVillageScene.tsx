'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { LandmarkNode } from '@/types/world';
import { getVillageTextures } from '@/core/textures/proceduralTextures';
import { voiceoverEngine } from '@/core/audio/voiceoverEngine';

interface FableVillageSceneProps {
  landmarks: LandmarkNode[];
  selectedLandmarkId: string | null;
  isGateClosed: boolean;
  isGateOpening: boolean;
  transformationPulse: number;
  reducedMotion: boolean;
  onSelectLandmark: (id: string) => void;
  onCompleteTask: (taskId: string, title: string) => void;
}

/**
 * Swirling Golden & Arcane-Blue Magical Vortex + Telekinetically Levitating Timbers
 * Matches the Hogwarts-style building reconfiguration in Screenshot 3!
 */
function MagicalTransformationVortex({
  intensityRef
}: {
  intensityRef: React.MutableRefObject<number>;
}) {
  const vortexGroupRef = useRef<THREE.Group>(null);
  const goldRibbonRef = useRef<THREE.Mesh>(null);
  const blueRibbonRef = useRef<THREE.Mesh>(null);
  const floatingTimbersRef = useRef<THREE.Group>(null);
  const sparklesRef = useRef<THREE.Points>(null);

  const { goldTubeGeom, blueTubeGeom, sparkleGeom } = useMemo(() => {
    const goldPts: THREE.Vector3[] = [];
    const bluePts: THREE.Vector3[] = [];
    const steps = 64;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 4.5;
      const radius = 2.55 - t * 0.85;
      const y = 0.25 + t * 3.8;
      goldPts.push(
        new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      );
      bluePts.push(
        new THREE.Vector3(
          Math.cos(angle + Math.PI) * (radius * 0.92),
          y + 0.18,
          Math.sin(angle + Math.PI) * (radius * 0.92)
        )
      );
    }

    const goldCurve = new THREE.CatmullRomCurve3(goldPts);
    const blueCurve = new THREE.CatmullRomCurve3(bluePts);

    const gGeom = new THREE.TubeGeometry(goldCurve, 72, 0.055, 8, false);
    const bGeom = new THREE.TubeGeometry(blueCurve, 72, 0.05, 8, false);

    const pCount = 96;
    const positions = new Float32Array(pCount * 3);
    const colors = new Float32Array(pCount * 3);
    const cGold = new THREE.Color('#FFD54F');
    const cCyan = new THREE.Color('#38BDF8');

    for (let i = 0; i < pCount; i++) {
      const a = (i / pCount) * Math.PI * 8;
      const r = 1.3 + (i % 7) * 0.24;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (i / pCount) * 4.2;
      positions[i * 3 + 2] = Math.sin(a) * r;

      const c = i % 2 === 0 ? cGold : cCyan;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const sGeom = new THREE.BufferGeometry();
    sGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    sGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return {
      goldTubeGeom: gGeom,
      blueTubeGeom: bGeom,
      sparkleGeom: sGeom
    };
  }, []);

  useFrame(({ clock }) => {
    const power = intensityRef.current;
    if (!vortexGroupRef.current) return;

    vortexGroupRef.current.visible = power > 0.02;
    if (power <= 0.02) return;

    const t = clock.getElapsedTime();
    vortexGroupRef.current.rotation.y = t * 2.6;
    const scalePulse = 0.88 + power * 0.22 + Math.sin(t * 5) * 0.04;
    vortexGroupRef.current.scale.set(scalePulse, 1, scalePulse);

    if (goldRibbonRef.current) {
      const mat = goldRibbonRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.min(0.92, power * 1.15);
    }
    if (blueRibbonRef.current) {
      const mat = blueRibbonRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.min(0.88, power * 1.1);
    }

    if (floatingTimbersRef.current) {
      floatingTimbersRef.current.children.forEach((beam, idx) => {
        const angle = idx * ((Math.PI * 2) / 6) - t * 1.4;
        const radius = 1.65 + Math.sin(t * 3 + idx) * 0.25 * power;
        beam.position.set(
          Math.cos(angle) * radius,
          1.2 + (idx % 3) * 0.85 + Math.sin(t * 4 + idx) * 0.35 * power,
          Math.sin(angle) * radius
        );
        beam.rotation.set(
          Math.sin(t * 2.5 + idx) * 0.45 * power,
          angle + Math.PI / 2,
          Math.cos(t * 2.2 + idx) * 0.35 * power
        );
        beam.scale.setScalar(Math.min(1, power * 1.3));
      });
    }

    if (sparklesRef.current) {
      sparklesRef.current.rotation.y = -t * 1.8;
      sparklesRef.current.position.y = Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <group ref={vortexGroupRef}>
      <mesh ref={goldRibbonRef} geometry={goldTubeGeom}>
        <meshStandardMaterial
          color="#FFB300"
          emissive="#FFA000"
          emissiveIntensity={2.8}
          transparent
          opacity={0.85}
          roughness={0.1}
        />
      </mesh>

      <mesh ref={blueRibbonRef} geometry={blueTubeGeom}>
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#0284C7"
          emissiveIntensity={2.6}
          transparent
          opacity={0.82}
          roughness={0.1}
        />
      </mesh>

      <group ref={floatingTimbersRef}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} castShadow>
            <boxGeometry args={[0.72, 0.14, 0.16]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#6E4220' : '#D97706'}
              emissive={i % 2 === 0 ? '#4A2810' : '#F59E0B'}
              emissiveIntensity={0.45}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>

      <points ref={sparklesRef} geometry={sparkleGeom}>
        <pointsMaterial
          size={0.18}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/**
 * Ground-Level Magical Energy Streams Flowing Along the Cobblestone Roads
 * Matches the glowing golden/white/blue trails on the roads in Screenshot 3!
 */
function GroundMagicalPathwayStreams({
  reducedMotion
}: {
  reducedMotion: boolean;
}) {
  const orbGroupRef = useRef<THREE.Group>(null);

  const { streamGeoms, curves } = useMemo(() => {
    const pathDefinitions = [
      [
        new THREE.Vector3(-5.6, 0.12, 2.3),
        new THREE.Vector3(-3.2, 0.16, 2.9),
        new THREE.Vector3(-0.6, 0.14, 2.2),
        new THREE.Vector3(2.4, 0.16, 1.4),
        new THREE.Vector3(5.2, 0.14, -0.4)
      ],
      [
        new THREE.Vector3(-0.8, 0.15, -0.2),
        new THREE.Vector3(0.5, 0.18, -2.4),
        new THREE.Vector3(1.6, 0.2, -4.5),
        new THREE.Vector3(4.5, 0.16, -2.2),
        new THREE.Vector3(7.4, 0.14, 1.2)
      ]
    ];

    const builtCurves = pathDefinitions.map(
      (pts) => new THREE.CatmullRomCurve3(pts)
    );
    const builtGeoms = builtCurves.map(
      (c) => new THREE.TubeGeometry(c, 64, 0.045, 8, false)
    );

    return { streamGeoms: builtGeoms, curves: builtCurves };
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion || !orbGroupRef.current) return;
    const t = clock.getElapsedTime();

    orbGroupRef.current.children.forEach((orb, idx) => {
      const curve = curves[idx % curves.length];
      const progress = (t * 0.22 + idx * 0.25) % 1;
      const pt = curve.getPointAt(progress);
      orb.position.set(pt.x, pt.y + 0.12, pt.z);
    });
  });

  return (
    <group>
      {streamGeoms.map((geom, idx) => (
        <mesh key={`road-stream-${idx}`} geometry={geom}>
          <meshStandardMaterial
            color={idx === 0 ? '#FDE047' : '#38BDF8'}
            emissive={idx === 0 ? '#F59E0B' : '#0284C7'}
            emissiveIntensity={2.1}
            transparent
            opacity={0.72}
          />
        </mesh>
      ))}

      <group ref={orbGroupRef}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={`stream-orb-${i}`}>
            <sphereGeometry args={[0.13, 10, 10]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#FEF08A' : '#7DD3FC'}
              emissive={i % 2 === 0 ? '#F59E0B' : '#0284C7'}
              emissiveIntensity={3.0}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Articulated 3D Storybook Villager (Hair, Tunic, Apron, Swinging Arms, Carried Item)
 * Click any villager in the town square to hear them speak!
 */
function ArticulatedStorybookVillager({
  name,
  role,
  speakerId,
  voiceLine,
  tunicColor,
  apronColor,
  hairColor,
  carrying,
  orbitCenter,
  orbitRadius,
  speed,
  phaseOffset,
  reducedMotion
}: {
  name: string;
  role: string;
  speakerId: 'ELENA_VILLAGER' | 'MAYA_BUILDER' | 'ROWAN_ELDER';
  voiceLine: string;
  tunicColor: string;
  apronColor: string;
  hairColor: string;
  carrying: 'TIMBER' | 'BREAD' | 'LANTERN';
  orbitCenter: [number, number];
  orbitRadius: number;
  speed: number;
  phaseOffset: number;
  reducedMotion: boolean;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!rootRef.current || reducedMotion) return;
    const t = clock.getElapsedTime() * speed + phaseOffset;
    const x = orbitCenter[0] + Math.cos(t) * orbitRadius;
    const z = orbitCenter[1] + Math.sin(t) * (orbitRadius * 0.68);
    const bob = Math.abs(Math.sin(t * 7)) * 0.06;

    rootRef.current.position.set(x, bob, z);
    rootRef.current.rotation.y = -t + Math.PI / 2;

    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 7) * 0.45;
      rightArmRef.current.rotation.x = -Math.sin(t * 7) * 0.45;
    }
  });

  return (
    <group
      ref={rootRef}
      position={[orbitCenter[0] + orbitRadius, 0, orbitCenter[1]]}
      onClick={(e) => {
        e.stopPropagation();
        voiceoverEngine.unlockOnUserGesture();
        void voiceoverEngine.speak({
          speakerId,
          speakerName: name,
          speakerRole: role,
          text: voiceLine
        });
      }}
    >
      {/* Boots */}
      <mesh position={[-0.08, 0.1, 0]} castShadow>
        <boxGeometry args={[0.09, 0.2, 0.13]} />
        <meshStandardMaterial color="#3B2414" roughness={0.85} />
      </mesh>
      <mesh position={[0.08, 0.1, 0]} castShadow>
        <boxGeometry args={[0.09, 0.2, 0.13]} />
        <meshStandardMaterial color="#3B2414" roughness={0.85} />
      </mesh>

      {/* Medieval Tunic Dress / Coat */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.21, 0.44, 12]} />
        <meshStandardMaterial color={tunicColor} roughness={0.72} />
      </mesh>

      {/* Woven Apron / Belt */}
      <mesh position={[0, 0.34, 0.03]} castShadow>
        <cylinderGeometry args={[0.15, 0.19, 0.32, 10]} />
        <meshStandardMaterial color={apronColor} roughness={0.78} />
      </mesh>

      {/* Swinging Arms */}
      <mesh ref={leftArmRef} position={[-0.19, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.045, 0.18, 4, 8]} />
        <meshStandardMaterial color={tunicColor} roughness={0.72} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.19, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.045, 0.18, 4, 8]} />
        <meshStandardMaterial color={tunicColor} roughness={0.72} />
      </mesh>

      {/* Carried Item (Timber Beam, Bread Basket, or Glowing Lantern) */}
      {carrying === 'TIMBER' && (
        <mesh
          position={[0.24, 0.48, 0.12]}
          rotation={[0.2, 0.3, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.06, 0.55, 8]} />
          <meshStandardMaterial color="#7C4D25" roughness={0.85} />
        </mesh>
      )}
      {carrying === 'BREAD' && (
        <mesh position={[0, 0.42, 0.2]} castShadow>
          <sphereGeometry args={[0.11, 8, 8]} />
          <meshStandardMaterial color="#D97706" roughness={0.75} />
        </mesh>
      )}
      {carrying === 'LANTERN' && (
        <mesh position={[0.22, 0.38, 0.14]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial
            color="#FDE047"
            emissive="#F59E0B"
            emissiveIntensity={2.2}
          />
        </mesh>
      )}

      {/* Expressive Head, Eyes & Sculpted Hair */}
      <group position={[0, 0.72, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.155, 16, 16]} />
          <meshStandardMaterial color="#F2C19E" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, -0.02]} castShadow>
          <sphereGeometry args={[0.162, 14, 14]} />
          <meshStandardMaterial color={hairColor} roughness={0.8} />
        </mesh>
        <mesh position={[-0.052, 0.02, 0.14]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#1F140E" />
        </mesh>
        <mesh position={[0.052, 0.02, 0.14]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#1F140E" />
        </mesh>
      </group>
    </group>
  );
}

/**
 * True Overhanging Pitched Medieval Gable Roof with Carved Timber Bargeboards & Ridge Log
 */
function PitchedGableRoof({
  width,
  length,
  height,
  color,
  roofTexture,
  roofNormal,
  bumpTexture
}: {
  width: number;
  length: number;
  height: number;
  color: string;
  roofTexture?: THREE.Texture | null;
  roofNormal?: THREE.Texture | null;
  bumpTexture?: THREE.Texture | null;
}) {
  const roofGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const halfW = width * 0.6;
    shape.moveTo(-halfW, 0);
    shape.lineTo(0, height);
    shape.lineTo(halfW, 0);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: length * 1.12,
      bevelEnabled: false
    });
    geom.translate(0, 0, -(length * 1.12) / 2);
    return geom;
  }, [width, length, height]);

  return (
    <group>
      <mesh geometry={roofGeom} castShadow receiveShadow>
        <meshStandardMaterial
          map={roofTexture ?? null}
          normalMap={roofNormal ?? null}
          bumpMap={bumpTexture ?? null}
          bumpScale={0.06}
          color={color}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, height + 0.02, 0]} castShadow>
        <boxGeometry args={[0.18, 0.18, length * 1.18]} />
        <meshStandardMaterial color="#3B2313" roughness={0.82} />
      </mesh>
      <mesh position={[-width * 0.58, 0.04, 0]} castShadow>
        <boxGeometry args={[0.14, 0.14, length * 1.14]} />
        <meshStandardMaterial color="#4A2E1B" roughness={0.85} />
      </mesh>
      <mesh position={[width * 0.58, 0.04, 0]} castShadow>
        <boxGeometry args={[0.14, 0.14, length * 1.14]} />
        <meshStandardMaterial color="#4A2E1B" roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * Multi-Pane Warm Glowing Medieval Window with Timber Shutters
 */
function GlowingPanedWindow({
  position,
  rotationY = 0,
  isLit = true
}: {
  position: [number, number, number];
  rotationY?: number;
  isLit?: boolean;
}) {
  const glowColor = isLit ? '#FFC145' : '#4A525D';
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[0.44, 0.5, 0.07]} />
        <meshStandardMaterial color="#3A2212" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.35, 0.42, 0.06]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={isLit ? 2.45 : 0.12}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[0.36, 0.04, 0.06]} />
        <meshStandardMaterial color="#3A2212" />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[0.04, 0.44, 0.06]} />
        <meshStandardMaterial color="#3A2212" />
      </mesh>
    </group>
  );
}

/**
 * Complete Multi-Wing Medieval Cottage Compound with Hogwarts Telekinetic Assembly
 * Matches Screenshot 1 & Screenshot 3!
 */
function MedievalCottageCompound({
  position,
  rotationY = 0,
  scale = 1,
  roofStyle = 'THATCH_BROWN',
  hasTower = false,
  isUnderConstruction = false,
  isLit = true,
  magicTriggerKey = 0,
  continuousMagic = false,
  textures
}: {
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  roofStyle?: 'COBALT_BLUE' | 'CRIMSON_RED' | 'THATCH_BROWN';
  hasTower?: boolean;
  isUnderConstruction?: boolean;
  isLit?: boolean;
  magicTriggerKey?: number;
  continuousMagic?: boolean;
  textures: ReturnType<typeof getVillageTextures>;
}) {
  const upperHallRef = useRef<THREE.Group>(null);
  const mainRoofRef = useRef<THREE.Group>(null);
  const crossWingRef = useRef<THREE.Group>(null);
  const towerGroupRef = useRef<THREE.Group>(null);
  const smokeGroupRef = useRef<THREE.Group>(null);
  const magicIntensityRef = useRef<number>(continuousMagic ? 0.65 : 1.0);

  useEffect(() => {
    magicIntensityRef.current = 1.0;
  }, [magicTriggerKey, roofStyle, isUnderConstruction, isLit]);

  const roofColor =
    roofStyle === 'COBALT_BLUE'
      ? '#255785'
      : roofStyle === 'CRIMSON_RED'
      ? '#B8392A'
      : '#A46D3B';

  const roofTex =
    roofStyle === 'COBALT_BLUE'
      ? textures?.slateRoofMap
      : roofStyle === 'CRIMSON_RED'
      ? textures?.terracottaRoofMap
      : textures?.thatchRoofMap;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    const targetFloor = continuousMagic ? 0.58 : 0;
    magicIntensityRef.current = THREE.MathUtils.lerp(
      magicIntensityRef.current,
      targetFloor,
      Math.min(1, delta * 0.85)
    );

    const m = magicIntensityRef.current;

    if (mainRoofRef.current) {
      const floatY =
        1.68 + m * (0.95 + Math.sin(t * 3.8 + position[0]) * 0.25);
      mainRoofRef.current.position.y = floatY;
      mainRoofRef.current.rotation.z = Math.sin(t * 2.8) * 0.11 * m;
      mainRoofRef.current.rotation.x = Math.cos(t * 2.4) * 0.08 * m;
    }

    if (upperHallRef.current) {
      upperHallRef.current.position.y =
        1.05 + m * (0.38 + Math.sin(t * 3.2) * 0.12);
      upperHallRef.current.rotation.y = Math.sin(t * 2.2) * 0.09 * m;
    }

    if (crossWingRef.current) {
      crossWingRef.current.position.y =
        m * (0.62 + Math.cos(t * 3.4 + position[2]) * 0.18);
      crossWingRef.current.rotation.z = Math.cos(t * 2.6) * 0.09 * m;
    }

    if (towerGroupRef.current) {
      towerGroupRef.current.position.y =
        m * (0.78 + Math.sin(t * 3.0) * 0.22);
      towerGroupRef.current.rotation.y = m * Math.sin(t * 2.0) * 0.22;
    }

    if (smokeGroupRef.current && isLit) {
      smokeGroupRef.current.children.forEach((puff, idx) => {
        const cycle = (t * 0.38 + idx * 0.33) % 1;
        puff.position.y = cycle * 1.9;
        puff.position.x = Math.sin(t * 1.6 + idx) * 0.18 * cycle;
        const s = 0.14 + cycle * 0.26;
        puff.scale.set(s, s, s);
      });
    }
  });

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      <MagicalTransformationVortex intensityRef={magicIntensityRef} />

      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.42, 0.48, 1.92]} />
        <meshStandardMaterial
          map={textures?.stoneWallMap ?? null}
          normalMap={textures?.stoneWallNormal ?? null}
          bumpMap={textures?.stoneWallBump ?? null}
          bumpScale={0.05}
          color="#CFC6B6"
          roughness={0.86}
        />
      </mesh>

      <group ref={upperHallRef} position={[0, 1.05, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.25, 1.28, 1.74]} />
          <meshStandardMaterial
            map={textures?.halfTimberMap ?? null}
            normalMap={textures?.halfTimberNormal ?? null}
            color="#FAF0DC"
            roughness={0.72}
          />
        </mesh>

        <GlowingPanedWindow position={[-0.48, 0.05, 0.88]} isLit={isLit} />
        <GlowingPanedWindow position={[-0.48, 0.05, -0.88]} isLit={isLit} />
        <GlowingPanedWindow
          position={[-1.13, 0.05, 0]}
          rotationY={Math.PI / 2}
          isLit={isLit}
        />
        <GlowingPanedWindow
          position={[1.13, 0.05, -0.25]}
          rotationY={Math.PI / 2}
          isLit={isLit}
        />
      </group>

      <group ref={mainRoofRef} position={[0, 1.68, 0]}>
        <PitchedGableRoof
          width={2.25}
          length={1.74}
          height={1.22}
          color={roofColor}
          roofTexture={roofTex}
          roofNormal={textures?.roofNormal}
          bumpTexture={textures?.roofBump}
        />

        <group position={[-0.35, 0.42, 0.55]}>
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.52, 0.55]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              color="#FAF0DC"
              roughness={0.75}
            />
          </mesh>
          <group position={[0, 0.26, 0]}>
            <PitchedGableRoof
              width={0.66}
              length={0.58}
              height={0.38}
              color={roofColor}
              roofTexture={roofTex}
              roofNormal={textures?.roofNormal}
            />
          </group>
          <GlowingPanedWindow position={[0, 0, 0.29]} isLit={isLit} />
        </group>

        <mesh position={[-0.65, 0.68, -0.45]} castShadow>
          <boxGeometry args={[0.38, 1.45, 0.38]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            normalMap={textures?.stoneWallNormal ?? null}
            color="#9E9486"
            roughness={0.9}
          />
        </mesh>
        {isLit && (
          <group position={[-0.65, 1.45, -0.45]} ref={smokeGroupRef}>
            {[0, 1, 2].map((idx) => (
              <mesh key={idx}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial
                  color="#FFFDF9"
                  transparent
                  opacity={0.42}
                />
              </mesh>
            ))}
          </group>
        )}
      </group>

      <group
        ref={crossWingRef}
        position={[0.56, 0, 0.68]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh position={[0, 0.94, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.48, 1.12, 1.38]} />
          <meshStandardMaterial
            map={textures?.halfTimberMap ?? null}
            normalMap={textures?.halfTimberNormal ?? null}
            color="#FAF0DC"
            roughness={0.72}
          />
        </mesh>
        <group position={[0, 1.5, 0]}>
          <PitchedGableRoof
            width={1.48}
            length={1.38}
            height={0.95}
            color={roofColor}
            roofTexture={roofTex}
            roofNormal={textures?.roofNormal}
            bumpTexture={textures?.roofBump}
          />
        </group>
        <GlowingPanedWindow position={[0, 0.95, 0.7]} isLit={isLit} />
      </group>

      {hasTower && (
        <group ref={towerGroupRef} position={[-0.78, 0, -0.25]}>
          <mesh position={[0, 1.88, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.18, 3.25, 1.18]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              normalMap={textures?.halfTimberNormal ?? null}
              color="#F5E8CE"
              roughness={0.74}
            />
          </mesh>
          <mesh
            position={[0, 4.2, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[1.12, 1.62, 4]} />
            <meshStandardMaterial
              map={textures?.slateRoofMap ?? null}
              normalMap={textures?.roofNormal ?? null}
              color="#1D4E89"
              roughness={0.58}
            />
          </mesh>
          <mesh position={[0.38, 4.92, 0]}>
            <boxGeometry args={[0.7, 0.24, 0.04]} />
            <meshStandardMaterial
              color="#2563EB"
              emissive="#1D4ED8"
              emissiveIntensity={0.3}
            />
          </mesh>
          <GlowingPanedWindow position={[0, 2.58, 0.6]} isLit={isLit} />
          <GlowingPanedWindow
            position={[0.6, 2.58, 0]}
            rotationY={Math.PI / 2}
            isLit={isLit}
          />
        </group>
      )}

      <mesh
        position={[-1.32, 0.34, 0.68]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.24, 0.24, 0.52, 12]} />
        <meshStandardMaterial color="#6E4423" roughness={0.8} />
      </mesh>
      <mesh position={[1.25, 0.28, 0.92]} castShadow>
        <boxGeometry args={[0.38, 0.38, 0.38]} />
        <meshStandardMaterial color="#8A5A32" roughness={0.85} />
      </mesh>

      {isLit && (
        <pointLight
          position={[0, 1.5, 1.65]}
          color="#FFA726"
          intensity={2.8}
          distance={8.5}
        />
      )}

      {isUnderConstruction && (
        <group position={[0, 0.2, 0]}>
          {[
            [-1.38, -1.18],
            [1.38, -1.18],
            [-1.38, 1.38],
            [1.38, 1.38]
          ].map(([sx, sz], i) => (
            <mesh key={i} position={[sx, 1.28, sz]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 2.55, 6]} />
              <meshStandardMaterial color="#8C5E32" roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 1.48, 1.38]} castShadow>
            <boxGeometry args={[2.85, 0.08, 0.22]} />
            <meshStandardMaterial color="#A87948" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.78, 1.38]} castShadow>
            <boxGeometry args={[2.85, 0.08, 0.22]} />
            <meshStandardMaterial color="#A87948" roughness={0.85} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Colorful Striped Medieval Market Stall (Center Plaza of Screenshot 1 & 3)
 */
function StripedMarketStall({
  position,
  rotationY = 0,
  stripeColorA,
  stripeColorB
}: {
  position: [number, number, number];
  rotationY?: number;
  stripeColorA: string;
  stripeColorB: string;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.56, 0.88]} />
        <meshStandardMaterial color="#6E4726" roughness={0.85} />
      </mesh>
      {[
        [-0.62, -0.36],
        [0.62, -0.36],
        [-0.62, 0.36],
        [0.62, 0.36]
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, 0.76, pz]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.42, 6]} />
          <meshStandardMaterial color="#4A2E1B" />
        </mesh>
      ))}
      {[-0.48, -0.16, 0.16, 0.48].map((offsetX, idx) => (
        <mesh
          key={idx}
          position={[offsetX, 1.4, 0]}
          rotation={[0.24, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.33, 0.08, 1.15]} />
          <meshStandardMaterial
            color={idx % 2 === 0 ? stripeColorA : stripeColorB}
            roughness={0.68}
          />
        </mesh>
      ))}
      <mesh position={[-0.35, 0.65, 0.15]} castShadow>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#EAB308" />
      </mesh>
      <mesh position={[0.25, 0.65, 0.15]} castShadow>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#EF4444" />
      </mesh>
      <pointLight
        position={[0, 1.15, 0.55]}
        color="#FFB300"
        intensity={1.6}
        distance={4.8}
      />
    </group>
  );
}

/**
 * Instanced Golden Sunflower Field, Upper-Left Wheat Patch, Haystacks & Split-Rail Fences
 */
function SunflowerFieldsAndFences({
  reducedMotion
}: {
  reducedMotion: boolean;
}) {
  const sunflowerGroupRef = useRef<THREE.Group>(null);

  const sunflowers = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; scale: number }> = [];
    const patches = [
      { cx: -6.2, cz: 6.4, rx: 3.3, rz: 1.85, count: 78 },
      { cx: 0.9, cz: 6.8, rx: 3.8, rz: 2.0, count: 92 },
      { cx: 7.4, cz: 5.8, rx: 2.6, rz: 1.55, count: 48 }
    ];
    let s = 42;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (const p of patches) {
      for (let i = 0; i < p.count; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand());
        list.push({
          pos: [
            p.cx + Math.cos(a) * p.rx * r,
            0,
            p.cz + Math.sin(a) * p.rz * r
          ],
          scale: 0.85 + rand() * 0.45
        });
      }
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion || !sunflowerGroupRef.current) return;
    const t = clock.getElapsedTime();
    sunflowerGroupRef.current.rotation.z = Math.sin(t * 1.4) * 0.018;
  });

  return (
    <group>
      <group ref={sunflowerGroupRef}>
        {sunflowers.map((sf, idx) => (
          <group
            key={`sf-${idx}`}
            position={sf.pos}
            scale={[sf.scale, sf.scale, sf.scale]}
          >
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.032, 0.045, 0.5, 5]} />
              <meshStandardMaterial color="#4D7C2B" />
            </mesh>
            <mesh position={[0, 0.5, 0]} rotation={[0.38, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.04, 10]} />
              <meshStandardMaterial
                color="#FBBF24"
                emissive="#D97706"
                emissiveIntensity={0.32}
              />
            </mesh>
            <mesh position={[0, 0.52, 0.02]} rotation={[0.38, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.05, 8]} />
              <meshStandardMaterial color="#3E2211" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Golden Wheat Patch & Conical Haystacks in Upper-Left (Matches Screenshot 1 & 3!) */}
      <group position={[-7.2, 0, -2.8]}>
        {[-0.9, 0, 0.95].map((hx, idx) => (
          <group key={`hay-${idx}`} position={[hx, 0, (idx % 2) * 0.8]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <coneGeometry args={[0.58, 0.95, 10]} />
              <meshStandardMaterial color="#D49B42" roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.45, 0.48, 0.08, 10]} />
              <meshStandardMaterial color="#7C4D25" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Rustic Wooden Split-Rail Fences Framing the Sunflower Fields */}
      {[
        { pos: [-1.8, 0.25, 5.2], rot: -0.25, len: 3.4 },
        { pos: [1.2, 0.25, 4.9], rot: 0.15, len: 3.4 },
        { pos: [4.2, 0.25, 5.4], rot: 0.45, len: 2.8 }
      ].map((f, idx) => (
        <group
          key={`fence-${idx}`}
          position={f.pos as [number, number, number]}
          rotation={[0, f.rot, 0]}
        >
          <mesh position={[-f.len * 0.45, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 0.65, 6]} />
            <meshStandardMaterial color="#5C3A21" />
          </mesh>
          <mesh position={[f.len * 0.45, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 0.65, 6]} />
            <meshStandardMaterial color="#5C3A21" />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[f.len, 0.07, 0.06]} />
            <meshStandardMaterial color="#7C5132" />
          </mesh>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[f.len, 0.07, 0.06]} />
            <meshStandardMaterial color="#7C5132" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function FableVillageScene({
  landmarks,
  selectedLandmarkId,
  isGateClosed,
  isGateOpening,
  transformationPulse,
  reducedMotion,
  onSelectLandmark,
  onCompleteTask
}: FableVillageSceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const leftGateDoorRef = useRef<THREE.Group>(null);
  const rightGateDoorRef = useRef<THREE.Group>(null);

  const textures = useMemo(() => getVillageTextures(), []);

  useFrame((_, delta) => {
    const targetAngle = isGateClosed && !isGateOpening ? 0 : 1.65;
    if (leftGateDoorRef.current && rightGateDoorRef.current) {
      leftGateDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        leftGateDoorRef.current.rotation.y,
        -targetAngle,
        Math.min(1, delta * 3.5)
      );
      rightGateDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        rightGateDoorRef.current.rotation.y,
        targetAngle,
        Math.min(1, delta * 3.5)
      );
    }
  });

  const permanentVillageHouses = useMemo(
    () => [
      {
        pos: [-0.8, 0, -0.6] as [number, number, number],
        rot: 0.25,
        scale: 1.08,
        style: 'COBALT_BLUE' as const,
        hasTower: true
      },
      {
        pos: [3.9, 0, -1.2] as [number, number, number],
        rot: -0.35,
        scale: 1.02,
        style: 'COBALT_BLUE' as const,
        hasTower: false
      },
      {
        pos: [7.6, 0, 1.4] as [number, number, number],
        rot: -0.65,
        scale: 1.06,
        style: 'THATCH_BROWN' as const,
        hasTower: false
      },
      {
        pos: [1.6, 0, -4.8] as [number, number, number],
        rot: 0.12,
        scale: 1.02,
        style: 'THATCH_BROWN' as const,
        hasTower: false
      },
      {
        pos: [-4.6, 0, -4.6] as [number, number, number],
        rot: 0.45,
        scale: 0.92,
        style: 'CRIMSON_RED' as const,
        hasTower: false
      },
      {
        pos: [-2.2, 0, -7.2] as [number, number, number],
        rot: 0.15,
        scale: 0.9,
        style: 'THATCH_BROWN' as const,
        hasTower: false
      },
      {
        pos: [5.8, 0, -5.6] as [number, number, number],
        rot: -0.3,
        scale: 0.92,
        style: 'CRIMSON_RED' as const,
        hasTower: false
      },
      {
        pos: [8.8, 0, -3.2] as [number, number, number],
        rot: -0.5,
        scale: 0.94,
        style: 'THATCH_BROWN' as const,
        hasTower: false
      }
    ],
    []
  );

  const goalPlotCoordinates: Array<{
    pos: [number, number, number];
    rot: number;
    style: 'THATCH_BROWN' | 'COBALT_BLUE' | 'CRIMSON_RED';
  }> = [
    { pos: [-5.8, 0, 2.2], rot: 0.48, style: 'THATCH_BROWN' },
    { pos: [4.4, 0, 4.2], rot: -0.45, style: 'CRIMSON_RED' },
    { pos: [-5.2, 0, -1.6], rot: 0.35, style: 'COBALT_BLUE' },
    { pos: [1.8, 0, 5.5], rot: -0.2, style: 'THATCH_BROWN' },
    { pos: [-2.4, 0, 5.8], rot: 0.25, style: 'CRIMSON_RED' },
    { pos: [6.8, 0, -1.8], rot: -0.4, style: 'COBALT_BLUE' }
  ];

  const forestTrees = useMemo(() => {
    const trees: Array<{
      pos: [number, number, number];
      scale: number;
      color1: string;
      color2: string;
    }> = [];
    const greens = [
      ['#3F6E2A', '#598F3B'],
      ['#4B7D31', '#6DA346'],
      ['#355E23', '#4E8032'],
      ['#6E8B38', '#8AA848']
    ];
    let s = 99;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let i = 0; i < 105; i++) {
      const angle = (i / 105) * Math.PI * 2 + (rand() - 0.5) * 0.08;
      if (Math.abs(angle - Math.PI / 2) < 0.18) continue;

      const radius = 10.6 + rand() * 15.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 1.5;
      const pair = greens[i % greens.length];
      trees.push({
        pos: [x, 0, z],
        scale: 0.95 + rand() * 0.8,
        color1: pair[0],
        color2: pair[1]
      });
    }
    return trees;
  }, []);

  return (
    <group>
      {/* Lush Meadow Ground Plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial
          map={textures?.meadowGrassMap ?? null}
          color="#648E3D"
          roughness={0.88}
        />
      </mesh>

      {/* Winding Sandy-Cobblestone Village Plaza & Roads */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 2.1]}
        receiveShadow
      >
        <circleGeometry args={[6.1, 36]} />
        <meshStandardMaterial
          map={textures?.cobbleMap ?? null}
          color="#CBB99B"
          roughness={0.86}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-3.2, 0.012, 1.8]}
        receiveShadow
      >
        <circleGeometry args={[3.4, 24]} />
        <meshStandardMaterial
          map={textures?.cobbleMap ?? null}
          color="#CBB99B"
          roughness={0.86}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[3.8, 0.012, 1.2]}
        receiveShadow
      >
        <circleGeometry args={[3.4, 24]} />
        <meshStandardMaterial
          map={textures?.cobbleMap ?? null}
          color="#CBB99B"
          roughness={0.86}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 9.5]}
        receiveShadow
      >
        <planeGeometry args={[2.8, 12]} />
        <meshStandardMaterial
          map={textures?.cobbleMap ?? null}
          color="#CBB99B"
          roughness={0.86}
        />
      </mesh>

      {/* Ground-Level Magical Energy Streams Along the Cobblestone Paths (Screenshot 3!) */}
      <GroundMagicalPathwayStreams reducedMotion={reducedMotion} />

      {/* =====================================================================
          FIRST-PERSON 3D VILLAGE GATE ARCHWAY (Swings Open on Entry!)
      ===================================================================== */}
      <group position={[0, 0, 12.2]}>
        <mesh position={[-2.1, 1.8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.85, 0.98, 3.6, 12]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            normalMap={textures?.stoneWallNormal ?? null}
            color="#C8BFB0"
            roughness={0.88}
          />
        </mesh>
        <mesh position={[-2.1, 4.1, 0]} castShadow>
          <coneGeometry args={[1.05, 1.2, 12]} />
          <meshStandardMaterial
            map={textures?.slateRoofMap ?? null}
            normalMap={textures?.roofNormal ?? null}
            color="#255785"
            roughness={0.62}
          />
        </mesh>

        <mesh position={[2.1, 1.8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.85, 0.98, 3.6, 12]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            normalMap={textures?.stoneWallNormal ?? null}
            color="#C8BFB0"
            roughness={0.88}
          />
        </mesh>
        <mesh position={[2.1, 4.1, 0]} castShadow>
          <coneGeometry args={[1.05, 1.2, 12]} />
          <meshStandardMaterial
            map={textures?.slateRoofMap ?? null}
            normalMap={textures?.roofNormal ?? null}
            color="#255785"
            roughness={0.62}
          />
        </mesh>

        <mesh position={[0, 3.2, 0]} castShadow>
          <boxGeometry args={[4.6, 0.55, 0.75]} />
          <meshStandardMaterial color="#4A2E1B" roughness={0.85} />
        </mesh>

        <group position={[-1.3, 0, 0]} ref={leftGateDoorRef}>
          <mesh position={[0.65, 1.45, 0]} castShadow>
            <boxGeometry args={[1.3, 2.8, 0.16]} />
            <meshStandardMaterial color="#5C381E" roughness={0.82} />
          </mesh>
        </group>

        <group position={[1.3, 0, 0]} ref={rightGateDoorRef}>
          <mesh position={[-0.65, 1.45, 0]} castShadow>
            <boxGeometry args={[1.3, 2.8, 0.16]} />
            <meshStandardMaterial color="#5C381E" roughness={0.82} />
          </mesh>
        </group>

        <pointLight
          position={[-1.4, 2.2, 0.8]}
          color="#FF9800"
          intensity={2.5}
          distance={8}
        />
        <pointLight
          position={[1.4, 2.2, 0.8]}
          color="#FF9800"
          intensity={2.5}
          distance={8}
        />
      </group>

      {/* =====================================================================
          PERMANENT MEDIEVAL VILLAGE HOUSES & CENTRAL MARKET SQUARE
      ===================================================================== */}
      {permanentVillageHouses.map((h, idx) => (
        <MedievalCottageCompound
          key={`perm-house-${idx}`}
          position={h.pos}
          rotationY={h.rot}
          scale={h.scale}
          roofStyle={h.style}
          hasTower={h.hasTower}
          isLit={true}
          magicTriggerKey={transformationPulse}
          continuousMagic={idx === 3}
          textures={textures}
        />
      ))}

      {/* 3 Colorful Striped Market Stalls in Center Square */}
      <StripedMarketStall
        position={[-1.6, 0, 2.5]}
        rotationY={0.2}
        stripeColorA="#1E40AF"
        stripeColorB="#DC2626"
      />
      <StripedMarketStall
        position={[0.4, 0, 2.8]}
        rotationY={-0.15}
        stripeColorA="#15803D"
        stripeColorB="#FEF3C7"
      />
      <StripedMarketStall
        position={[1.8, 0, 1.8]}
        rotationY={-0.45}
        stripeColorA="#D97706"
        stripeColorB="#DC2626"
      />

      {/* Low Grey Stone Courtyard Walls */}
      {[
        { pos: [-7.8, 0.25, 2.2], rot: 0, len: 4.6 },
        { pos: [-5.8, 0.25, 4.4], rot: Math.PI / 2, len: 4.3 },
        { pos: [-3.8, 0.25, 2.2], rot: 0, len: 3.9 },
        { pos: [-0.8, 0.25, 1.1], rot: Math.PI / 2, len: 3.5 },
        { pos: [3.2, 0.25, 0.4], rot: 0.4, len: 3.2 }
      ].map((w, i) => (
        <mesh
          key={`stone-wall-${i}`}
          position={w.pos as [number, number, number]}
          rotation={[0, w.rot, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.34, 0.52, w.len]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            normalMap={textures?.stoneWallNormal ?? null}
            color="#9E988E"
            roughness={0.9}
          />
        </mesh>
      ))}

      {/* =====================================================================
          USER'S GOAL BUILDINGS (Hogwarts Telekinetic Transformation + Scaffolding)
      ===================================================================== */}
      {landmarks.map((lm, idx) => {
        const slot = goalPlotCoordinates[idx % goalPlotCoordinates.length];
        const isSelected = lm.id === selectedLandmarkId;
        const isHovered = lm.id === hoveredId;

        return (
          <group
            key={lm.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectLandmark(lm.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId(lm.id);
            }}
            onPointerOut={() => setHoveredId(null)}
          >
            <MedievalCottageCompound
              position={slot.pos}
              rotationY={slot.rot}
              scale={lm.isDeferred ? 0.94 : 1.08}
              roofStyle={
                lm.isCompleted
                  ? 'COBALT_BLUE'
                  : lm.isNextStep
                  ? 'CRIMSON_RED'
                  : slot.style
              }
              hasTower={idx === 0 || lm.isCompleted}
              isUnderConstruction={!lm.isCompleted}
              isLit={lm.isCompleted || lm.isNextStep}
              magicTriggerKey={
                transformationPulse +
                (lm.isCompleted ? 10 : 0) +
                (lm.isDeferred ? 20 : 0)
              }
              continuousMagic={lm.isNextStep && !lm.isCompleted}
              textures={textures}
            />

            {(isSelected || isHovered || lm.isNextStep) && (
              <Html
                position={[slot.pos[0], 4.1, slot.pos[2]]}
                center
                distanceFactor={24}
                zIndexRange={[10, 0]}
              >
                <div
                  className={`flex flex-col items-center rounded border-2 px-3.5 py-2 shadow-2xl ${
                    lm.isCompleted
                      ? 'border-emerald-600 bg-[#FBF6EB] text-[#14532D]'
                      : 'border-amber-400 bg-[#1E140C]/95 text-[#FBF6EB]'
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                    {lm.isCompleted
                      ? '✨ Magical Monument Complete'
                      : '🪄 Telekinetic Builders Active'}
                  </span>
                  <span className="font-display text-sm font-bold whitespace-nowrap">
                    {lm.label} ({lm.subtitle})
                  </span>
                  {!lm.isCompleted && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompleteTask(lm.taskId, lm.label);
                      }}
                      className="mt-1.5 rounded bg-[#15803D] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#166534]"
                    >
                      Finish &amp; Transform Building
                    </button>
                  )}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Golden Sunflower Fields, Wheat Haystacks & Split-Rail Fences */}
      <SunflowerFieldsAndFences reducedMotion={reducedMotion} />

      {/* =====================================================================
          ARTICULATED 3D STORYBOOK VILLAGERS (Click Any Citizen to Hear Them Speak!)
      ===================================================================== */}
      <ArticulatedStorybookVillager
        name="Elena"
        role="Village Steward"
        speakerId="ELENA_VILLAGER"
        voiceLine="Hello! I'm Elena. Every goal you complete brings warm light and new cottages to our village!"
        tunicColor="#5C4428"
        apronColor="#D6C6AA"
        hairColor="#3B2212"
        carrying="LANTERN"
        orbitCenter={[-1.2, 2.6]}
        orbitRadius={2.2}
        speed={0.34}
        phaseOffset={0.0}
        reducedMotion={reducedMotion}
      />
      <ArticulatedStorybookVillager
        name="Maya"
        role="Master Builder"
        speakerId="MAYA_BUILDER"
        voiceLine="Hi there! I'm Maya. Our timber beams and roof gables are enchanted—whenever your plans change, we reshape the village around you!"
        tunicColor="#9E3B24"
        apronColor="#E5D3B3"
        hairColor="#2A160B"
        carrying="TIMBER"
        orbitCenter={[-3.4, 2.2]}
        orbitRadius={2.1}
        speed={0.38}
        phaseOffset={2.1}
        reducedMotion={reducedMotion}
      />
      <ArticulatedStorybookVillager
        name="Elder Rowan"
        role="Town Architect"
        speakerId="ROWAN_ELDER"
        voiceLine="Greetings, founder! Take your time and focus on one step at a time. The village is in good hands."
        tunicColor="#1E3A5F"
        apronColor="#C8B99E"
        hairColor="#4A3525"
        carrying="BREAD"
        orbitCenter={[1.6, 2.4]}
        orbitRadius={2.3}
        speed={0.3}
        phaseOffset={4.2}
        reducedMotion={reducedMotion}
      />
      <ArticulatedStorybookVillager
        name="Clara"
        role="Village Baker"
        speakerId="MAYA_BUILDER"
        voiceLine="Fresh warm loaves from the market square! Keep going on your current goal!"
        tunicColor="#3F6212"
        apronColor="#F5E8CE"
        hairColor="#5C3218"
        carrying="BREAD"
        orbitCenter={[0.2, 3.6]}
        orbitRadius={1.8}
        speed={0.36}
        phaseOffset={1.1}
        reducedMotion={reducedMotion}
      />

      {/* Dense Surrounding Forest Hills */}
      {forestTrees.map((t, idx) => (
        <group
          key={`forest-${idx}`}
          position={t.pos}
          scale={[t.scale, t.scale, t.scale]}
        >
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.25, 1.1, 7]} />
            <meshStandardMaterial color="#4A301C" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.45, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.95, 12, 12]} />
            <meshStandardMaterial color={t.color1} roughness={0.82} />
          </mesh>
          <mesh position={[-0.45, 1.25, 0.35]} castShadow receiveShadow>
            <sphereGeometry args={[0.72, 10, 10]} />
            <meshStandardMaterial color={t.color2} roughness={0.8} />
          </mesh>
          <mesh position={[0.48, 1.3, -0.3]} castShadow receiveShadow>
            <sphereGeometry args={[0.75, 10, 10]} />
            <meshStandardMaterial color={t.color1} roughness={0.82} />
          </mesh>
          <mesh position={[0, 2.05, 0.1]} castShadow receiveShadow>
            <sphereGeometry args={[0.68, 10, 10]} />
            <meshStandardMaterial color={t.color2} roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
