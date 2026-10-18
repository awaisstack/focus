'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  isPointInRiver,
  sampleValleyTerrainHeight
} from '@/core/pcg/terrainHeight';
import type { LandmarkNode } from '@/types/world';

interface InstancedGrassAndFoliageProps {
  landmarks: LandmarkNode[];
  reducedMotion: boolean;
}

export function InstancedGrassAndFoliage({
  landmarks,
  reducedMotion
}: InstancedGrassAndFoliageProps) {
  const grassMeshRef = useRef<THREE.InstancedMesh>(null);
  const flowerMeshRef = useRef<THREE.InstancedMesh>(null);
  const smokeGroupRef = useRef<THREE.Group>(null);

  const grassCount = 5200;
  const flowerCount = 450;

  // Compute deterministic grass & wildflower transforms outside roads, river, and buildings
  const { grassMatrices, grassColors, flowerMatrices, flowerColors } =
    useMemo(() => {
      const gMatrices: THREE.Matrix4[] = [];
      const gColors: THREE.Color[] = [];
      const fMatrices: THREE.Matrix4[] = [];
      const fColors: THREE.Color[] = [];

      const dummy = new THREE.Object3D();
      const grassPalette = [
        new THREE.Color('#5E943A'),
        new THREE.Color('#72A844'),
        new THREE.Color('#4E8030'),
        new THREE.Color('#86B54E'),
        new THREE.Color('#689E3E')
      ];
      const flowerPalette = [
        new THREE.Color('#F59E0B'),
        new THREE.Color('#FEF08A'),
        new THREE.Color('#F472B6'),
        new THREE.Color('#60A5FA')
      ];

      let seed = 1337;
      const nextRand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      for (let i = 0; i < grassCount * 1.5 && gMatrices.length < grassCount; i++) {
        const angle = nextRand() * Math.PI * 2;
        const radius = 2.6 + Math.sqrt(nextRand()) * 22.0;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        if (isPointInRiver(x, z, 2.3)) continue;

        // Keep central cobblestone plaza and building courtyards clear
        if (Math.hypot(x - -1.2, z - 1.5) < 2.8) continue;
        const insideBuilding = landmarks.some(
          (lm) => Math.hypot(x - lm.position[0], z - lm.position[2]) < 2.35
        );
        if (insideBuilding) continue;

        const y = sampleValleyTerrainHeight(x, z);
        dummy.position.set(x, y + 0.14, z);
        dummy.rotation.set(
          (nextRand() - 0.5) * 0.25,
          nextRand() * Math.PI * 2,
          (nextRand() - 0.5) * 0.25
        );
        const scaleY = 0.75 + nextRand() * 0.85;
        const scaleXZ = 0.8 + nextRand() * 0.5;
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.updateMatrix();

        gMatrices.push(dummy.matrix.clone());
        gColors.push(grassPalette[i % grassPalette.length]);

        if (fMatrices.length < flowerCount && nextRand() < 0.11) {
          dummy.position.set(x, y + 0.28, z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          fMatrices.push(dummy.matrix.clone());
          fColors.push(flowerPalette[i % flowerPalette.length]);
        }
      }

      return {
        grassMatrices: gMatrices,
        grassColors: gColors,
        flowerMatrices: fMatrices,
        flowerColors: fColors
      };
    }, [landmarks]);

  useEffect(() => {
    if (grassMeshRef.current) {
      grassMatrices.forEach((mat, idx) => {
        grassMeshRef.current!.setMatrixAt(idx, mat);
        grassMeshRef.current!.setColorAt(idx, grassColors[idx]);
      });
      grassMeshRef.current.instanceMatrix.needsUpdate = true;
      if (grassMeshRef.current.instanceColor) {
        grassMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (flowerMeshRef.current) {
      flowerMatrices.forEach((mat, idx) => {
        flowerMeshRef.current!.setMatrixAt(idx, mat);
        flowerMeshRef.current!.setColorAt(idx, flowerColors[idx]);
      });
      flowerMeshRef.current.instanceMatrix.needsUpdate = true;
      if (flowerMeshRef.current.instanceColor) {
        flowerMeshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [grassMatrices, grassColors, flowerMatrices, flowerColors]);

  // Curated perimeter & hillside woodlands firmly anchored to sampleValleyTerrainHeight
  const perimeterWoods = useMemo(() => {
    const coords: Array<{
      x: number;
      z: number;
      scale: number;
      tone: string;
      subTone: string;
    }> = [
      { x: -11.5, z: -7.5, scale: 1.45, tone: '#4D7C32', subTone: '#689B42' },
      { x: -9.8, z: -9.6, scale: 1.25, tone: '#D9822B', subTone: '#E89B42' },
      { x: -12.8, z: -2.2, scale: 1.35, tone: '#588B3A', subTone: '#74A84E' },
      { x: -11.2, z: 4.5, scale: 1.2, tone: '#4D7C32', subTone: '#689B42' },
      { x: -8.6, z: 9.2, scale: 1.3, tone: '#C97A2B', subTone: '#E0923E' },
      { x: -4.2, z: -10.8, scale: 1.5, tone: '#46732D', subTone: '#5E913C' },
      { x: 0.5, z: -11.4, scale: 1.35, tone: '#D9822B', subTone: '#E89B42' },
      { x: 5.8, z: -10.5, scale: 1.4, tone: '#4D7C32', subTone: '#689B42' },
      { x: 10.6, z: -7.2, scale: 1.5, tone: '#588B3A', subTone: '#74A84E' },
      { x: 12.2, z: -1.8, scale: 1.3, tone: '#C97A2B', subTone: '#E0923E' },
      { x: 11.4, z: 4.2, scale: 1.35, tone: '#4D7C32', subTone: '#689B42' },
      { x: 8.8, z: 8.8, scale: 1.25, tone: '#588B3A', subTone: '#74A84E' },
      { x: -15.5, z: -13.0, scale: 1.8, tone: '#46732D', subTone: '#5E913C' },
      { x: 15.0, z: -12.5, scale: 1.75, tone: '#4D7C32', subTone: '#689B42' },
      { x: -16.2, z: 8.5, scale: 1.65, tone: '#588B3A', subTone: '#74A84E' },
      { x: 15.8, z: 9.2, scale: 1.7, tone: '#D9822B', subTone: '#E89B42' }
    ];

    return coords.map((item, idx) => ({
      id: `wood-tree-${idx}`,
      ...item,
      y: sampleValleyTerrainHeight(item.x, item.z)
    }));
  }, []);

  // Tiny-Glade Dry-Stone Pasture Walls & Fences firmly anchored to terrain height
  const stoneWallSegments = useMemo(() => {
    const pts: Array<{ x: number; z: number; rotY: number }> = [
      { x: -8.2, z: 3.2, rotY: 0.25 },
      { x: -7.4, z: 3.4, rotY: 0.2 },
      { x: -6.6, z: 3.55, rotY: 0.12 },
      { x: 6.4, z: 1.2, rotY: -0.35 },
      { x: 7.2, z: 0.9, rotY: -0.4 },
      { x: 8.0, z: 0.55, rotY: -0.42 }
    ];
    return pts.map((p, i) => ({
      id: `wall-${i}`,
      ...p,
      y: sampleValleyTerrainHeight(p.x, p.z)
    }));
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (smokeGroupRef.current) {
      smokeGroupRef.current.children.forEach((puff, idx) => {
        const cycle = (t * 0.45 + idx * 0.33) % 1;
        puff.position.y = cycle * 2.2;
        puff.position.x = Math.sin(t * 1.5 + idx) * 0.22 * cycle;
        const s = 0.16 + cycle * 0.32;
        puff.scale.set(s, s, s);
      });
    }
  });

  return (
    <group>
      {/* 5,200+ Instanced 3D Meadow Grass Blades */}
      <instancedMesh
        ref={grassMeshRef}
        args={[undefined, undefined, grassMatrices.length]}
        receiveShadow
      >
        <coneGeometry args={[0.07, 0.34, 4]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>

      {/* 450+ Instanced Golden & Blossom Wildflowers */}
      <instancedMesh
        ref={flowerMeshRef}
        args={[undefined, undefined, flowerMatrices.length]}
      >
        <sphereGeometry args={[0.065, 6, 6]} />
        <meshBasicMaterial />
      </instancedMesh>

      {/* Lush Clustered Tiny-Glade / Fabledom Trees (Guaranteed Grounded on Terrain) */}
      {perimeterWoods.map((tree) => (
        <group
          key={tree.id}
          position={[tree.x, tree.y, tree.z]}
          scale={[tree.scale, tree.scale, tree.scale]}
        >
          {/* Gnarled Oak Trunk */}
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.26, 1.2, 8]} />
            <meshStandardMaterial color="#5C3D24" roughness={0.88} />
          </mesh>
          {/* Multi-Puff Sunlit Canopy */}
          <mesh position={[0, 1.45, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.92, 1]} />
            <meshStandardMaterial color={tree.tone} roughness={0.8} />
          </mesh>
          <mesh position={[-0.48, 1.22, 0.32]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.68, 1]} />
            <meshStandardMaterial color={tree.subTone} roughness={0.78} />
          </mesh>
          <mesh position={[0.48, 1.26, -0.28]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.72, 1]} />
            <meshStandardMaterial color={tree.tone} roughness={0.8} />
          </mesh>
          <mesh position={[0.1, 1.92, 0.12]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.62, 1]} />
            <meshStandardMaterial color={tree.subTone} roughness={0.76} />
          </mesh>
        </group>
      ))}

      {/* Grounded Dry-Stone Pasture Walls */}
      {stoneWallSegments.map((seg) => (
        <group
          key={seg.id}
          position={[seg.x, seg.y + 0.18, seg.z]}
          rotation={[0, seg.rotY, 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.88, 0.38, 0.36]} />
            <meshStandardMaterial color="#C8BFAEE" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.82, 0.1, 0.4]} />
            <meshStandardMaterial color="#9E9484" roughness={0.92} />
          </mesh>
        </group>
      ))}

      {/* Cozy Rising Chimney Smoke from the Town Center */}
      <group position={[-1.4, 3.3, 1.2]} ref={smokeGroupRef}>
        {[0, 1, 2, 3].map((idx) => (
          <mesh key={`smoke-${idx}`}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial
              color="#FFFFFF"
              transparent
              opacity={0.45}
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
