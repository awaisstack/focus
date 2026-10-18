export type TaskStatus =
  | 'proposed'
  | 'pending'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'deferred'
  | 'cancelled';

export type TaskCategory =
  | 'SCHOLAR_TOWER'
  | 'GUILD_WORKSHOP'
  | 'MEADOW_PAVILION'
  | 'MARKET_HEARTH'
  | 'MILL_GRANARY'
  | 'APOTHECARY_COTTAGE';

export type DeferralReasonCode =
  | 'FITS_SCHEDULE'
  | 'HARD_DEADLINE_FIRST'
  | 'PREREQUISITE_READY'
  | 'FIXED_APPOINTMENT'
  | 'INSUFFICIENT_TIME'
  | 'DEPENDENCY_BLOCKED'
  | 'USER_DEFERRED'
  | 'ALREADY_COMPLETED';

export interface FocusTask {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  isDurationConfirmed: boolean;
  priority: 1 | 2 | 3 | 4 | 5;
  category: TaskCategory;
  dueTimeMinutesFromNow?: number;
  isHardDeadline?: boolean;
  isFixedAppointment?: boolean;
  dependencies: string[];
  status: TaskStatus;
  source: 'user' | 'ai' | 'preset';
  createdAt: number;
  completedAt?: number;
}

export interface ScheduledTaskBlock {
  taskId: string;
  title: string;
  category: TaskCategory;
  startMinuteOffset: number;
  endMinuteOffset: number;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priorityScore: number;
  isNextStep: boolean;
  reasonCode: DeferralReasonCode;
  explanation: string;
}

export interface DeferredTaskRecord {
  taskId: string;
  title: string;
  estimatedMinutes: number;
  reasonCode: DeferralReasonCode;
  explanation: string;
}

export interface PlanScheduleResult {
  availableMinutes: number;
  scheduledBlocks: ScheduledTaskBlock[];
  deferredTasks: DeferredTaskRecord[];
  completedTaskIds: string[];
  totalScheduledMinutes: number;
  remainingFreeMinutes: number;
  nextStepTaskId: string | null;
  hasCycleError: boolean;
  cycleErrorMessage?: string;
}

export interface PlanDiffEntry {
  taskId: string;
  title: string;
  previousState: 'scheduled' | 'deferred' | 'completed';
  newState: 'scheduled' | 'deferred' | 'completed';
  reasonCode: DeferralReasonCode;
  explanation: string;
}

export type BiomePresetId =
  | 'GOLDEN_VALE'
  | 'SUNLIT_GLADE'
  | 'AUTUMN_HEARTH'
  | 'TWILIGHT_SANCTUARY';

export type SoundscapePresetId =
  | 'MORNING_BIRDS_BREEZE'
  | 'HEARTHFIRE_BROOK'
  | 'GENTLE_MEADOW_WIND';

export type RoofStyleId = 'COBALT_BLUE' | 'CRIMSON_RED' | 'THATCH_BROWN';

export interface WorldProfile {
  biomePreset: BiomePresetId;
  soundscapePreset: SoundscapePresetId;
  sunElevationDeg: number;
  narrativeLine: string;
  villagerStewardGreeting: string;
}

export interface LandmarkNode {
  id: string;
  taskId: string;
  plotIndex: number;
  label: string;
  subtitle: string;
  category: TaskCategory;
  roofStyle: RoofStyleId;
  position: [number, number, number];
  rotationY: number;
  hasTower: boolean;
  isCompleted: boolean;
  isNextStep: boolean;
  isDeferred: boolean;
  wasJustTransformed?: boolean;
  rationaleOrDeferralNote: string;
  growthStage: 0 | 1 | 2 | 3; // 0: foundation, 1: framed scaffolding, 2: active construction, 3: completed building
}

