'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LandmarkNode } from '@/types/world';
import { sampleValleyTerrainHeight } from '@/core/pcg/terrainHeight';

interface VillagerAgentsProps {
  landmarks: LandmarkNode[];
  isGreetingCourierActive: boolean;
  reducedMotion: boolean;
  onSelectLandmark: (id: string) => void;
}

interface VillagerCharacterProps {
  tunicColor: string;
  hatColor: string;
  basePosition: [number, number, number];
  patrolRadius: number;
  speedOffset: number;
  isCelebrating?: boolean;
  isRunningToCamera?: boolean;
  reducedMotion: boolean;
}

function StylizedVillager({
  tunicColor,
  hatColor,
  basePosition,
  patrolRadius,
  speedOffset,
  isCelebrating = false,
  isRunningToCamera = false,
  reducedMotion
}: VillagerCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() + speedOffset;

    // Blinking animation
    const blinkCycle = t % 3.6;
    const eyeScaleY = blinkCycle > 3.45 ? 0.12 : 1;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = eyeScaleY;
      rightEyeRef.current.scale.y = eyeScaleY;
    }

    if (reducedMotion) return;

    if (isRunningToCamera) {
      const targetX = basePosition[0] * 0.25;
      const targetZ = 6.8;
      const nx = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetX,
        0.04
      );
      const nz = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ,
        0.04
      );
      const groundY = sampleValleyTerrainHeight(nx, nz);

      groupRef.current.position.set(
        nx,
        groundY + Math.abs(Math.sin(t * 9)) * 0.12,
        nz
      );
      groupRef.current.rotation.y = 0;

      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = 2.4 + Math.sin(t * 10) * 0.35;
      }
      return;
    }

    if (isCelebrating) {
      const cx = basePosition[0];
      const cz = basePosition[2] + 1.85;
      const groundY = sampleValleyTerrainHeight(cx, cz);
      groupRef.current.position.set(
        cx,
        groundY + Math.abs(Math.sin(t * 6.5)) * 0.18,
        cz
      );
      groupRef.current.rotation.y = Math.sin(t * 2) * 0.4;
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.z = -2.3 + Math.sin(t * 8) * 0.25;
        rightArmRef.current.rotation.z = 2.3 - Math.sin(t * 8) * 0.25;
      }
      return;
    }

    const angle = t * 0.55;
    const nextX = basePosition[0] + Math.cos(angle) * patrolRadius;
    const nextZ =
      basePosition[2] + 1.85 + Math.sin(angle) * (patrolRadius * 0.65);
    const groundY = sampleValleyTerrainHeight(nextX, nextZ);

    const dx = nextX - groupRef.current.position.x;
    const dz = nextZ - groupRef.current.position.z;

    groupRef.current.position.set(
      nextX,
      groundY + Math.abs(Math.sin(t * 5.5)) * 0.05,
      nextZ
    );

    if (Math.hypot(dx, dz) > 0.001) {
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }

    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 5.5) * 0.45;
      rightArmRef.current.rotation.x = -Math.sin(t * 5.5) * 0.45;
      leftArmRef.current.rotation.z = -0.2;
      rightArmRef.current.rotation.z = 0.2;
    }
  });

  const initialGroundY = sampleValleyTerrainHeight(
    basePosition[0],
    basePosition[2] + 1.85
  );

  return (
    <group
      ref={groupRef}
      position={[basePosition[0], initialGroundY, basePosition[2] + 1.85]}
    >
      <mesh position={[-0.1, 0.14, 0]} castShadow>
        <boxGeometry args={[0.11, 0.28, 0.14]} />
        <meshStandardMaterial color="#4A3525" roughness={0.85} />
      </mesh>
      <mesh position={[0.1, 0.14, 0]} castShadow>
        <boxGeometry args={[0.11, 0.28, 0.14]} />
        <meshStandardMaterial color="#4A3525" roughness={0.85} />
      </mesh>

      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.23, 0.46, 10]} />
        <meshStandardMaterial color={tunicColor} roughness={0.7} />
      </mesh>

      <mesh position={[0, 0.36, 0.01]} castShadow>
        <cylinderGeometry args={[0.205, 0.215, 0.07, 10]} />
        <meshStandardMaterial color="#5C3A21" roughness={0.8} />
      </mesh>

      <mesh ref={leftArmRef} position={[-0.23, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
        <meshStandardMaterial color={tunicColor} roughness={0.7} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.23, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
        <meshStandardMaterial color={tunicColor} roughness={0.7} />
      </mesh>

      <group position={[0, 0.84, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.19, 16, 16]} />
          <meshStandardMaterial color="#F6D2B8" roughness={0.55} />
        </mesh>

        <mesh ref={leftEyeRef} position={[-0.065, 0.03, 0.17]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshBasicMaterial color="#1F1916" />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.065, 0.03, 0.17]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshBasicMaterial color="#1F1916" />
        </mesh>

        <mesh position={[0, -0.055, 0.172]} rotation={[0.2, 0, Math.PI]}>
          <torusGeometry args={[0.042, 0.011, 6, 12, Math.PI]} />
          <meshBasicMaterial color="#7C3228" />
        </mesh>

        <mesh position={[0, 0.15, -0.02]} rotation={[-0.18, 0, 0]} castShadow>
          <coneGeometry args={[0.21, 0.26, 10]} />
          <meshStandardMaterial color={hatColor} roughness={0.75} />
        </mesh>
      </group>
    </group>
  );
}

