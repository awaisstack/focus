import type { LandmarkNode, PathEdge, PathNode } from '@/types/world';
import { SANCTUARY_GATE_NODE_ID } from './graphBuilder';

export interface GraphNode2D {
  id: string;
  x: number;
  z: number;
}

export interface GraphEdge2D {
  from: string;
  to: string;
  weight: number;
}

export function euclideanDistance2D(a: GraphNode2D, b: GraphNode2D): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function buildAdjacencyMap(
  nodes: PathNode[],
  edges: PathEdge[]
): Map<string, Array<{ neighborId: string; weight: number }>> {
  const adjacency = new Map<string, Array<{ neighborId: string; weight: number }>>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.fromId)?.push({ neighborId: edge.toId, weight: edge.weight });
    adjacency.get(edge.toId)?.push({ neighborId: edge.fromId, weight: edge.weight });
  }
  return adjacency;
}

/**
 * Breadth-First Search (BFS) connectivity check from SANCTUARY_GATE_NODE_ID
 * to verify that 100% of required Landmark nodes are reachable.
 */
export function checkGraphConnectivity(
  nodes: PathNode[],
  edges: PathEdge[],
  startNodeId = SANCTUARY_GATE_NODE_ID
): {
  isConnected: boolean;
  reachableNodeIds: Set<string>;
  unreachableLandmarkNodeIds: string[];
} {
  const adjacency = buildAdjacencyMap(nodes, edges);
  const visited = new Set<string>();
  const queue: string[] = [];

  if (adjacency.has(startNodeId)) {
    visited.add(startNodeId);
    queue.push(startNodeId);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const neighbors = adjacency.get(currentId) ?? [];
    for (const { neighborId } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  const landmarkNodes = nodes.filter((n) => n.kind === 'LANDMARK');
  const unreachableLandmarkNodeIds = landmarkNodes
    .filter((ln) => !visited.has(ln.id))
    .map((ln) => ln.id);

  return {
    isConnected: unreachableLandmarkNodeIds.length === 0,
    reachableNodeIds: visited,
    unreachableLandmarkNodeIds
  };
}

/**
 * Verifies via Breadth-First Search that every node in `nodes` is reachable from `nodes[0]`.
 */
export function verifyGraphConnectivity(
  nodes: readonly GraphNode2D[],
  edges: readonly GraphEdge2D[]
): boolean {
  if (nodes.length <= 1) return true;

  const adj = new Map<string, Set<string>>();
  for (const n of nodes) {
    adj.set(n.id, new Set());
  }
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  const visited = new Set<string>();
  const queue: string[] = [nodes[0].id];
  visited.add(nodes[0].id);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr);
    if (!neighbors) continue;
    for (const next of Array.from(neighbors)) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited.size === nodes.length;
}

function heuristic3D(a: PathNode, b: PathNode): number {
  return Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2]
  );
}

/**
 * Universal A* Shortest Path solver supporting both 3D PathNode/PathEdge and 2D GraphNode2D/GraphEdge2D.
 */
