import type {
  DecorationInstance,
  LandmarkNode,
  PathEdge,
  PathNode,
  WorldValidationReport
} from '@/types/world';
import { checkGraphConnectivity } from '@/core/pathfinding/astar';

export const MIN_LANDMARK_SEPARATION = 3.6;
export const MIN_DECORATION_CLEARANCE_FROM_LANDMARK = 1.65;
export const MAX_ISLAND_RADIUS = 11.4;

function horizontalDistance(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

/**
 * Runs JAHAN-inspired post-generation assertions to verify spatial validity,
 * graph connectivity, and interaction target readability.
 */
export function validateWorldLayout(params: {
  landmarks: LandmarkNode[];
  pathNodes: PathNode[];
  pathEdges: PathEdge[];
  decorations: DecorationInstance[];
  repairAttempts: number;
}): WorldValidationReport {
  const { landmarks, pathNodes, pathEdges, decorations, repairAttempts } = params;
  const messages: string[] = [];

  // 1. Check landmark mutual separation and island bounds
  let noLandmarkOverlap = true;
  for (let i = 0; i < landmarks.length; i++) {
    const lmA = landmarks[i];
    const radialDist = Math.hypot(lmA.position[0], lmA.position[2]);
    if (radialDist > MAX_ISLAND_RADIUS) {
      noLandmarkOverlap = false;
      messages.push(
        `Landmark ${lmA.id} exceeds max island radius (${radialDist.toFixed(2)}).`
      );
    }

    for (let j = i + 1; j < landmarks.length; j++) {
      const lmB = landmarks[j];
      const dist = horizontalDistance(lmA.position, lmB.position);
      if (dist < MIN_LANDMARK_SEPARATION) {
        noLandmarkOverlap = false;
        messages.push(
          `Landmarks ${lmA.id} and ${lmB.id} are too close (${dist.toFixed(2)} < ${MIN_LANDMARK_SEPARATION}).`
        );
      }
    }
  }

  // 2. Check global BFS graph connectivity from Sanctuary Gate to all landmarks
  const connectivity = checkGraphConnectivity(pathNodes, pathEdges);
  const graphConnected = connectivity.isConnected;
  if (!graphConnected) {
    messages.push(
      `Unreachable landmark nodes: ${connectivity.unreachableLandmarkNodeIds.join(', ')}`
    );
  }

  // 3. Check that no decorative tree/boulder obstructs any task landmark
  let markerClearanceValid = true;
  for (const dec of decorations) {
    for (const lm of landmarks) {
      const dist = horizontalDistance(dec.position, lm.position);
      if (dist < MIN_DECORATION_CLEARANCE_FROM_LANDMARK) {
        markerClearanceValid = false;
        messages.push(
          `Decoration ${dec.id} encroaches on landmark ${lm.id} (${dist.toFixed(2)}).`
        );
      }
    }
  }

  const isValid = noLandmarkOverlap && graphConnected && markerClearanceValid;
  if (isValid) {
    messages.push(
      `All PCG assertions passed (landmarks=${landmarks.length}, decorations=${decorations.length}, repairAttempts=${repairAttempts}).`
    );
  }

  return {
    isValid,
    noLandmarkOverlap,
    graphConnected,
    markerClearanceValid,
    repairAttempts,
    messages
  };
}
