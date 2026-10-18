import type { TaskCategory, TaskItem } from '@/types/task';
import type {
  DecorationInstance,
  LandmarkNode as LegacyLandmarkNode,
  WorldModel,
  WorldProfile
} from '@/types/world';
import { categoryToArchetype } from '@/presets/demoScenarios';
import {
  createIsolatedStreams,
  randomRange,
  type PrngFunction
} from './prng';
import {
  getBrookCenterX,
  isInsideBrookChannel,
  sampleIslandElevation,
  SeededNoise2D
} from './noise2d';
import { buildNavigationGraph } from '@/core/pathfinding/graphBuilder';
import { computeSanctuaryRoute } from '@/core/pathfinding/astar';
import {
  MIN_DECORATION_CLEARANCE_FROM_LANDMARK,
  MIN_LANDMARK_SEPARATION,
  validateWorldLayout
} from './worldValidator';

export const GENERATOR_VERSION = '1.2.0-pcg-jahan';

interface AnchorRegion {
  centerX: number;
  centerZ: number;
  jitterRadius: number;
  defaultRotationY: number;
  preferredCategory?: TaskCategory;
}

/**
 * Curated sanctuary zones around the island so different seeds create meaningful,
 * readable variations while preserving composition and camera framing.
 */
const SANCTUARY_ZONES: AnchorRegion[] = [
  {
    centerX: -5.4,
    centerZ: 3.1,
    jitterRadius: 1.15,
    defaultRotationY: 0.42,
    preferredCategory: 'STUDY'
  },
  {
    centerX: -1.6,
    centerZ: -3.2,
    jitterRadius: 0.85,
    defaultRotationY: -0.22,
    preferredCategory: 'WRITING'
  },
  {
    centerX: 5.3,
    centerZ: -2.1,
    jitterRadius: 1.1,
    defaultRotationY: -0.78,
    preferredCategory: 'OUTDOORS'
  },
  {
    centerX: 4.8,
    centerZ: 4.3,
    jitterRadius: 1.05,
    defaultRotationY: -1.35,
    preferredCategory: 'CONNECTION'
  },
  {
    centerX: -6.1,
    centerZ: -2.8,
    jitterRadius: 0.95,
    defaultRotationY: 0.55,
    preferredCategory: 'GENERAL'
  },
  {
    centerX: 1.9,
    centerZ: -6.1,
    jitterRadius: 0.95,
    defaultRotationY: -0.4,
    preferredCategory: 'GENERAL'
  }
];