export interface SurvivalMilestoneNotification {
  id: string;
  taskId: string;
  landmarkId: string;
  taskTitle: string;
  guildName: string;
  category: TaskCategory;
  specialistName: string;
  specialistTitle: string;
  survivalBenefitHeadline: string;
  survivalNarrative: string;
  landExpansionNote: string;
  treesClearedCount: number;
  newLandRadiusMeters: number;
  newWorkerPopulation: number;
  nextBuildingName: string | null;
  nextGoalTitle: string | null;
  timestamp: number;
}

export interface PathEdge {
  fromId: string;
  toId: string;
  waypoints: Array<[number, number, number]>;
  distance: number;
  isActiveRoute: boolean;
}

export interface GeneratedWorldGraph {
  worldSeed: number;
  landmarks: LandmarkNode[];
  edges: PathEdge[];
  activeRouteNodeIds: string[];
  isConnected: boolean;
}

export type VillagerSpeakerId =
  | 'ELENA_VILLAGER'
  | 'MAYA_BUILDER'
  | 'ROWAN_ELDER'
  | 'CLARA_BAKER';

export interface VillagerVoiceLine {
  speakerId: VillagerSpeakerId;
  speakerName: string;
  speakerRole: string;
  text: string;
  isSpeaking?: boolean;
  sourceTier?:
    | 'GEMINI_NEURAL_TTS'
    | 'AMD_OMNIVOICE'
    | 'EDGE_NEURAL_MP3'
    | 'ELEVENLABS_NEURAL'
    | 'CLOUD_NEURAL_MP3'
    | 'BROWSER_SPEECH_SYNTHESIS'
    | 'WEB_AUDIO_SYNTH';
}

export interface AiTelemetryRecord {
  id: string;
  timestamp: number;
  operation: 'GOAL_PARSE' | 'INTERRUPTION_REPLAN' | 'MODEL_DISCOVERY' | 'NEURAL_TTS';
  provider: 'AMD_TOKEN_FACTORY' | 'GEMINI_SERVER' | 'DETERMINISTIC_FALLBACK';
  modelId: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  validationPassed: boolean;
  fallbackUsed: boolean;
  note: string;
}

export type CameraStageMode = 'gate' | 'cabin' | 'village';
export type CameraProjectionMode = 'PERSPECTIVE' | 'ISOMETRIC_RTS';

export interface BuildingArchetypeSpec {
  category: TaskCategory;
  guildName: string;
  shortRole: string;
  survivalEffect: string;
  survivalDetailedBenefit: string;
  whatHappensNextEffect: string;
  specialistName: string;
  specialistTitle: string;
  characterGlb: string;
  completedGltf: string;
  accentHex: string;
}

