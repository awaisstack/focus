'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { BiomeDesignTokens } from '@/presets/biomePresets';
import type { LandmarkNode } from '@/types/world';
import { getVillageTextures } from '@/core/textures/proceduralTextures';
import { sampleValleyTerrainHeight } from '@/core/pcg/terrainHeight';

interface LandmarkMeshProps {
  landmark: LandmarkNode;
  biome: BiomeDesignTokens;
  isSelected: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

export function LandmarkMesh({
  landmark,
  isSelected,
  reducedMotion,
  onSelect
}: LandmarkMeshProps) {
  const [isHovered, setIsHovered] = useState(false);
  const windmillBladesRef = useRef<THREE.Group>(null);
  const crestRef = useRef<THREE.Mesh>(null);
  const smokeRef = useRef<THREE.Group>(null);

  const textures = useMemo(() => getVillageTextures(), []);

  // Lock Y position strictly to the continuous valley terrain surface
  const groundedPosition: [number, number, number] = useMemo(() => {
    const y = sampleValleyTerrainHeight(
      landmark.position[0],
      landmark.position[2]
    );
    return [landmark.position[0], y, landmark.position[2]];
  }, [landmark.position]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();

    if (windmillBladesRef.current) {
      windmillBladesRef.current.rotation.z =
        -t * (landmark.isCompleted ? 1.4 : 0.45);
    }

    if (crestRef.current) {
      crestRef.current.rotation.y = t * 1.8;
      crestRef.current.position.y = 3.65 + Math.sin(t * 3.0) * 0.14;
    }

    if (smokeRef.current && landmark.isCompleted) {
      smokeRef.current.children.forEach((puff, idx) => {
        const cycle = (t * 0.4 + idx * 0.33) % 1;
        puff.position.y = cycle * 1.8;
        const s = 0.14 + cycle * 0.25;
        puff.scale.set(s, s, s);
      });
    }
  });

  const windowGlow = landmark.isCompleted
    ? '#FFD166'
    : landmark.isNextStep
    ? '#FFE599'
    : '#5C6468';

  const showFloatingBanner = isSelected || isHovered || landmark.isNextStep;

