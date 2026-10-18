'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BiomeDesignTokens } from '@/presets/biomePresets';
import type { WorldModel } from '@/types/world';
import { getVillageTextures } from '@/core/textures/proceduralTextures';
import {
  getRiverCenterX,
  sampleValleyTerrainHeight
} from '@/core/pcg/terrainHeight';
import { LandmarkMesh } from './LandmarkMesh';
import { PathNetworkMesh } from './PathNetworkMesh';
import { VillagerAgents } from './VillagerAgents';
import { InstancedGrassAndFoliage } from './InstancedGrassAndFoliage';

interface IslandTerrainProps {
  biome: BiomeDesignTokens;
  worldModel: WorldModel;
  selectedLandmarkId: string | null;
  isGreetingCourierActive: boolean;
  reducedMotion: boolean;
  onSelectLandmark: (id: string) => void;
}

export function IslandTerrain({
  biome,
  worldModel,
  selectedLandmarkId,
  isGreetingCourierActive,
  reducedMotion,
  onSelectLandmark
}: IslandTerrainProps) {
  const riverRef = useRef<THREE.Mesh>(null);
  const textures = useMemo(() => getVillageTextures(), []);

  // Build continuous 160x160 vertex-displaced valley geometry (no floating pancake disc!)
  const valleyGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(160, 160, 128, 128);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const cMeadow = new THREE.Color('#649642');
    const cHill = new THREE.Color('#527E36');
    const cRiverbank = new THREE.Color('#B59E7A');

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = sampleValleyTerrainHeight(x, z);
      posAttr.setY(i, y);

      const riverDist = Math.abs(x - getRiverCenterX(z));
      let vertexColor = cMeadow;
      if (riverDist < 2.8 && Math.abs(z) < 42) {
        vertexColor = cRiverbank;
      } else if (y > 2.2) {
        vertexColor = cHill;
      }

      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (riverRef.current) {
      riverRef.current.position.y = 0.52 + Math.sin(t * 1.6) * 0.02;
    }
  });

  const townCenterY = sampleValleyTerrainHeight(-1.4, 1.4);
  const bridgeY = sampleValleyTerrainHeight(2.2, 0.8);

  return (
    <group>
      {/* Continuous Rolling Valley Terrain with Meadow Grass Texture & Vertex Shading */}
      <mesh geometry={valleyGeometry} receiveShadow>
        <meshStandardMaterial
          map={textures?.meadowGrassMap ?? null}
          vertexColors
          roughness={0.88}
        />
      </mesh>

      {/* Winding Sunlit Valley River */}
      <mesh
        ref={riverRef}
        position={[2.2, 0.52, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[5.2, 95]} />
        <meshStandardMaterial
          color="#3898B8"
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>

      {/* =====================================================================
          PERMANENT CENTRAL VILLAGE SQUARE (Tiny Glade / Fabledom Heart of Town)
      ===================================================================== */}
      <group position={[-1.4, townCenterY, 1.4]}>
        {/* Cobblestone Town Plaza */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[3.4, 3.6, 0.08, 24]} />
          <meshStandardMaterial
            map={textures?.cobbleMap ?? null}
            color="#D6CCBA"
            roughness={0.86}
          />
        </mesh>

        {/* Founder's Half-Timbered Town Keep & Homestead */}
        <group position={[-0.8, 0.08, -0.6]} rotation={[0, 0.35, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.65, 0.7, 1.25]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              bumpMap={textures?.stoneWallBump ?? null}
              bumpScale={0.04}
              color="#DDD2C0"
              roughness={0.85}
            />
          </mesh>
          <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.78, 0.78, 1.36]} />
            <meshStandardMaterial
              map={textures?.halfTimberMap ?? null}
              color="#FFF8EB"
              roughness={0.75}
            />
          </mesh>
          <mesh
            position={[0, 1.78, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[1.42, 0.92, 4]} />
            <meshStandardMaterial
              map={textures?.terracottaRoofMap ?? null}
              bumpMap={textures?.roofBump ?? null}
              bumpScale={0.06}
              roughness={0.62}
            />
          </mesh>
          {/* Warm Homestead Windows */}
          <mesh position={[-0.35, 1.02, 0.69]}>
            <boxGeometry args={[0.26, 0.3, 0.03]} />
            <meshStandardMaterial
              color="#FFD166"
              emissive="#FFD166"
              emissiveIntensity={0.95}
            />
          </mesh>
          <mesh position={[0.35, 1.02, 0.69]}>
            <boxGeometry args={[0.26, 0.3, 0.03]} />
            <meshStandardMaterial
              color="#FFD166"
              emissive="#FFD166"
              emissiveIntensity={0.95}
            />
          </mesh>
        </group>

        {/* Central Village Stone Well with Shingle Canopy */}
        <group position={[1.15, 0.08, 0.65]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.5, 0.48, 12]} />
            <meshStandardMaterial
              map={textures?.stoneWallMap ?? null}
              color="#C8BFAEE"
              roughness={0.88}
            />
          </mesh>
          <mesh position={[-0.35, 0.65, 0]} castShadow>
            <boxGeometry args={[0.07, 0.8, 0.07]} />
            <meshStandardMaterial color="#5A3A22" />
          </mesh>
          <mesh position={[0.35, 0.65, 0]} castShadow>
            <boxGeometry args={[0.07, 0.8, 0.07]} />
            <meshStandardMaterial color="#5A3A22" />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <coneGeometry args={[0.68, 0.48, 8]} />
            <meshStandardMaterial
              map={textures?.terracottaRoofMap ?? null}
              roughness={0.65}
            />
          </mesh>
        </group>

        {/* Cozy Market Stall with Terracotta Awning */}
        <group position={[0.9, 0.08, -1.1]} rotation={[0, -0.45, 0]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[1.1, 0.45, 0.65]} />
            <meshStandardMaterial color="#7C5132" roughness={0.82} />
          </mesh>
          <mesh
            position={[0, 0.88, 0]}
            rotation={[0.22, 0, 0]}
            castShadow
          >
            <boxGeometry args={[1.25, 0.08, 0.85]} />
            <meshStandardMaterial color="#C85232" roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* Arched Stone & Timber Bridge Crossing the River */}
      <group position={[2.2, bridgeY + 0.28, 0.8]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4.4, 0.26, 1.85]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            color="#D2C7B4"
            roughness={0.85}
          />
        </mesh>
        <mesh position={[0, 0.32, 0.82]} castShadow>
          <boxGeometry args={[4.4, 0.28, 0.2]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            color="#BFB4A2"
            roughness={0.88}
          />
        </mesh>
        <mesh position={[0, 0.32, -0.82]} castShadow>
          <boxGeometry args={[4.4, 0.28, 0.2]} />
          <meshStandardMaterial
            map={textures?.stoneWallMap ?? null}
            color="#BFB4A2"
            roughness={0.88}
          />
        </mesh>
      </group>

      {/* Grounded Cobblestone Road Network */}
      <PathNetworkMesh
        pathNodes={worldModel.pathNodes}
        pathEdges={worldModel.pathEdges}
        activeRouteNodeIds={worldModel.activeRouteNodeIds}
        biome={biome}
        reducedMotion={reducedMotion}
      />

      {/* 5,200+ Instanced Grass Blades, Wildflowers, Clustered Woodlands, Stone Walls & Chimney Smoke */}
      <InstancedGrassAndFoliage
        landmarks={worldModel.landmarks}
        reducedMotion={reducedMotion}
      />

      {/* Your Goal Compounds (Guildhall, Windmill, Watchtower, Bakery Inn) */}
      {worldModel.landmarks.map((landmark) => (
        <LandmarkMesh
          key={landmark.id}
          landmark={landmark}
          biome={biome}
          isSelected={landmark.id === selectedLandmarkId}
          reducedMotion={reducedMotion}
          onSelect={onSelectLandmark}
        />
      ))}

      {/* Living Villagers & Grazing Meadow Sheep */}
      <VillagerAgents
        landmarks={worldModel.landmarks}
        isGreetingCourierActive={isGreetingCourierActive}
        reducedMotion={reducedMotion}
        onSelectLandmark={onSelectLandmark}
      />
    </group>
  );
}