export const BUILDING_ARCHETYPES: Record<TaskCategory, BuildingArchetypeSpec> = {
  GUILD_WORKSHOP: {
    category: 'GUILD_WORKSHOP',
    guildName: "Carpenter's Lumbermill & Sawmill",
    shortRole: 'Timber Beams & Land Clearing',
    survivalEffect: '+35 Timber/hr · Unlocks Forest Clearing',
    survivalDetailedBenefit:
      'Master Carpenter Alden cuts seasoned pine logs into structural oak beams, weatherproofing village roofs against mountain storms and training lumberjacks to clear frontier trees.',
    whatHappensNextEffect:
      'Carpenters now patrol the valley edge with axes to fell frontier pine trees and expand buildable village land.',
    specialistName: 'Alden',
    specialistTitle: 'Master Carpenter',
    characterGlb: '/assets/models/characters/Barbarian.glb',
    completedGltf: '/assets/models/buildings/building_lumbermill_green.gltf',
    accentHex: '#d97706'
  },
  SCHOLAR_TOWER: {
    category: 'SCHOLAR_TOWER',
    guildName: "Scholar's Sanctuary & Scriptorium",
    shortRole: 'Engineering Blueprints & Clarity',
    survivalEffect: '+25 Wisdom · +20% Construction Efficiency',
    survivalDetailedBenefit:
      'Brother Rowan drafts architectural blueprints, crop-rotation almanacs, and waterwheel schematics so every guild works with zero wasted effort.',
    whatHappensNextEffect:
      'Unlocks advanced stone masonry blueprints and increases village morale across all artisan workshops.',
    specialistName: 'Rowan',
    specialistTitle: 'Village Scholar',
    characterGlb: '/assets/models/characters/Mage.glb',
    completedGltf: '/assets/models/buildings/building_church_green.gltf',
    accentHex: '#2563eb'
  },
  MARKET_HEARTH: {
    category: 'MARKET_HEARTH',
    guildName: 'Riverside Marketplace & Trade Hall',
    shortRole: 'Barter Economy & Artisan Goods',
    survivalEffect: '+45 Gold/hr · +20% Village Prosperity',
    survivalDetailedBenefit:
      'Clara opens riverside market stalls with woven awnings where farmers, blacksmiths, and neighboring valley traders exchange grain, tools, and firewood.',
    whatHappensNextEffect:
      'Attracts new settler families across the stone bridge and boosts daily gold treasury for town expansion.',
    specialistName: 'Clara',
    specialistTitle: 'Market Steward',
    characterGlb: '/assets/models/characters/Rogue.glb',
    completedGltf: '/assets/models/buildings/building_market_green.gltf',
    accentHex: '#dc2626'
  },
  MILL_GRANARY: {
    category: 'MILL_GRANARY',
    guildName: 'Windmill & Granary Bakery',
    shortRole: 'Flour Milling & Winter Food Stores',
    survivalEffect: '+40 Food Loaves/hr · Prevents Hunger',
    survivalDetailedBenefit:
      'Miller Elena grinds golden valley wheat into flour and bakes warm hearth loaves, guaranteeing your growing population is well-fed through every season.',
    whatHappensNextEffect:
      'Fills the village granary reserves so 3 new specialist workers can move into the valley.',
    specialistName: 'Elena',
    specialistTitle: 'Master Miller & Baker',
    characterGlb: '/assets/models/characters/Rogue_Hooded.glb',
    completedGltf: '/assets/models/buildings/building_windmill_green.gltf',
    accentHex: '#ca8a04'
  },
  APOTHECARY_COTTAGE: {
    category: 'APOTHECARY_COTTAGE',
    guildName: 'Blacksmith & Herbal Apothecary',
    shortRole: 'Iron Axes, Tools & Herbal Remedies',
    survivalEffect: '+25 Iron Tools · +25% Villager Vitality',
    survivalDetailedBenefit:
      'Master Blacksmith Garrick forges tempered iron axes and pickaxes while brewing alpine pine remedies that keep every builder healthy and resilient.',
    whatHappensNextEffect:
      'Equips carpenters with tempered steel axes so frontier tree-clearing and building assembly run faster.',
    specialistName: 'Garrick',
    specialistTitle: 'Blacksmith & Healer',
    characterGlb: '/assets/models/characters/Barbarian.glb',
    completedGltf: '/assets/models/buildings/building_blacksmith_green.gltf',
    accentHex: '#059669'
  },
  MEADOW_PAVILION: {
    category: 'MEADOW_PAVILION',
    guildName: 'Hearth Tavern & Settlers Inn',
    shortRole: 'Warm Shelter, Rest & Community Morale',
    survivalEffect: '+30 Morale · +4 Settler Housing Capacity',
    survivalDetailedBenefit:
      'Steward Mira tends the warm hearth inn beside the stone bridge, giving weary carpenters and farmers a joyful place to rest, sing, and recover energy.',
    whatHappensNextEffect:
      'Raises village happiness to peak levels and welcomes new villagers to stroll along the river bridges.',
    specialistName: 'Mira',
    specialistTitle: 'Hearth Innkeeper',
    characterGlb: '/assets/models/characters/Knight.glb',
    completedGltf: '/assets/models/buildings/building_tavern_green.gltf',
    accentHex: '#7c3aed'
  }
};