  return (
    <group
      position={groundedPosition}
      rotation={[0, landmark.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(landmark.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={() => setIsHovered(false)}
    >
      {/* Textured Cobblestone & Masonry Courtyard Foundation */}
      <mesh position={[0, 0.14, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.05, 2.25, 0.28, 16]} />
        <meshStandardMaterial
          map={textures?.stoneWallMap ?? null}
          bumpMap={textures?.stoneWallBump ?? null}
          bumpScale={0.04}
          color="#D6CBB8"
          roughness={0.88}
        />
      </mesh>

      {/* Low Dry-Stone Courtyard Perimeter Wall */}
      <mesh position={[-1.4, 0.38, 0.9]} rotation={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.95, 0.32, 0.28]} />
        <meshStandardMaterial
          map={textures?.stoneWallMap ?? null}
          color="#C9BFAEE"
          roughness={0.9}
        />
      </mesh>
      <mesh position={[1.4, 0.38, 0.9]} rotation={[0, -0.5, 0]} castShadow>
        <boxGeometry args={[0.95, 0.32, 0.28]} />
        <meshStandardMaterial
          map={textures?.stoneWallMap ?? null}
          color="#C9BFAEE"
          roughness={0.9}
        />
      </mesh>

      {/* Active Next-Step 3D Floating Golden Diamond Crest */}
      {(landmark.isNextStep || isSelected) && (
        <mesh ref={crestRef} position={[0, 3.65, 0]} castShadow>
          <octahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial
            color="#F59E0B"
            emissive="#F59E0B"
            emissiveIntensity={0.75}
            metalness={0.4}
            roughness={0.2}
          />
        </mesh>
      )}

      {/* Timber Scaffolding (Shown while under construction before completion) */}
      {!landmark.isCompleted && (
        <group position={[0, 0.28, 0]}>
          {[
            [-1.25, -1.1],
            [1.25, -1.1],
            [-1.25, 1.1],
            [1.25, 1.1]
          ].map(([sx, sz], idx) => (
            <mesh key={`scaf-${idx}`} position={[sx, 0.95, sz]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 1.9, 6]} />
              <meshStandardMaterial color="#8A5E36" roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 1.2, 1.1]} castShadow>
            <boxGeometry args={[2.55, 0.07, 0.14]} />
            <meshStandardMaterial color="#A87646" roughness={0.85} />
          </mesh>
        </group>
      )}

      {/* =====================================================================
          COMPOUND 1: GRAND SCHOLAR'S GUILDHALL & BELFRY TOWER (STUDY)
      ===================================================================== */}
      {landmark.archetype === 'STUDY_NOOK' && (
        <group position={[0, 0.28, 0]}>
          {/* Ground Stone Masonry Base */}
          <mesh position={[-0.25, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.85, 0.7, 1.45]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              bumpMap={textures?.stoneWallBump ?? null}
              bumpScale={0.05}
              color="#DDD2C0"
              roughness={0.85}
            />
          </mesh>
          {/* Upper Half-Timbered Hall */}
          <mesh position={[-0.25, 1.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.95, 0.88, 1.55]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              color="#FFF8EB"
              roughness={0.75}
            />
          </mesh>
          {/* Pitched Slate Shingle Roof */}
          <mesh
            position={[-0.25, 1.98, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[1.55, 1.05, 4]} />
            <meshStandardMaterial
              map={textures?.slateRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.65}
            />
          </mesh>
          {/* Attached Cylindrical Stone Belfry Tower */}
          <mesh position={[0.85, 1.25, -0.35]} castShadow receiveShadow>
            <cylinderGeometry args={[0.52, 0.58, 2.5, 14]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              bumpMap={textures?.stoneWallBump ?? null}
              bumpScale={0.05}
              color="#E5DAC8"
              roughness={0.82}
            />
          </mesh>
          {/* Conical Terracotta Tower Spire */}
          <mesh position={[0.85, 2.88, -0.35]} castShadow>
            <coneGeometry args={[0.68, 0.95, 14]} />
            <meshStandardMaterial
              map={textures?.terracottaRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.62}
            />
          </mesh>
          {/* Warm Windows */}
          <mesh position={[-0.55, 1.12, 0.79]}>
            <boxGeometry args={[0.3, 0.38, 0.04]} />
            <meshStandardMaterial
              color={windowGlow}
              emissive={windowGlow}
              emissiveIntensity={landmark.isCompleted ? 1.0 : 0.35}
            />
          </mesh>
          <mesh position={[0.08, 1.12, 0.79]}>
            <boxGeometry args={[0.3, 0.38, 0.04]} />
            <meshStandardMaterial
              color={windowGlow}
              emissive={windowGlow}
              emissiveIntensity={landmark.isCompleted ? 1.0 : 0.35}
            />
          </mesh>
        </group>
      )}

      {/* =====================================================================
          COMPOUND 2: ARTISAN'S WINDMILL & GRANARY COTTAGE (WRITING / VIDEO)
      ===================================================================== */}
      {landmark.archetype === 'WRITING_PAVILION' && (
        <group position={[0, 0.28, 0]}>
          {/* Stone & Timber Windmill Tower */}
          <mesh position={[-0.25, 1.18, -0.15]} castShadow receiveShadow>
            <cylinderGeometry args={[0.68, 0.95, 2.35, 14]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              bumpMap={textures?.stoneWallBump ?? null}
              bumpScale={0.05}
              color="#E8DEC8"
              roughness={0.82}
            />
          </mesh>
          <mesh position={[-0.25, 2.68, -0.15]} castShadow>
            <coneGeometry args={[0.86, 0.85, 14]} />
            <meshStandardMaterial
              map={textures?.terracottaRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.62}
            />
          </mesh>
          {/* Adjoining Half-Timbered Granary Cottage */}
          <mesh position={[0.78, 0.65, 0.25]} castShadow receiveShadow>
            <boxGeometry args={[1.25, 1.3, 1.15]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              color="#FFF8EB"
              roughness={0.76}
            />
          </mesh>
          <mesh
            position={[0.78, 1.55, 0.25]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[1.05, 0.72, 4]} />
            <meshStandardMaterial
              map={textures?.terracottaRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.64}
            />
          </mesh>
          {/* Rotating Windmill Sails */}
          <group ref={windmillBladesRef} position={[-0.25, 1.85, 0.62]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.14, 0.14, 0.28, 8]} />
              <meshStandardMaterial color="#4A301D" />
            </mesh>
            {[0, 1, 2, 3].map((bladeIdx) => (
              <group
                key={bladeIdx}
                rotation={[0, 0, (bladeIdx * Math.PI) / 2]}
              >
                <mesh position={[0, 0.82, 0]} castShadow>
                  <boxGeometry args={[0.08, 1.55, 0.05]} />
                  <meshStandardMaterial color="#4A301D" />
                </mesh>
                <mesh position={[0.14, 0.92, 0.02]} castShadow>
                  <boxGeometry args={[0.26, 1.2, 0.02]} />
                  <meshStandardMaterial color="#FFFDF7" roughness={0.8} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      )}

      {/* =====================================================================
          COMPOUND 3: CITADEL WATCHTOWER & GATEHOUSE (OUTDOORS)
      ===================================================================== */}
      {landmark.archetype === 'WALK_TRAIL_ARCH' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.78, 0.94, 2.5, 14]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              bumpMap={textures?.stoneWallBump ?? null}
              bumpScale={0.05}
              color="#DFD5C2"
              roughness={0.84}
            />
          </mesh>
          <mesh position={[0, 2.58, 0]} castShadow>
            <cylinderGeometry args={[0.95, 0.88, 0.36, 14]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              roughness={0.78}
            />
          </mesh>
          <mesh position={[0, 3.15, 0]} castShadow>
            <coneGeometry args={[1.05, 0.95, 14]} />
            <meshStandardMaterial
              map={textures?.slateRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.64}
            />
          </mesh>
        </group>
      )}

      {/* =====================================================================
          COMPOUND 4 & 5: HALF-TIMBERED MANOR COTTAGE & BAKERY INN
      ===================================================================== */}
      {(landmark.archetype === 'CONNECT_BENCH' ||
        landmark.archetype === 'SANCTUARY_GREENHOUSE') && (
        <group position={[0, 0.28, 0]}>
          {/* Ground Stone Course */}
          <mesh position={[-0.15, 0.32, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.85, 0.64, 1.45]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              bumpMap={textures?.stoneWallBump ?? null}
              bumpScale={0.05}
              color="#DDD2C0"
              roughness={0.86}
            />
          </mesh>
          {/* Upper Half-Timbered Jetty Floor */}
          <mesh position={[-0.15, 1.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.98, 0.85, 1.56]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              color="#FFF8EB"
              roughness={0.75}
            />
          </mesh>
          {/* Steep Terracotta Shingle Roof */}
          <mesh
            position={[-0.15, 1.88, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[1.58, 0.98, 4]} />
            <meshStandardMaterial
              map={textures?.terracottaRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.62}
            />
          </mesh>
          {/* Stone Chimney Stack */}
          <mesh position={[0.55, 1.95, -0.42]} castShadow>
            <boxGeometry args={[0.32, 1.15, 0.32]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              color="#BFB4A2"
              roughness={0.88}
            />
          </mesh>
          {/* Glowing Cottage Windows */}
          <mesh position={[-0.5, 1.05, 0.79]}>
            <boxGeometry args={[0.3, 0.34, 0.04]} />
            <meshStandardMaterial
              color={windowGlow}
              emissive={windowGlow}
              emissiveIntensity={landmark.isCompleted ? 1.0 : 0.4}
            />
          </mesh>
          <mesh position={[0.2, 1.05, 0.79]}>
            <boxGeometry args={[0.3, 0.34, 0.04]} />
            <meshStandardMaterial
              color={windowGlow}
              emissive={windowGlow}
              emissiveIntensity={landmark.isCompleted ? 1.0 : 0.4}
            />
          </mesh>
        </group>
      )}

      {/* Completed Stage 2: Rising Chimney Smoke, Warm Lantern Light & Lush Courtyard Gardens */}
      {landmark.growthStage === 2 && (
        <group position={[0, 0.32, 0]}>
          <pointLight
            position={[0, 1.8, 1.4]}
            color="#FFB74D"
            intensity={2.4}
            distance={8}
          />
          <group position={[0.55, 2.55, -0.42]} ref={smokeRef}>
            {[0, 1, 2].map((idx) => (
              <mesh key={`chimney-smoke-${idx}`}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  transparent
                  opacity={0.45}
                />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* Decluttered Spatial Banner — ONLY shown on the active/selected or hovered building */}
      {showFloatingBanner && (
        <Html
          position={[0, 4.15, 0]}
          center
          distanceFactor={22}
          zIndexRange={[10, 0]}
        >
          <button
            type="button"
            onClick={() => onSelect(landmark.id)}
            className={`whitespace-nowrap border-2 px-3 py-1 text-xs font-bold shadow-xl transition-transform ${
              isSelected
                ? 'border-[#F59E0B] bg-[#1E1B18] text-[#FBF7EE]'
                : 'border-[#5A3A22] bg-[#FBF7EE] text-[#1E1B18]'
            }`}
            style={{ borderRadius: '4px' }}
          >
            {landmark.isCompleted
              ? `🏛️ ${landmark.label}`
              : landmark.isNextStep
              ? `🔨 Next: ${landmark.label}`
              : landmark.label}
          </button>
        </Html>
      )}
    </group>
  );
}
