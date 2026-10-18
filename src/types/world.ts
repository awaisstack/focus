import type { TaskCategory } from './task';

export type BiomePresetId =
  | 'SUNLIT_GLADE'
  | 'GOLDEN_MEADOW'
  | 'MISTY_ZEN_STREAM'
  | 'TWILIGHT_GROVE';

export type SoundscapePresetId =
  | 'MORNING_BREEZE'
  | 'AMBER_STILLNESS'
  | 'JADE_RAIN_STREAM'
  | 'TWILIGHT_CRICKETS';

export type LandmarkArchetype =
  | 'STUDY_NOOK'
  | 'WRITING_PAVILION'
  | 'WALK_TRAIL_ARCH'
  | 'CONNECT_BENCH'
  | 'SANCTUARY_GREENHOUSE';

/**
 * 0 = Dormant / Deferred (soft misty rest state)
 * 1 = Scheduled / Active (daylight ready state; golden beacon if isNextStep)
 * 2 = Completed / Flourishing (full botanical bloom + lit warm lantern)
 */
export type LandmarkGrowthStage = 0 | 1 | 2;

export interface WorldProfile {
  biomeId: BiomePresetId;
  soundscapeId: SoundscapePresetId;
  narrativeLine: string;
  atmosphereNote: string;
  sunElevationDeg: number;
  fogDensity: number;
}

export interface LandmarkNode {
  id: string;
  taskId: string;
  label: string;
  subtitle: string;
  category: TaskCategory;
  archetype: LandmarkArchetype;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  growthStage: LandmarkGrowthStage;
  isNextStep: boolean;
  isCompleted: boolean;
  isDeferred: boolean;
  estimatedMinutes: number;
  rationaleOrDeferralNote: string;
}

export interface PathNode {
  id: string;
  position: [number, number, number];
  kind: 'GATE' | 'WAYPOINT' | 'BRIDGE' | 'LANDMARK';
  landmarkId?: string;
}

export interface PathEdge {
  fromId: string;
  toId: string;
  weight: number;
  isActiveRoute: boolean;
  isCompletedSegment: boolean;
  isDeferredTrail: boolean;
  state?: 'INACTIVE_TRAIL' | 'COMPLETED_ROUTE' | 'ACTIVE_ROUTE' | 'DEFERRED_SIDE_TRAIL';
}

export interface DecorationInstance {
  id: string;
  kind: 'PINE_TREE' | 'MOSS_BOULDER' | 'FERN_CLUSTER' | 'LOTUS_PAD' | 'LANTERN_POST';
  position: [number, number, number];
  rotationY: number;
  scale: number;
  colorVariant: number;
}

export interface WorldValidationReport {
  isValid: boolean;
  noLandmarkOverlap: boolean;
  graphConnected: boolean;
  markerClearanceValid: boolean;
  repairAttempts: number;
  messages: string[];
}

export interface WorldModel {
  worldSeed: string;
  generatorVersion: string;
  profile: WorldProfile;
  landmarks: LandmarkNode[];
  pathNodes: PathNode[];
  pathEdges: PathEdge[];
  activeRouteNodeIds: string[];
  decorations: DecorationInstance[];
  validation: WorldValidationReport;
}