function distanceXZ(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function generateLandmarkNodes(
  tasks: TaskItem[],
  rngLandmarks: PrngFunction,
  noise: SeededNoise2D
): LegacyLandmarkNode[] {
  const firstScheduledTask = tasks.find(
    (t) => t.status === 'scheduled' || t.status === 'in-progress'
  );

  // Deterministically permute zone offset based on seed draw while keeping logical progression
  const seedZoneRotation = rngLandmarks() > 0.65 ? 1 : 0;
  const placedLandmarks: LegacyLandmarkNode[] = [];

  for (let idx = 0; idx < tasks.length; idx++) {
    const task = tasks[idx];
    const zoneIndex = (idx + seedZoneRotation) % SANCTUARY_ZONES.length;
    const zone = SANCTUARY_ZONES[zoneIndex];

    let chosenPosition: [number, number, number] | null = null;
    let chosenRotationY = zone.defaultRotationY;

    for (let candidateTry = 0; candidateTry < 24; candidateTry++) {
      const angle = randomRange(rngLandmarks, 0, Math.PI * 2);
      const radius =
        candidateTry === 23
          ? 0
          : randomRange(rngLandmarks, 0.15, zone.jitterRadius);
      const cx = Number((zone.centerX + Math.cos(angle) * radius).toFixed(2));
      const cz = Number((zone.centerZ + Math.sin(angle) * radius).toFixed(2));
      const cy = sampleIslandElevation(cx, cz, noise);
      const candidatePos: [number, number, number] = [cx, cy, cz];

      const radialDist = Math.hypot(cx, cz);
      const inBrook = isInsideBrookChannel(cx, cz, 1.55);
      const farEnoughFromGate = Math.hypot(cx - 0, cz - 8.8) >= 3.2;
      const farFromOthers = placedLandmarks.every(
        (existing) =>
          distanceXZ(existing.position, candidatePos) >= MIN_LANDMARK_SEPARATION
      );

      if (
        radialDist <= 10.6 &&
        !inBrook &&
        farEnoughFromGate &&
        farFromOthers
      ) {
        chosenPosition = candidatePos;
        chosenRotationY = Number(
          (zone.defaultRotationY + randomRange(rngLandmarks, -0.22, 0.22)).toFixed(3)
        );
        break;
      }
    }

    if (!chosenPosition) {
      const fallbackY = sampleIslandElevation(zone.centerX, zone.centerZ, noise);
      chosenPosition = [zone.centerX, fallbackY, zone.centerZ];
    }

    const isCompleted = task.status === 'completed';
    const isDeferred = task.status === 'deferred';
    const isNextStep =
      !isCompleted && !isDeferred && firstScheduledTask?.id === task.id;
    const growthStage = isCompleted ? 2 : isDeferred ? 0 : 1;

    placedLandmarks.push({
      id: `landmark-${task.id}`,
      taskId: task.id,
      label: task.title,
      subtitle: `${task.estimatedMinutes} min${
        task.isDurationConfirmed ? '' : ' (est.)'
      }`,
      category: task.category,
      archetype: categoryToArchetype(task.category),
      position: chosenPosition,
      rotationY: chosenRotationY,
      scale: 1,
      growthStage,
      isNextStep,
      isCompleted,
      isDeferred,
      estimatedMinutes: task.estimatedMinutes,
      rationaleOrDeferralNote:
        task.status === 'deferred'
          ? task.deferralText || 'Resting for a future window.'
          : task.rationaleText || 'Scheduled in today’s route.'
    });
  }

  return placedLandmarks;
}

function generateDecorations(
  landmarks: LegacyLandmarkNode[],
  rngDecor: PrngFunction,
  noise: SeededNoise2D
): DecorationInstance[] {
  const decorations: DecorationInstance[] = [];

  const isPositionClear = (
    pos: [number, number, number],
    minDistanceToDecor = 1.25
  ): boolean => {
    // Keep southern gate clear
    if (Math.hypot(pos[0] - 0, pos[2] - 8.8) < 2.2) return false;
    // Keep footbridge clear
    if (Math.hypot(pos[0] - 1.1, pos[2] - 0.6) < 2.1) return false;

    for (const lm of landmarks) {
      if (distanceXZ(pos, lm.position) < MIN_DECORATION_CLEARANCE_FROM_LANDMARK) {
        return false;
      }
    }
    for (const existing of decorations) {
      if (distanceXZ(pos, existing.position) < minDistanceToDecor) {
        return false;
      }
    }
    return true;
  };

  // 1. Place outer & ridge Pine Trees (18 instances)
  for (let i = 0; i < 48 && decorations.filter((d) => d.kind === 'PINE_TREE').length < 18; i++) {
    const angle = randomRange(rngDecor, 0, Math.PI * 2);
    const radius = randomRange(rngDecor, 5.8, 10.8);
    const x = Number((Math.cos(angle) * radius).toFixed(2));
    const z = Number((Math.sin(angle) * radius).toFixed(2));
    if (isInsideBrookChannel(x, z, 1.4)) continue;

    const y = sampleIslandElevation(x, z, noise);
    const pos: [number, number, number] = [x, y, z];

    if (isPositionClear(pos, 1.55)) {
      decorations.push({
        id: `decor-pine-${decorations.length}`,
        kind: 'PINE_TREE',
        position: pos,
        rotationY: Number(randomRange(rngDecor, 0, Math.PI * 2).toFixed(2)),
        scale: Number(randomRange(rngDecor, 0.82, 1.28).toFixed(2)),
        colorVariant: rngDecor() > 0.5 ? 1 : 0
      });
    }
  }

  // 2. Place Moss Boulders (10 instances)
  for (let i = 0; i < 35 && decorations.filter((d) => d.kind === 'MOSS_BOULDER').length < 10; i++) {
    const angle = randomRange(rngDecor, 0, Math.PI * 2);
    const radius = randomRange(rngDecor, 3.2, 10.4);
    const x = Number((Math.cos(angle) * radius).toFixed(2));
    const z = Number((Math.sin(angle) * radius).toFixed(2));
    if (isInsideBrookChannel(x, z, 1.15)) continue;

    const y = sampleIslandElevation(x, z, noise);
    const pos: [number, number, number] = [x, y, z];

    if (isPositionClear(pos, 1.25)) {
      decorations.push({
        id: `decor-boulder-${decorations.length}`,
        kind: 'MOSS_BOULDER',
        position: pos,
        rotationY: Number(randomRange(rngDecor, 0, Math.PI * 2).toFixed(2)),
        scale: Number(randomRange(rngDecor, 0.75, 1.35).toFixed(2)),
        colorVariant: rngDecor() > 0.5 ? 1 : 0
      });
    }
  }

  // 3. Place Fern Clusters (12 instances)
  for (let i = 0; i < 40 && decorations.filter((d) => d.kind === 'FERN_CLUSTER').length < 12; i++) {
    const angle = randomRange(rngDecor, 0, Math.PI * 2);
    const radius = randomRange(rngDecor, 2.4, 9.6);
    const x = Number((Math.cos(angle) * radius).toFixed(2));
    const z = Number((Math.sin(angle) * radius).toFixed(2));
    if (isInsideBrookChannel(x, z, 1.2)) continue;

    const y = sampleIslandElevation(x, z, noise);
    const pos: [number, number, number] = [x, y, z];

    if (isPositionClear(pos, 1.05)) {
      decorations.push({
        id: `decor-fern-${decorations.length}`,
        kind: 'FERN_CLUSTER',
        position: pos,
        rotationY: Number(randomRange(rngDecor, 0, Math.PI * 2).toFixed(2)),
        scale: Number(randomRange(rngDecor, 0.85, 1.25).toFixed(2)),
        colorVariant: rngDecor() > 0.5 ? 1 : 0
      });
    }
  }

  // 4. Place Lotus Pads along the Brook (6 instances)
  const brookZPositions = [-5.8, -3.6, -1.6, 2.4, 4.5, 6.4];
  for (let i = 0; i < brookZPositions.length; i++) {
    const z = brookZPositions[i];
    const x = Number(
      (getBrookCenterX(z) + randomRange(rngDecor, -0.35, 0.35)).toFixed(2)
    );
    const pos: [number, number, number] = [x, 1.01, z];
    decorations.push({
      id: `decor-lotus-${i}`,
      kind: 'LOTUS_PAD',
      position: pos,
      rotationY: Number(randomRange(rngDecor, 0, Math.PI * 2).toFixed(2)),
      scale: Number(randomRange(rngDecor, 0.85, 1.2).toFixed(2)),
      colorVariant: i % 2
    });
  }

  // 5. Place Sanctuary Stone Lantern Posts (4 instances)
  const lanternCandidates: Array<[number, number]> = [
    [-1.6, 6.8],
    [1.8, 6.8],
    [-0.4, 1.2],
    [2.6, -0.4]
  ];
  for (let i = 0; i < lanternCandidates.length; i++) {
    const [lx, lz] = lanternCandidates[i];
    const ly = sampleIslandElevation(lx, lz, noise);
    const pos: [number, number, number] = [lx, ly, lz];
    if (isPositionClear(pos, 0.9)) {
      decorations.push({
        id: `decor-lantern-${i}`,
        kind: 'LANTERN_POST',
        position: pos,
        rotationY: 0,
        scale: 1,
        colorVariant: i % 2
      });
    }
  }

  return decorations;
}

/**
 * Generates a complete, validated WorldModel from a seed, profile, and task list.
 * Uses bounded repair attempts (up to 5) if any assertion fails.
 */
export function generateWorldModel(params: {
  worldSeed: string;
  profile: WorldProfile;
  tasks: TaskItem[];
}): WorldModel {
  const { worldSeed, profile, tasks } = params;
  const noise = new SeededNoise2D(worldSeed);

  let bestModel: WorldModel | null = null;

  for (let repairAttempt = 0; repairAttempt < 5; repairAttempt++) {
    const streams = createIsolatedStreams(worldSeed, repairAttempt);
    const landmarks = generateLandmarkNodes(tasks, streams.landmarks, noise);
    const { pathNodes, pathEdges } = buildNavigationGraph(landmarks);
    const { annotatedEdges, activeRouteNodeIds } = computeSanctuaryRoute(
      pathNodes,
      pathEdges,
      landmarks
    );
    const decorations = generateDecorations(landmarks, streams.decorations, noise);

    const validation = validateWorldLayout({
      landmarks,
      pathNodes,
      pathEdges: annotatedEdges,
      decorations,
      repairAttempts: repairAttempt
    });

    const candidateModel: WorldModel = {
      worldSeed,
      generatorVersion: GENERATOR_VERSION,
      profile,
      landmarks,
      pathNodes,
      pathEdges: annotatedEdges,
      activeRouteNodeIds,
      decorations,
      validation
    };

    bestModel = candidateModel;
    if (validation.isValid) {
      break;
    }
  }

  return bestModel!;
}

/**
 * Updates landmark growth stages and the illuminated A* route when tasks are
 * completed, undone, or replanned—WITHOUT regenerating landmark positions or decorations.
 */
export function applyTaskStateToWorldModel(
  existingWorld: WorldModel,
  updatedTasks: TaskItem[],
  updatedProfile?: WorldProfile
): WorldModel {
  const taskMap = new Map<string, TaskItem>(
    updatedTasks.map((t) => [t.id, t])
  );

  // If the set of task IDs changed entirely (e.g., new goal capture), generate fresh placements
  const sameTaskIds =
    existingWorld.landmarks.length === updatedTasks.length &&
    existingWorld.landmarks.every((lm) => taskMap.has(lm.taskId));

  if (!sameTaskIds) {
    return generateWorldModel({
      worldSeed: existingWorld.worldSeed,
      profile: updatedProfile ?? existingWorld.profile,
      tasks: updatedTasks
    });
  }

  const firstScheduledTask = updatedTasks.find(
    (t) => t.status === 'scheduled' || t.status === 'in-progress'
  );

  const updatedLandmarks: LegacyLandmarkNode[] = existingWorld.landmarks.map((lm) => {
    const task = taskMap.get(lm.taskId)!;
    const isCompleted = task.status === 'completed';
    const isDeferred = task.status === 'deferred';
    const isNextStep =
      !isCompleted && !isDeferred && firstScheduledTask?.id === task.id;
    const growthStage = isCompleted ? 2 : isDeferred ? 0 : 1;

    return {
      ...lm,
      label: task.title,
      subtitle: `${task.estimatedMinutes} min${
        task.isDurationConfirmed ? '' : ' (est.)'
      }`,
      category: task.category,
      archetype: categoryToArchetype(task.category),
      growthStage,
      isNextStep,
      isCompleted,
      isDeferred,
      estimatedMinutes: task.estimatedMinutes,
      rationaleOrDeferralNote:
        task.status === 'deferred'
          ? task.deferralText || 'Resting for a future window.'
          : task.rationaleText || 'Scheduled in today’s route.'
    };
  });

  const { annotatedEdges, activeRouteNodeIds } = computeSanctuaryRoute(
    existingWorld.pathNodes,
    existingWorld.pathEdges,
    updatedLandmarks
  );

  return {
    ...existingWorld,
    profile: updatedProfile ?? existingWorld.profile,
    landmarks: updatedLandmarks,
    pathEdges: annotatedEdges,
    activeRouteNodeIds
  };
}


// =====================================================================
// AI Studio Focus Living Village World Generator & River Extensions
// =====================================================================
import type {
  FocusTask,
  GeneratedWorldGraph,
  LandmarkNode,
  PathEdge,
  PlanScheduleResult,
  RoofStyleId
} from '@/types/focus';
import { SeededRandom, groundHeightAt } from './prng';
import {
  findShortestPathAStar,
  verifyGraphConnectivity,
  type GraphEdge2D,
  type GraphNode2D
} from '../pathfinding/astar';

export const RIVER_HALF_WIDTH = 2.8;
export const BRIDGE_Z_COORDS: readonly [number, number] = [-4.5, 6.5];

/**
 * Rerouted mountain river flowing along the EASTERN boundary of the valley (x ≈ 21.5),
 * serving as a natural scenic perimeter rather than splitting the central village.
 */
export function riverCenterXAtZ(z: number): number {
  return 21.5 + Math.sin(z * 0.08) * 1.85 + Math.cos(z * 0.04) * 0.75;
}

/**
 * Returns true if world coordinate (x, z) is inside the river water channel
 * and NOT on one of the arched stone bridges.
 */
export function isPointInRiverWater(x: number, z: number): boolean {
  const onBridge = BRIDGE_Z_COORDS.some((bz) => Math.abs(z - bz) <= 1.45);
  if (onBridge) return false;
  const riverX = riverCenterXAtZ(z);
  return Math.abs(x - riverX) < RIVER_HALF_WIDTH + 0.75;
}

/**
 * Clamps any NPC navigation point (x, z) onto the dry NavMesh so villagers
 * never walk over river water, routing them along the west riverbank or across stone bridges.
 */
export function clampPointOutOfRiver(x: number, z: number): [number, number] {
  if (!isPointInRiverWater(x, z)) {
    return [x, z];
  }
  const riverX = riverCenterXAtZ(z);
  const safeWestBankX = riverX - (RIVER_HALF_WIDTH + 1.15);
  const safeEastBankX = riverX + (RIVER_HALF_WIDTH + 1.15);
  return x <= riverX ? [safeWestBankX, z] : [safeEastBankX, z];
}

export type CarpenterAiState =
  | 'IDLE_AT_MILL'
  | 'ASSISTING_CONSTRUCTION'
  | 'CHOPPING_FRONTIER_TREE';

/**
 * Audits whether carpenters should be chopping wood or resting/assisting in the village.
 * Carpenters only chop trees when capacity is exceeded, lumber is critically low, or an active
 * land-expansion order is executing.
 */
export function evaluateCarpenterState(params: {
  totalTasksCount: number;
  plotCapacity: number;
  villageLumber: number;
  activeTreeClearWindowMs: number;
  hasActiveConstruction: boolean;
}): CarpenterAiState {
  const needsMoreLand = params.totalTasksCount > params.plotCapacity;
  const needsLumber = params.villageLumber < 25;
  const isActivelyClearing = params.activeTreeClearWindowMs > 0;

  if (needsMoreLand || needsLumber || isActivelyClearing) {
    return 'CHOPPING_FRONTIER_TREE';
  }
  if (params.hasActiveConstruction) {
    return 'ASSISTING_CONSTRUCTION';
  }
  return 'IDLE_AT_MILL';
}

/**
 * Dynamic resource pile rule: Wood/log piles only spawn on a plot when it is actively staked
 * for current construction (isNextStep) or explicitly selected by the user for inspection/staking.
 */
export function shouldSpawnPlotWoodPile(
  landmark: Pick<LandmarkNode, 'id' | 'isCompleted' | 'isNextStep' | 'isDeferred'>,
  selectedLandmarkId: string | null
): boolean {
  if (landmark.isCompleted || landmark.isDeferred) {
    return false;
  }
  return landmark.isNextStep || landmark.id === selectedLandmarkId;
}

/**
 * Cohesive village building plots arranged around the central Village Green & Well (x ∈ [-13, +12.5]),
 * completely west of the eastern boundary river (x ≈ 21.5).
 */
export const VILLAGE_GOAL_PLOTS: ReadonlyArray<{
  pos: [number, number, number];
  rot: number;
  defaultRoof: RoofStyleId;
  zoneLabel: string;
}> = [
  { pos: [-6.8, 0, 5.2], rot: 0.42, defaultRoof: 'THATCH_BROWN', zoneLabel: 'South-West Village Green' },
  { pos: [6.8, 0, 5.0], rot: -0.42, defaultRoof: 'CRIMSON_RED', zoneLabel: 'South-East Market Commons' },
  { pos: [-7.2, 0, -3.2], rot: 0.32, defaultRoof: 'COBALT_BLUE', zoneLabel: 'West Artisan Row' },
  { pos: [7.0, 0, -3.0], rot: -0.35, defaultRoof: 'THATCH_BROWN', zoneLabel: 'East Hearth Terrace' },
  { pos: [-6.4, 0, -10.2], rot: 0.24, defaultRoof: 'COBALT_BLUE', zoneLabel: 'North-West Sanctuary Lawn' },
  { pos: [6.6, 0, -10.0], rot: -0.24, defaultRoof: 'CRIMSON_RED', zoneLabel: 'North-East Foundry Rise' },
  { pos: [-12.8, 0, 1.4], rot: 0.48, defaultRoof: 'THATCH_BROWN', zoneLabel: 'West Meadow Outpost' },
  { pos: [12.4, 0, 1.4], rot: -0.48, defaultRoof: 'CRIMSON_RED', zoneLabel: 'East Riverside Promenade' },
  { pos: [-12.4, 0, 8.8], rot: 0.55, defaultRoof: 'COBALT_BLUE', zoneLabel: 'South-West Orchard Bend' },
  { pos: [12.2, 0, 8.8], rot: -0.55, defaultRoof: 'THATCH_BROWN', zoneLabel: 'South-East Bridge Approach' },
  { pos: [-13.0, 0, -6.8], rot: 0.38, defaultRoof: 'CRIMSON_RED', zoneLabel: 'Highland Timber Glade' },
  { pos: [12.6, 0, -6.8], rot: -0.38, defaultRoof: 'COBALT_BLUE', zoneLabel: 'North Riverside Overlook' }
];

/**
 * Generates a reproducible, validated 3D village landmark & dry NavMesh path network from tasks + schedule.
 * Completing or deferring a task updates landmark state in-place without rerolling coordinates.
 */
export function generateValidatedVillageWorld(
  worldSeed: number,
  tasks: readonly FocusTask[],
  schedule: PlanScheduleResult
): GeneratedWorldGraph {
  const rng = new SeededRandom(worldSeed);
  const scheduledMap = new Map(
    schedule.scheduledBlocks.map((b) => [b.taskId, b])
  );
  const deferredMap = new Map(
    schedule.deferredTasks.map((d) => [d.taskId, d])
  );

  const landmarks: LandmarkNode[] = tasks.slice(0, 12).map((task, idx) => {
    const basePlot = VILLAGE_GOAL_PLOTS[idx % VILLAGE_GOAL_PLOTS.length];
    const jitterX = (rng.next() - 0.5) * 0.14;
    const jitterZ = (rng.next() - 0.5) * 0.14;
    const [safeX, safeZ] = clampPointOutOfRiver(
      basePlot.pos[0] + jitterX,
      basePlot.pos[2] + jitterZ
    );
    const px = Number(safeX.toFixed(2));
    const pz = Number(safeZ.toFixed(2));
    const py = Number(groundHeightAt(px, pz, worldSeed).toFixed(2));

    const isCompleted = task.status === 'completed';
    const scheduledBlock = scheduledMap.get(task.id);
    const deferredRec = deferredMap.get(task.id);
    const isNextStep = Boolean(scheduledBlock?.isNextStep && !isCompleted);
    const isDeferred = Boolean(deferredRec && !isCompleted);

    const roofStyle: RoofStyleId = isCompleted
      ? 'COBALT_BLUE'
      : isNextStep
      ? 'CRIMSON_RED'
      : basePlot.defaultRoof;

    const growthStage: 0 | 1 | 2 | 3 = isCompleted
      ? 3
      : isNextStep
      ? 2
      : isDeferred
      ? 0
      : 1;

    return {
      id: `landmark-${task.id}`,
      taskId: task.id,
      plotIndex: idx,
      label: task.title,
      subtitle: `${task.estimatedMinutes}m est. · ${basePlot.zoneLabel}`,
      category: task.category,
      roofStyle,
      position: [px, py, pz],
      rotationY: basePlot.rot,
      hasTower: idx === 0 || isCompleted,
      isCompleted,
      isNextStep,
      isDeferred,
      wasJustTransformed: false,
      rationaleOrDeferralNote:
        scheduledBlock?.explanation ??
        deferredRec?.explanation ??
        (isCompleted
          ? 'Completed survival guild generating resources for the valley.'
          : 'Unbuilt village plot awaiting active construction.'),
      growthStage
    };
  });

  // Build dry NavMesh graph nodes (Town Hall Hub + all landmarks)
  const hubNode: GraphNode2D = { id: 'town-hall-hub', x: 0.0, z: 1.0 };
  const graphNodes: GraphNode2D[] = [
    hubNode,
    ...landmarks.map((lm) => ({
      id: lm.id,
      x: lm.position[0],
      z: lm.position[2]
    }))
  ];

  const graphEdges: GraphEdge2D[] = [];
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const distToHub = Math.hypot(lm.position[0] - hubNode.x, lm.position[2] - hubNode.z);
    graphEdges.push({
      from: hubNode.id,
      to: lm.id,
      weight: Number(distToHub.toFixed(2))
    });

    if (i > 0) {
      const prev = landmarks[i - 1];
      const distPrev = Math.hypot(
        lm.position[0] - prev.position[0],
        lm.position[2] - prev.position[2]
      );
      graphEdges.push({
        from: prev.id,
        to: lm.id,
        weight: Number(distPrev.toFixed(2))
      });
    }
  }

  const isConnected = verifyGraphConnectivity(graphNodes, graphEdges);

  const scheduledLandmarks = landmarks.filter(
    (l) => !l.isDeferred && !l.isCompleted
  );
  const activeRouteNodeIds: string[] = [];
  if (scheduledLandmarks.length > 0) {
    const firstTarget = scheduledLandmarks[0];
    const path = findShortestPathAStar(
      graphNodes,
      graphEdges,
      hubNode.id,
      firstTarget.id
    );
    activeRouteNodeIds.push(...path);
  }

  const edges: PathEdge[] = landmarks.map((lm) => {
    const rawMidX = (hubNode.x + lm.position[0]) * 0.5;
    const rawMidZ = (hubNode.z + lm.position[2]) * 0.5 + 0.5;
    const [midX, midZ] = clampPointOutOfRiver(rawMidX, rawMidZ);
    return {
      fromId: hubNode.id,
      toId: lm.id,
      waypoints: [
        [hubNode.x, 0.08, hubNode.z],
        [Number(midX.toFixed(2)), 0.12, Number(midZ.toFixed(2))],
        [lm.position[0], 0.08, lm.position[2]]
      ],
      distance: Number(
        Math.hypot(lm.position[0] - hubNode.x, lm.position[2] - hubNode.z).toFixed(2)
      ),
      isActiveRoute: lm.isNextStep || lm.isCompleted
    };
  });

  return {
    worldSeed,
    landmarks,
    edges,
    activeRouteNodeIds,
    isConnected
  };
}