function MeadowSheep({
  position,
  speedOffset,
  reducedMotion
}: {
  position: [number, number, number];
  speedOffset: number;
  reducedMotion: boolean;
}) {
  const sheepRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !sheepRef.current) return;
    const t = clock.getElapsedTime() * 0.35 + speedOffset;
    const nx = position[0] + Math.sin(t) * 0.65;
    const nz = position[2] + Math.cos(t * 0.8) * 0.45;
    const ny = sampleValleyTerrainHeight(nx, nz);
    sheepRef.current.position.set(nx, ny, nz);
    sheepRef.current.rotation.y = Math.cos(t) * 1.2;
  });

  const initialY = sampleValleyTerrainHeight(position[0], position[2]);

  return (
    <group ref={sheepRef} position={[position[0], initialY, position[2]]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#FAF6EE" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.24, 0.14]} castShadow>
        <sphereGeometry args={[0.17, 10, 10]} />
        <meshStandardMaterial color="#FAF6EE" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.28, 0.28]} castShadow>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#3A322D" roughness={0.85} />
      </mesh>
    </group>
  );
}

export function VillagerAgents({
  landmarks,
  isGreetingCourierActive,
  reducedMotion
}: VillagerAgentsProps) {
  const VILLAGER_ROSTER = [
    { tunicColor: '#C85A32', hatColor: '#5B7A4A' },
    { tunicColor: '#3B6E8C', hatColor: '#D49B3B' },
    { tunicColor: '#5B874B', hatColor: '#C85A32' },
    { tunicColor: '#9C5278', hatColor: '#6E4C36' }
  ];

  // Town Square ambient villagers + task site builders
  const townSquarePositions: Array<[number, number, number]> = [
    [-1.2, 1.0, 1.8],
    [0.4, 1.0, 2.4]
  ];

  return (
    <group>
      {landmarks.map((lm, idx) => {
        const profile = VILLAGER_ROSTER[idx % VILLAGER_ROSTER.length];
        return (
          <StylizedVillager
            key={`villager-${lm.id}`}
            tunicColor={profile.tunicColor}
            hatColor={profile.hatColor}
            basePosition={lm.position}
            patrolRadius={0.95}
            speedOffset={idx * 1.7}
            isCelebrating={lm.isCompleted}
            isRunningToCamera={isGreetingCourierActive && idx < 2}
            reducedMotion={reducedMotion}
          />
        );
      })}

      {/* Ambient Town Square Citizens */}
      {townSquarePositions.map((pos, idx) => (
        <StylizedVillager
          key={`square-citizen-${idx}`}
          tunicColor={idx === 0 ? '#B45309' : '#1D4ED8'}
          hatColor="#5A3A22"
          basePosition={pos}
          patrolRadius={1.2}
          speedOffset={idx * 2.5 + 1.1}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* Grazing Tiny-Glade Style Meadow Sheep */}
      <MeadowSheep
        position={[-7.2, 1.0, 4.8]}
        speedOffset={0.5}
        reducedMotion={reducedMotion}
      />
      <MeadowSheep
        position={[-6.4, 1.0, 5.6]}
        speedOffset={2.1}
        reducedMotion={reducedMotion}
      />
      <MeadowSheep
        position={[6.8, 1.0, 2.2]}
        speedOffset={3.8}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
