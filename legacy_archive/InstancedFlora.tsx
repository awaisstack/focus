'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BiomeDesignTokens } from '@/presets/biomePresets';
import type { DecorationInstance } from '@/types/world';

interface InstancedFloraProps {
  decorations: DecorationInstance[];
  biome: BiomeDesignTokens;
  reducedMotion: boolean;
}

export function InstancedFlora({
  decorations,
  reducedMotion
}: InstancedFloraProps) {
  const swayGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !swayGroupRef.current) return;
    const t = clock.getElapsedTime();
    swayGroupRef.current.rotation.z = Math.sin(t * 0.8) * 0.006;
  });

  // Rich Tiny Glade / Fabledom foliage colors (lush meadow green + warm golden-olive + autumn ochre)
  const canopyPalette = ['#598C42', '#739E48', '#D48C3B', '#4A7B3B'];

  return (
    <group ref={swayGroupRef}>
      {decorations.map((dec, idx) => {
        const canopyColor = canopyPalette[idx % canopyPalette.length];

        if (dec.kind === 'PINE_TREE') {
          // Fluffy Tiny Glade style multi-puff deciduous trees
          return (
            <group
              key={dec.id}
              position={dec.position}
              rotation={[0, dec.rotationY, 0]}
              scale={[dec.scale, dec.scale, dec.scale]}
            >
              {/* Warm Bark Trunk */}
              <mesh position={[0, 0.48, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.21, 0.96, 8]} />
                <meshStandardMaterial color="#6B482E" roughness={0.85} />
              </mesh>
              {/* Fluffy Clustered Canopy Spheres */}
              <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
                <sphereGeometry args={[0.78, 12, 12]} />
                <meshStandardMaterial color={canopyColor} roughness={0.82} />
              </mesh>
              <mesh position={[-0.38, 1.08, 0.25]} castShadow receiveShadow>
                <sphereGeometry args={[0.55, 10, 10]} />
                <meshStandardMaterial color={canopyColor} roughness={0.82} />
              </mesh>
              <mesh position={[0.38, 1.12, -0.22]} castShadow receiveShadow>
                <sphereGeometry args={[0.58, 10, 10]} />
                <meshStandardMaterial color={canopyColor} roughness={0.82} />
              </mesh>
              <mesh position={[0, 1.68, 0.1]} castShadow receiveShadow>
                <sphereGeometry args={[0.52, 10, 10]} />
                <meshStandardMaterial color="#87B353" roughness={0.8} />
              </mesh>
            </group>
          );
        }

        if (dec.kind === 'MOSS_BOULDER') {
          // Low dry-stone wall / limestone boulder segment (Tiny Glade signature)
          return (
            <group
              key={dec.id}
              position={[dec.position[0], dec.position[1] + 0.16, dec.position[2]]}
              rotation={[0, dec.rotationY, 0]}
              scale={[dec.scale, dec.scale, dec.scale]}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.85, 0.34, 0.42]} />
                <meshStandardMaterial color="#BFB6A6" roughness={0.88} />
              </mesh>
              <mesh position={[0.18, 0.22, 0]} castShadow>
                <boxGeometry args={[0.42, 0.18, 0.38]} />
                <meshStandardMaterial color="#A89F8F" roughness={0.88} />
              </mesh>
            </group>
          );
        }

        if (dec.kind === 'FERN_CLUSTER') {
          return (
            <group
              key={dec.id}
              position={dec.position}
              rotation={[0, dec.rotationY, 0]}
              scale={[dec.scale, dec.scale, dec.scale]}
            >
              <mesh position={[0, 0.14, 0]} castShadow>
                <sphereGeometry args={[0.28, 8, 8]} />
                <meshStandardMaterial color="#679B44" roughness={0.8} />
              </mesh>
              <mesh position={[0.12, 0.26, 0.08]}>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color="#F59E0B" />
              </mesh>
            </group>
          );
        }

        if (dec.kind === 'LOTUS_PAD') {
          return (
            <group
              key={dec.id}
              position={dec.position}
              rotation={[0, dec.rotationY, 0]}
              scale={[dec.scale, 1, dec.scale]}
            >
              <mesh receiveShadow>
                <cylinderGeometry args={[0.32, 0.32, 0.04, 12]} />
                <meshStandardMaterial color="#5E9144" roughness={0.65} />
              </mesh>
            </group>
          );
        }

        if (dec.kind === 'LANTERN_POST') {
          return (
            <group key={dec.id} position={dec.position}>
              <mesh position={[0, 0.45, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.08, 0.9, 8]} />
                <meshStandardMaterial color="#5A3A22" roughness={0.82} />
              </mesh>
              <mesh position={[0, 0.95, 0]}>
                <boxGeometry args={[0.22, 0.26, 0.22]} />
                <meshStandardMaterial
                  color="#FFD269"
                  emissive="#F59E0B"
                  emissiveIntensity={0.85}
                />
              </mesh>
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}
