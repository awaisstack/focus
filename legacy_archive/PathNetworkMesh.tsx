'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BiomeDesignTokens } from '@/presets/biomePresets';
import type { PathEdge, PathNode } from '@/types/world';

interface PathNetworkMeshProps {
  pathNodes: PathNode[];
  pathEdges: PathEdge[];
  activeRouteNodeIds: string[];
  biome: BiomeDesignTokens;
  reducedMotion: boolean;
}

export function PathNetworkMesh({
  pathNodes,
  pathEdges,
  activeRouteNodeIds,
  reducedMotion
}: PathNetworkMeshProps) {
  const courierLanternRef = useRef<THREE.Mesh>(null);

  const nodeMap = useMemo(
    () => new Map<string, PathNode>(pathNodes.map((n) => [n.id, n])),
    [pathNodes]
  );

  const activeRoutePoints = useMemo(() => {
    const pts: Array<[number, number, number]> = [];
    for (const id of activeRouteNodeIds) {
      const node = nodeMap.get(id);
      if (node) {
        pts.push([node.position[0], node.position[1] + 0.05, node.position[2]]);
      }
    }
    return pts;
  }, [activeRouteNodeIds, nodeMap]);

  // Generate warm cobblestone road pavers along all active and deferred village roads
  const cobblestonePavers = useMemo(() => {
    const pavers: Array<{
      id: string;
      position: [number, number, number];
      rotationY: number;
      isActive: boolean;
      isCompleted: boolean;
    }> = [];

    pathEdges.forEach((edge, edgeIdx) => {
      if (!edge.isActiveRoute && !edge.isDeferredTrail) return;
      const from = nodeMap.get(edge.fromId);
      const to = nodeMap.get(edge.toId);
      if (!from || !to) return;

      const dx = to.position[0] - from.position[0];
      const dz = to.position[2] - from.position[2];
      const dist = Math.hypot(dx, dz);
      const angleY = Math.atan2(dx, dz);
      const steps = Math.max(3, Math.floor(dist / 0.65));

      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = from.position[0] + dx * t;
        const y = from.position[1] + (to.position[1] - from.position[1]) * t;
        const z = from.position[2] + dz * t;

        pavers.push({
          id: `cobble-${edgeIdx}-${s}`,
          position: [x, y - 0.01, z],
          rotationY: angleY,
          isActive: edge.isActiveRoute,
          isCompleted: edge.isCompletedSegment
        });
      }
    });

    return pavers;
  }, [pathEdges, nodeMap]);

  useFrame(({ clock }) => {
    if (
      reducedMotion ||
      !courierLanternRef.current ||
      activeRoutePoints.length < 2
    ) {
      return;
    }
    const totalSegments = activeRoutePoints.length - 1;
    const progress = ((clock.getElapsedTime() * 0.32) % 1) * totalSegments;
    const segIdx = Math.min(Math.floor(progress), totalSegments - 1);
    const localT = progress - segIdx;

    const pA = activeRoutePoints[segIdx];
    const pB = activeRoutePoints[segIdx + 1];

    courierLanternRef.current.position.set(
      pA[0] + (pB[0] - pA[0]) * localT,
      pA[1] + (pB[1] - pA[1]) * localT + 0.25,
      pA[2] + (pB[2] - pA[2]) * localT
    );
  });

  return (
    <group>
      {/* Grounded Cobblestone Village Road Stones */}
      {cobblestonePavers.map((stone) => (
        <mesh
          key={stone.id}
          position={stone.position}
          rotation={[0, stone.rotationY, 0]}
          receiveShadow
        >
          <boxGeometry args={[0.52, 0.06, 0.42]} />
          <meshStandardMaterial
            color={
              stone.isCompleted
                ? '#EAB308'
                : stone.isActive
                ? '#D6CEBF'
                : '#8C887F'
            }
            roughness={0.85}
          />
        </mesh>
      ))}

      {/* Warm Guiding Lantern Orb along Active Village Road */}
      {activeRoutePoints.length >= 2 && (
        <mesh ref={courierLanternRef} position={activeRoutePoints[0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial
            color="#F59E0B"
            emissive="#F59E0B"
            emissiveIntensity={0.9}
          />
        </mesh>
      )}
    </group>
  );
}
