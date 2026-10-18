import type { LandmarkNode, PathEdge, PathNode } from '@/types/world';
import { isInsideBrookChannel } from '@/core/pcg/noise2d';

export const SANCTUARY_GATE_NODE_ID = 'node-sanctuary-gate';
export const BROOK_BRIDGE_NODE_ID = 'node-brook-bridge';

function distance3D(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

/**
 * Checks if the straight segment between pA and pB crosses the central brook
 * without going through the timber footbridge node.
 */
function segmentCrossesBrookUnbridged(
  a: PathNode,
  b: PathNode
): boolean {
  if (a.id === BROOK_BRIDGE_NODE_ID || b.id === BROOK_BRIDGE_NODE_ID) {
    return false;
  }
  const midX = (a.position[0] + b.position[0]) * 0.5;
  const midZ = (a.position[2] + b.position[2]) * 0.5;
  const crossesX =
    (a.position[0] < 0.8 && b.position[0] > 1.4) ||
    (b.position[0] < 0.8 && a.position[0] > 1.4);

  return crossesX || isInsideBrookChannel(midX, midZ, 0.95);
}

export function buildNavigationGraph(landmarks: LandmarkNode[]): {
  pathNodes: PathNode[];
  pathEdges: PathEdge[];
} {
  const baseNodes: PathNode[] = [
    {
      id: SANCTUARY_GATE_NODE_ID,
      position: [0, 1.02, 8.8],
      kind: 'GATE'
    },
    {
      id: BROOK_BRIDGE_NODE_ID,
      position: [1.1, 1.24, 0.6],
      kind: 'BRIDGE'
    },
    {
      id: 'node-waypoint-west-meadow',
      position: [-3.4, 1.06, 5.2],
      kind: 'WAYPOINT'
    },
    {
      id: 'node-waypoint-west-ridge',
      position: [-4.2, 1.62, 0.4],
      kind: 'WAYPOINT'
    },
    {
      id: 'node-waypoint-north-glade',
      position: [-1.2, 1.65, -1.2],
      kind: 'WAYPOINT'
    },
    {
      id: 'node-waypoint-east-bank',
      position: [3.4, 1.12, 2.2],
      kind: 'WAYPOINT'
    },
    {
      id: 'node-waypoint-east-terrace',
      position: [4.2, 1.42, -0.8],
      kind: 'WAYPOINT'
    }
  ];

  const landmarkNodes: PathNode[] = landmarks.map((lm) => ({
    id: `node-${lm.id}`,
    position: [lm.position[0], lm.position[1] + 0.08, lm.position[2]],
    kind: 'LANDMARK',
    landmarkId: lm.id
  }));

  const pathNodes = [...baseNodes, ...landmarkNodes];
  const pathEdges: PathEdge[] = [];
  const addedPairs = new Set<string>();

  const addUndirectedEdge = (nodeA: PathNode, nodeB: PathNode, extraPenalty = 0) => {
    if (nodeA.id === nodeB.id) return;
    const pairKey =
      nodeA.id < nodeB.id
        ? `${nodeA.id}::${nodeB.id}`
        : `${nodeB.id}::${nodeA.id}`;
    if (addedPairs.has(pairKey)) return;
    addedPairs.add(pairKey);

    const euclidean = distance3D(nodeA.position, nodeB.position);
    const elevationDiff = Math.abs(nodeA.position[1] - nodeB.position[1]);
    const waterPenalty = segmentCrossesBrookUnbridged(nodeA, nodeB) ? 18.0 : 0;

    const weight = Number(
      (euclidean + elevationDiff * 2.2 + waterPenalty + extraPenalty).toFixed(3)
    );

    pathEdges.push({
      fromId: nodeA.id,
      toId: nodeB.id,
      weight,
      isActiveRoute: false,
      isCompletedSegment: false,
      isDeferredTrail: false
    });
  };

  // Connect nearby nodes within 7.5 units, plus guarantee each node connects to its 3 nearest neighbors
  for (let i = 0; i < pathNodes.length; i++) {
    const current = pathNodes[i];
    const neighbors = pathNodes
      .filter((other) => other.id !== current.id)
      .map((other) => ({
        node: other,
        dist: distance3D(current.position, other.position)
      }))
      .sort((a, b) => a.dist - b.dist);

    for (let k = 0; k < neighbors.length; k++) {
      if (k < 3 || neighbors[k].dist <= 6.8) {
        addUndirectedEdge(current, neighbors[k].node);
      }
    }
  }

  return { pathNodes, pathEdges };
}