export function findShortestPathAStar(
  nodes: readonly any[],
  edges: readonly any[],
  startId: string,
  goalId: string
): string[] {
  if (startId === goalId) return [startId];
  if (!nodes || nodes.length === 0) return [];

  // Detect whether 3D PathNode or 2D GraphNode2D
  const is3D = 'position' in nodes[0];

  if (is3D) {
    const nodeMap = new Map<string, PathNode>(nodes.map((n: PathNode) => [n.id, n]));
    const startNode = nodeMap.get(startId);
    const goalNode = nodeMap.get(goalId);
    if (!startNode || !goalNode) return [];

    const adjacency = buildAdjacencyMap(nodes as PathNode[], edges as PathEdge[]);
    const openSet = new Set<string>([startId]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    for (const n of nodes) {
      gScore.set(n.id, Infinity);
      fScore.set(n.id, Infinity);
    }

    gScore.set(startId, 0);
    fScore.set(startId, heuristic3D(startNode, goalNode));

    while (openSet.size > 0) {
      let currentId: string | null = null;
      let lowestF = Infinity;

      for (const candidateId of Array.from(openSet).sort()) {
        const score = fScore.get(candidateId) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = candidateId;
        }
      }

      if (!currentId) break;

      if (currentId === goalId) {
        const path: string[] = [currentId];
        let curr = currentId;
        while (cameFrom.has(curr)) {
          curr = cameFrom.get(curr)!;
          path.unshift(curr);
        }
        return path;
      }

      openSet.delete(currentId);
      const neighbors = adjacency.get(currentId) ?? [];

      for (const { neighborId, weight } of neighbors) {
        const tentativeG = (gScore.get(currentId) ?? Infinity) + weight;
        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          const neighborNode = nodeMap.get(neighborId)!;
          fScore.set(neighborId, tentativeG + heuristic3D(neighborNode, goalNode));
          openSet.add(neighborId);
        }
      }
    }

    return [];
  }

  // 2D GraphNode2D / GraphEdge2D pathfinding
  const nodeMap = new Map<string, GraphNode2D>();
  const adj = new Map<string, Array<{ to: string; weight: number }>>();

  for (const n of nodes as GraphNode2D[]) {
    nodeMap.set(n.id, n);
    adj.set(n.id, []);
  }
  for (const e of edges as GraphEdge2D[]) {
    adj.get(e.from)?.push({ to: e.to, weight: e.weight });
    adj.get(e.to)?.push({ to: e.from, weight: e.weight });
  }

  const goalNode = nodeMap.get(goalId);
  const startNode = nodeMap.get(startId);
  if (!goalNode || !startNode) return [];

  const openSet = new Set<string>([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  for (const n of nodes) {
    gScore.set(n.id, Infinity);
    fScore.set(n.id, Infinity);
  }
  gScore.set(startId, 0);
  fScore.set(startId, euclideanDistance2D(startNode, goalNode));

  while (openSet.size > 0) {
    let current = '';
    let lowestF = Infinity;
    for (const candidate of Array.from(openSet)) {
      const score = fScore.get(candidate) ?? Infinity;
      if (score < lowestF) {
        lowestF = score;
        current = candidate;
      }
    }

    if (current === goalId) {
      const path: string[] = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current)!;
        path.unshift(current);
      }
      return path;
    }

    openSet.delete(current);
    const neighbors = adj.get(current) ?? [];

    for (const neighbor of neighbors) {
      const tentativeG = (gScore.get(current) ?? Infinity) + neighbor.weight;
      if (tentativeG < (gScore.get(neighbor.to) ?? Infinity)) {
        cameFrom.set(neighbor.to, current);
        gScore.set(neighbor.to, tentativeG);
        const neighborNode = nodeMap.get(neighbor.to)!;
        fScore.set(neighbor.to, tentativeG + euclideanDistance2D(neighborNode, goalNode));
        openSet.add(neighbor.to);
      }
    }
  }

  return [startId, goalId];
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function computeSanctuaryRoute(
  nodes: PathNode[],
  edges: PathEdge[],
  landmarks: LandmarkNode[]
): {
  annotatedEdges: PathEdge[];
  activeRouteNodeIds: string[];
} {
  const completedLandmarks = landmarks.filter((l) => l.isCompleted);
  const scheduledLandmarks = landmarks.filter(
    (l) => !l.isCompleted && !l.isDeferred
  );
  const deferredLandmarks = landmarks.filter((l) => l.isDeferred);

  const orderedStopNodeIds: string[] = [
    SANCTUARY_GATE_NODE_ID,
    ...completedLandmarks.map((l) => `node-${l.id}`),
    ...scheduledLandmarks.map((l) => `node-${l.id}`)
  ];

  const activeEdgeKeys = new Set<string>();
  const completedEdgeKeys = new Set<string>();
  const deferredEdgeKeys = new Set<string>();
  const fullRouteSequence: string[] = [];

  for (let i = 0; i < orderedStopNodeIds.length - 1; i++) {
    const fromId = orderedStopNodeIds[i];
    const toId = orderedStopNodeIds[i + 1];
    const legPath = findShortestPathAStar(nodes, edges, fromId, toId);

    if (legPath.length >= 2) {
      for (let p = 0; p < legPath.length - 1; p++) {
        const u = legPath[p];
        const v = legPath[p + 1];
        const key = edgeKey(u, v);
        activeEdgeKeys.add(key);

        if (i < completedLandmarks.length) {
          completedEdgeKeys.add(key);
        }
      }
      for (const node of legPath) {
        if (!fullRouteSequence.includes(node)) {
          fullRouteSequence.push(node);
        }
      }
    }
  }

  for (const dl of deferredLandmarks) {
    const targetId = `node-${dl.id}`;
    let closestActiveNodeId = SANCTUARY_GATE_NODE_ID;
    let minDistance = Infinity;

    for (const anId of fullRouteSequence) {
      const path = findShortestPathAStar(nodes, edges, anId, targetId);
      if (path.length >= 2 && path.length < minDistance) {
        minDistance = path.length;
        closestActiveNodeId = anId;
      }
    }

    const spurPath = findShortestPathAStar(nodes, edges, closestActiveNodeId, targetId);
    for (let p = 0; p < spurPath.length - 1; p++) {
      deferredEdgeKeys.add(edgeKey(spurPath[p], spurPath[p + 1]));
    }
  }

  const annotatedEdges = edges.map((edge) => {
    const key = edgeKey(edge.fromId, edge.toId);
    let state: PathEdge['state'] = 'INACTIVE_TRAIL';
    let isActiveRoute = false;
    let isCompletedSegment = false;
    let isDeferredTrail = false;

    if (completedEdgeKeys.has(key)) {
      state = 'COMPLETED_ROUTE';
      isActiveRoute = true;
      isCompletedSegment = true;
    } else if (activeEdgeKeys.has(key)) {
      state = 'ACTIVE_ROUTE';
      isActiveRoute = true;
    } else if (deferredEdgeKeys.has(key)) {
      state = 'DEFERRED_SIDE_TRAIL';
      isDeferredTrail = true;
    }

    return {
      ...edge,
      state,
      isActiveRoute,
      isCompletedSegment,
      isDeferredTrail
    };
  });

  return {
    annotatedEdges,
    activeRouteNodeIds: fullRouteSequence
  };
}
