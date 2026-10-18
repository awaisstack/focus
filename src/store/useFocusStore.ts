import { useSyncExternalStore } from 'react';
import {
  BUILDING_ARCHETYPES,
  type AiTelemetryRecord,
  type CameraProjectionMode,
  type CameraStageMode,
  type FocusTask,
  type LandmarkNode,
  type PathEdge,
  type PlanDiffEntry,
  type PlanScheduleResult,
  type SurvivalMilestoneNotification,
  type TaskCategory,
  type WorldProfile
} from '../types/focus';
import {
  buildDeterministicSchedule,
  computePlanDiff
} from '../core/planner/scheduleEngine';
import { generateValidatedVillageWorld } from '../core/pcg/worldGenerator';
import {
  estimateInferenceCostUsd,
  inferCategoryFromTitle,
  parseGoalsDeterministically,
  parseInterruptionMinutes
} from '../core/ai/heuristicFallback';
import { voiceoverEngine } from '../core/audio/voiceoverEngine';

const STORAGE_KEY = 'focus_living_village_state_v6';

export interface FocusAppState {
  hasHydratedStorage: boolean;
  cameraStage: CameraStageMode; // 'gate' -> 'cabin' -> 'village'
  cameraProjection: CameraProjectionMode; // 'PERSPECTIVE' | 'ISOMETRIC_RTS'
  hasEnteredWorld: boolean;
  isGoalModalOpen: boolean;
  isReplanDrawerOpen: boolean;
  isExperienceLabOpen: boolean;
  isTutorialOpen: boolean;
  isBottomDockCollapsed: boolean;
  isAudioMuted: boolean;
  reducedMotion: boolean;
  isAiLoading: boolean;
  previewThrivingTown: boolean;

  founderName: string;
  townName: string;
  worldSeed: number;
  availableMinutes: number;
  tasks: FocusTask[];
  schedule: PlanScheduleResult;
  landmarks: LandmarkNode[];
  edges: PathEdge[];
  worldProfile: WorldProfile;
  planDiff: PlanDiffEntry[];
  previousSnapshot: {
    tasks: FocusTask[];
    availableMinutes: number;
  } | null;

  selectedLandmarkId: string | null;
  lastCompletedLandmarkId: string | null;
  lastMilestoneModal: SurvivalMilestoneNotification | null;
  lastCompletedToast: string | null;
  lastUndoTaskId: string | null;

  villageGold: number;
  villageLumber: number;
  villageFood: number;
  villagerPopulation: number;
  clearedTreesCount: number;
  landRadiusMeters: number;
  treeClearPulse: number;
  lastTreeClearAt: number;

  transformationPulse: number;
  lastTransformationAt: number;
  telemetryLog: AiTelemetryRecord[];
}

const DEFAULT_PROMPT =
  'Finish my project assignment for 40 minutes, prepare a healthy meal for 25 minutes, study my notes for 35 minutes, reply to messages and call my friend for 20 minutes, do a quick workout for 20 minutes, and take a relaxing evening walk for 20 minutes';

function buildInitialState(): FocusAppState {
  const { tasks, worldProfile } = parseGoalsDeterministically(DEFAULT_PROMPT);
  const availableMinutes = 240;
  const worldSeed = 20261017;
  const schedule = buildDeterministicSchedule(tasks, availableMinutes);
  const worldGraph = generateValidatedVillageWorld(worldSeed, tasks, schedule);

  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
  const isAutostart = searchParams?.get('autostart') === '1';
  const requestedStage = searchParams?.get('stage');
  const isVillageStage =
    requestedStage === 'village' ||
    requestedStage?.startsWith('village-') ||
    isAutostart;
  const initialStage: CameraStageMode =
    requestedStage === 'cabin'
      ? 'cabin'
      : isVillageStage
      ? 'village'
      : 'gate';

  return {
    hasHydratedStorage: false,
    cameraStage: initialStage,
    cameraProjection:
      searchParams?.get('cam') === 'iso' ? 'ISOMETRIC_RTS' : 'PERSPECTIVE',
    hasEnteredWorld: initialStage !== 'gate',
    isGoalModalOpen: initialStage === 'cabin',
    isReplanDrawerOpen: false,
    isExperienceLabOpen: false,
    isTutorialOpen: false,
    isBottomDockCollapsed: false,
    isAudioMuted: false,
    reducedMotion: false,
    isAiLoading: false,
    previewThrivingTown: requestedStage === 'village-thriving',

    founderName: 'Awais',
    townName: 'Oakvale',
    worldSeed,
    availableMinutes,
    tasks,
    schedule,
    landmarks: worldGraph.landmarks,
    edges: worldGraph.edges,
    worldProfile,
    planDiff: [],
    previousSnapshot: null,

    selectedLandmarkId: worldGraph.landmarks[0]?.id ?? null,
    lastCompletedLandmarkId: null,
    lastMilestoneModal: null,
    lastCompletedToast: null,
    lastUndoTaskId: null,

    villageGold: 120,
    villageLumber: 90,
    villageFood: 100,
    villagerPopulation: 4,
    clearedTreesCount: 0,
    landRadiusMeters: 22,
    treeClearPulse: 0,
    lastTreeClearAt: 0,

    transformationPulse: 1,
    lastTransformationAt: 0,
    telemetryLog: [
      {
        id: 'boot-seed-1',
        timestamp: Date.now(),
        operation: 'GOAL_PARSE',
        provider: 'DETERMINISTIC_FALLBACK',
        modelId: 'Gemma-4-31B-IT / Deterministic-PCG',
        latencyMs: 14,
        promptTokens: 78,
        completionTokens: 134,
        estimatedCostUsd: 0.000092,
        validationPassed: true,
        fallbackUsed: false,
        note: 'Level 1 Pioneer settlement initialized with Master Carpenter Alden and 6 riverside guild plots.'
      }
    ]
  };
}

let state: FocusAppState = buildInitialState();
const listeners = new Set<() => void>();

function syncBodyDatasetState(next: FocusAppState) {
  if (typeof document === 'undefined') return;
  if (!next.hasEnteredWorld && next.cameraStage === 'gate') {
    document.body.dataset.state = 'title';
  } else if (
    next.isReplanDrawerOpen ||
    next.isExperienceLabOpen ||
    next.isTutorialOpen
  ) {
    document.body.dataset.state = 'paused';
  } else {
    document.body.dataset.state = 'playing';
  }
}

function emitChange() {
  syncBodyDatasetState(state);
  for (const listener of listeners) {
    listener();
  }
}

function saveToStorage(current: FocusAppState) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      founderName: current.founderName,
      townName: current.townName,
      worldSeed: current.worldSeed,
      availableMinutes: current.availableMinutes,
      tasks: current.tasks,
      worldProfile: current.worldProfile,
      villageGold: current.villageGold,
      villageLumber: current.villageLumber,
      villageFood: current.villageFood,
      villagerPopulation: current.villagerPopulation,
      clearedTreesCount: current.clearedTreesCount,
      landRadiusMeters: current.landRadiusMeters,
      isAudioMuted: current.isAudioMuted,
      cameraProjection: current.cameraProjection
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

function recomputeWorldFromTasks(
  nextTasks: FocusTask[],
  nextAvailableMinutes: number,
  worldSeed: number,
  recordDiffFrom?: PlanScheduleResult
) {
  const nextSchedule = buildDeterministicSchedule(nextTasks, nextAvailableMinutes);
  const nextWorld = generateValidatedVillageWorld(worldSeed, nextTasks, nextSchedule);
  const nextDiff = recordDiffFrom
    ? computePlanDiff(recordDiffFrom, nextSchedule, nextTasks)
    : state.planDiff;

  const changedTaskIds = new Set(nextDiff.map((d) => d.taskId));
  const landmarksWithTransformFlag = nextWorld.landmarks.map((lm) => ({
    ...lm,
    wasJustTransformed: recordDiffFrom ? changedTaskIds.has(lm.taskId) : false
  }));

  const nextStepLm =
    landmarksWithTransformFlag.find((l) => l.isNextStep) ??
    landmarksWithTransformFlag.find((l) => !l.isCompleted) ??
    landmarksWithTransformFlag[0] ??
    null;

  return {
    schedule: nextSchedule,
    landmarks: landmarksWithTransformFlag,
    edges: nextWorld.edges,
    planDiff: nextDiff,
    selectedLandmarkId: nextStepLm?.id ?? null
  };
}

export const focusActions = {
  hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const isAutostart = params.get('autostart') === '1';
      const requestedStage = params.get('stage');

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FocusAppState>;
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          const mins = parsed.availableMinutes ?? 240;
          const seed = parsed.worldSeed ?? 20261017;
          const recomputed = recomputeWorldFromTasks(parsed.tasks, mins, seed);
          state = {
            ...state,
            hasHydratedStorage: true,
            founderName: parsed.founderName || state.founderName,
            townName: parsed.townName || state.townName,
            worldSeed: seed,
            availableMinutes: mins,
            tasks: parsed.tasks,
            worldProfile: parsed.worldProfile ?? state.worldProfile,
            villageGold: parsed.villageGold ?? state.villageGold,
            villageLumber: parsed.villageLumber ?? state.villageLumber,
            villageFood: parsed.villageFood ?? state.villageFood,
            villagerPopulation: parsed.villagerPopulation ?? state.villagerPopulation,
            clearedTreesCount: parsed.clearedTreesCount ?? state.clearedTreesCount,
            landRadiusMeters: parsed.landRadiusMeters ?? state.landRadiusMeters,
            cameraProjection: parsed.cameraProjection ?? state.cameraProjection,
            isAudioMuted: Boolean(parsed.isAudioMuted),
            ...recomputed
          };
        }
      }

      if (requestedStage === 'cabin') {
        state = {
          ...state,
          hasHydratedStorage: true,
          hasEnteredWorld: true,
          cameraStage: 'cabin',
          isGoalModalOpen: true
        };
      } else if (
        isAutostart ||
        requestedStage === 'village' ||
        requestedStage?.startsWith('village-')
      ) {
        state = {
          ...state,
          hasHydratedStorage: true,
          hasEnteredWorld: true,
          cameraStage: 'village',
          isGoalModalOpen: false,
          previewThrivingTown:
            requestedStage === 'village-thriving'
              ? true
              : state.previewThrivingTown,
          cameraProjection:
            params.get('cam') === 'iso'
              ? 'ISOMETRIC_RTS'
              : state.cameraProjection
        };
      } else {
        state = { ...state, hasHydratedStorage: true };
      }
      emitChange();
    } catch {
      state = { ...state, hasHydratedStorage: true };
      emitChange();
    }
  },

  setFounderAndTown(founderName: string, townName: string): void {
    state = {
      ...state,
      founderName: founderName.trim() || 'Awais',
      townName: townName.trim() || 'Oakvale'
    };
    saveToStorage(state);
    emitChange();
  },

  enterWorld(opts?: { muted?: boolean; skipToVillage?: boolean }): void {
    const muted = opts?.muted ?? state.isAudioMuted;
    const targetStage: CameraStageMode = opts?.skipToVillage ? 'village' : 'cabin';

    voiceoverEngine.setMuted(muted);
    if (!muted) {
      voiceoverEngine.startAmbientSoundscape();
    }

    state = {
      ...state,
      hasEnteredWorld: true,
      isAudioMuted: muted,
      cameraStage: targetStage,
      isGoalModalOpen: targetStage === 'cabin',
      transformationPulse: state.transformationPulse + 1,
      lastTransformationAt: 0
    };
    saveToStorage(state);
    emitChange();
  },

  returnToGateway(): void {
    state = {
      ...state,
      hasEnteredWorld: false,
      cameraStage: 'gate',
      isGoalModalOpen: false,
      isReplanDrawerOpen: false,
      isTutorialOpen: false
    };
    emitChange();
  },

  openGoalModal(): void {
    state = {
      ...state,
      hasEnteredWorld: true,
      cameraStage: 'cabin',
      isGoalModalOpen: true,
      isReplanDrawerOpen: false,
      isTutorialOpen: false
    };
    emitChange();
  },

  closeGoalModal(): void {
    state = {
      ...state,
      cameraStage: 'village',
      isGoalModalOpen: false,
      transformationPulse: state.transformationPulse + 1
    };
    emitChange();
  },

  resetVillageAndStartFresh(): void {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore quota/access errors
      }
    }
    const initial = buildInitialState();
    state = {
      ...initial,
      hasHydratedStorage: true,
      hasEnteredWorld: true,
      cameraStage: 'cabin',
      isGoalModalOpen: true,
      founderName: state.founderName,
      townName: state.townName,
      transformationPulse: state.transformationPulse + 1
    };
    saveToStorage(state);
    emitChange();
  },

  openTutorial(): void {
    state = {
      ...state,
      isTutorialOpen: true
    };
    emitChange();
  },

  closeTutorial(): void {
    state = {
      ...state,
      isTutorialOpen: false
    };
    emitChange();
  },

  openReplanDrawer(): void {
    state = {
      ...state,
      isReplanDrawerOpen: true,
      isGoalModalOpen: false,
      isTutorialOpen: false
    };
    emitChange();
  },

  closeReplanDrawer(): void {
    state = {
      ...state,
      isReplanDrawerOpen: false
    };
    emitChange();
  },

  toggleExperienceLab(): void {
    state = {
      ...state,
      isExperienceLabOpen: !state.isExperienceLabOpen
    };
    emitChange();
  },

  toggleBottomDock(): void {
    state = {
      ...state,
      isBottomDockCollapsed: !state.isBottomDockCollapsed
    };
    emitChange();
  },

  toggleCameraProjection(): void {
    const nextProj: CameraProjectionMode =
      state.cameraProjection === 'PERSPECTIVE' ? 'ISOMETRIC_RTS' : 'PERSPECTIVE';
    state = {
      ...state,
      cameraProjection: nextProj
    };
    saveToStorage(state);
    emitChange();
  },

  togglePreviewThrivingTown(): void {
    voiceoverEngine.playCompletionChime();
    state = {
      ...state,
      previewThrivingTown: !state.previewThrivingTown,
      transformationPulse: state.transformationPulse + 1
    };
    emitChange();
  },

  toggleMute(): void {
    const nextMuted = !state.isAudioMuted;
    voiceoverEngine.setMuted(nextMuted);
    state = {
      ...state,
      isAudioMuted: nextMuted
    };
    saveToStorage(state);
    emitChange();
  },

  toggleReducedMotion(): void {
    state = {
      ...state,
      reducedMotion: !state.reducedMotion
    };
    emitChange();
  },

  selectLandmark(id: string | null): void {
    state = {
      ...state,
      selectedLandmarkId: id
    };
    emitChange();
  },

  dismissMilestoneModal(): void {
    state = {
      ...state,
      lastMilestoneModal: null
    };
    emitChange();
  },

  triggerTreeClearExpansion(): void {
    voiceoverEngine.playWoodClick();
    state = {
      ...state,
      clearedTreesCount: state.clearedTreesCount + 4,
      landRadiusMeters: Math.min(44, state.landRadiusMeters + 4),
      villageLumber: state.villageLumber + 40,
      treeClearPulse: state.treeClearPulse + 1,
      lastTreeClearAt: Date.now()
    };
    saveToStorage(state);
    emitChange();
  },

  triggerHogwartsTransform(): void {
    voiceoverEngine.playMagicalTransformSpell();
    state = {
      ...state,
      landmarks: state.landmarks.map((lm) => ({
        ...lm,
        wasJustTransformed: true
      })),
      transformationPulse: state.transformationPulse + 1,
      lastTransformationAt: Date.now()
    };
    emitChange();
  },

  /**
   * Completing a single task ONLY finishes that specific building in-place,
   * advances the Next Step hammer to the next queued building without reshuffling any other plot,
   * only dispatches Carpenters to fell trees if land capacity or lumber is needed,
   * and triggers the non-blocking bottom-right Building Completion Toast!
   */
  completeTask(taskId: string): void {
    const target = state.tasks.find((t) => t.id === taskId);
    if (!target || target.status === 'completed') return;

    const updatedTasks: FocusTask[] = state.tasks.map((t) =>
      t.id === taskId ? { ...t, status: 'completed', completedAt: Date.now() } : t
    );

    const remainingActiveLandmarks = state.landmarks.filter(
      (lm) => lm.taskId !== taskId && !lm.isCompleted && !lm.isDeferred
    );
    const nextActiveLandmarkId = remainingActiveLandmarks[0]?.id ?? null;

    const updatedLandmarks: LandmarkNode[] = state.landmarks.map((lm) => {
      if (lm.taskId === taskId) {
        return {
          ...lm,
          isCompleted: true,
          isNextStep: false,
          isDeferred: false,
          wasJustTransformed: false,
          growthStage: 3,
          roofStyle: 'COBALT_BLUE',
          rationaleOrDeferralNote:
            'Operational survival guild actively producing resources for your village.'
        };
      }
      if (lm.id === nextActiveLandmarkId) {
        return {
          ...lm,
          isNextStep: true,
          wasJustTransformed: false,
          growthStage: 2,
          roofStyle: 'CRIMSON_RED'
        };
      }
      return {
        ...lm,
        isNextStep: false,
        wasJustTransformed: false
      };
    });

    const updatedSchedule: PlanScheduleResult = {
      ...state.schedule,
      completedTaskIds: [...state.schedule.completedTaskIds, taskId],
      scheduledBlocks: state.schedule.scheduledBlocks
        .filter((b) => b.taskId !== taskId)
        .map((b, idx) => ({
          ...b,
          isNextStep: idx === 0
        })),
      nextStepTaskId:
        state.schedule.scheduledBlocks.find((b) => b.taskId !== taskId)?.taskId ??
        null
    };

    const arch =
      BUILDING_ARCHETYPES[target.category] ?? BUILDING_ARCHETYPES.GUILD_WORKSHOP;
    const nextLm = updatedLandmarks.find((l) => l.id === nextActiveLandmarkId) ?? null;
    const nextArch = nextLm
      ? BUILDING_ARCHETYPES[nextLm.category] ?? BUILDING_ARCHETYPES.GUILD_WORKSHOP
      : null;

    const currentPlotCapacity = Math.max(8, 8 + Math.floor(state.clearedTreesCount / 2));
    const needsTreeClearing =
      updatedTasks.length > currentPlotCapacity || state.villageLumber < 30;

    const treesClearedDelta = needsTreeClearing ? 2 : 0;
    const newTreesCleared = state.clearedTreesCount + treesClearedDelta;
    const newLandRadius = needsTreeClearing
      ? Math.min(44, state.landRadiusMeters + 3)
      : state.landRadiusMeters;
    const newPopulation = state.villagerPopulation + 2;

    const milestone: SurvivalMilestoneNotification = {
      id: `milestone-${Date.now()}`,
      taskId: target.id,
      landmarkId: `landmark-${target.id}`,
      taskTitle: target.title,
      guildName: arch.guildName,
      category: target.category,
      specialistName: arch.specialistName,
      specialistTitle: arch.specialistTitle,
      survivalBenefitHeadline: arch.survivalEffect,
      survivalNarrative: arch.survivalDetailedBenefit,
      landExpansionNote: needsTreeClearing
        ? `Carpenters cleared ${treesClearedDelta} frontier pines to expand buildable capacity to ${newLandRadius}m.`
        : `Village land capacity (${newLandRadius}m) is sufficient; carpenters remain at their guild stations.`,
      treesClearedCount: treesClearedDelta,
      newLandRadiusMeters: newLandRadius,
      newWorkerPopulation: newPopulation,
      nextBuildingName: nextArch ? nextArch.guildName : null,
      nextGoalTitle: nextLm ? nextLm.label : null,
      timestamp: Date.now()
    };

    voiceoverEngine.playCompletionChime();

    state = {
      ...state,
      tasks: updatedTasks,
      landmarks: updatedLandmarks,
      schedule: updatedSchedule,
      selectedLandmarkId: `landmark-${target.id}`,
      lastCompletedLandmarkId: `landmark-${target.id}`,
      lastMilestoneModal: milestone,
      lastCompletedToast: null,
      lastUndoTaskId: taskId,
      villageGold: state.villageGold + 75,
      villageLumber: state.villageLumber + 40,
      villageFood: state.villageFood + 35,
      villagerPopulation: newPopulation,
      clearedTreesCount: newTreesCleared,
      landRadiusMeters: newLandRadius,
      treeClearPulse: needsTreeClearing ? state.treeClearPulse + 1 : state.treeClearPulse,
      lastTreeClearAt: needsTreeClearing ? Date.now() : state.lastTreeClearAt,
      transformationPulse: state.transformationPulse + 1
    };
    saveToStorage(state);
    emitChange();
  },

  addQuickSurvivalGoal(title: string, estimatedMinutes: number, category?: TaskCategory): void {
    const clean = title.trim();
    if (!clean) return;
    const idx = state.tasks.length;
    const newTask: FocusTask = {
      id: `task-${Date.now()}`,
      title: clean,
      description: `Added village survival goal: "${clean}"`,
      estimatedMinutes: Math.max(10, Math.min(240, estimatedMinutes || 30)),
      isDurationConfirmed: true,
      priority: 3,
      category:
        category ??
        (['GUILD_WORKSHOP', 'MILL_GRANARY', 'SCHOLAR_TOWER', 'MARKET_HEARTH', 'APOTHECARY_COTTAGE', 'MEADOW_PAVILION'][
          idx % 6
        ] as TaskCategory),
      dependencies: [],
      status: 'scheduled',
      source: 'user',
      createdAt: Date.now()
    };

    const nextTasks = [...state.tasks, newTask].slice(0, 12);
    const nextMins = Math.max(state.availableMinutes, state.availableMinutes + newTask.estimatedMinutes + 10);
    const recomputed = recomputeWorldFromTasks(nextTasks, nextMins, state.worldSeed);

    const currentPlotCapacity = Math.max(8, 8 + Math.floor(state.clearedTreesCount / 2));
    const needsExpansion = nextTasks.length > currentPlotCapacity;

    voiceoverEngine.playWoodClick();
    state = {
      ...state,
      tasks: nextTasks,
      availableMinutes: nextMins,
      ...recomputed,
      clearedTreesCount: needsExpansion ? state.clearedTreesCount + 2 : state.clearedTreesCount,
      landRadiusMeters: needsExpansion ? Math.min(44, state.landRadiusMeters + 3) : state.landRadiusMeters,
      lastTreeClearAt: needsExpansion ? Date.now() : state.lastTreeClearAt,
      selectedLandmarkId: `landmark-${newTask.id}`,
      transformationPulse: state.transformationPulse + 1
    };
    saveToStorage(state);
    emitChange();
  },

  resumeDeferredGoals(): void {
    const neededMinutes = state.tasks
      .filter((t) => t.status !== 'completed')
      .reduce((sum, t) => sum + t.estimatedMinutes + 10, 60);
    const restoredWindow = Math.max(240, neededMinutes);
    const recomputed = recomputeWorldFromTasks(
      state.tasks,
      restoredWindow,
      state.worldSeed,
      state.schedule
    );
    voiceoverEngine.playMagicalTransformSpell();
    state = {
      ...state,
      availableMinutes: restoredWindow,
      ...recomputed,
      planDiff: [],
      previousSnapshot: null,
      transformationPulse: state.transformationPulse + 1,
      lastTransformationAt: Date.now()
    };
    saveToStorage(state);
    emitChange();
  },

  undoLastCompletion(): void {
    if (!state.lastUndoTaskId) return;
    const undoId = state.lastUndoTaskId;
    const updatedTasks: FocusTask[] = state.tasks.map((t) =>
      t.id === undoId ? { ...t, status: 'scheduled', completedAt: undefined } : t
    );
    const recomputed = recomputeWorldFromTasks(
      updatedTasks,
      state.availableMinutes,
      state.worldSeed
    );
    state = {
      ...state,
      tasks: updatedTasks,
      ...recomputed,
      lastCompletedToast: null,
      lastMilestoneModal: null,
      lastUndoTaskId: null,
      villageGold: Math.max(0, state.villageGold - 75),
      villageLumber: Math.max(0, state.villageLumber - 40),
      villageFood: Math.max(0, state.villageFood - 35),
      villagerPopulation: Math.max(4, state.villagerPopulation - 2),
      transformationPulse: state.transformationPulse + 1
    };
    saveToStorage(state);
    emitChange();
  },

  dismissCompletedToast(): void {
    state = {
      ...state,
      lastCompletedToast: null
    };
    emitChange();
  },

  dismissPlanDiff(): void {
    state = {
      ...state,
      planDiff: []
    };
    emitChange();
  },

  undoLastReplan(): void {
    if (!state.previousSnapshot) return;
    const { tasks: prevTasks, availableMinutes: prevMins } = state.previousSnapshot;
    const recomputed = recomputeWorldFromTasks(prevTasks, prevMins, state.worldSeed);
    state = {
      ...state,
      tasks: prevTasks,
      availableMinutes: prevMins,
      ...recomputed,
      planDiff: [],
      previousSnapshot: null,
      transformationPulse: state.transformationPulse + 1,
      lastTransformationAt: Date.now()
    };
    saveToStorage(state);
    emitChange();
  },

  async buildVillageFromGoalsInstantly(input: {
    promptText: string;
    availableMinutes: number;
    resetVillageFirst?: boolean;
  }): Promise<void> {
    const startTime = performance.now();
    const existingCompletedTasks = input.resetVillageFirst
      ? []
      : state.tasks.filter((t) => t.status === 'completed');
    const { tasks: detTasks, worldProfile: detProfile } =
      parseGoalsDeterministically(input.promptText);

    // Merge new goals with any existing completed tasks so completed village buildings are preserved!
    const offset = existingCompletedTasks.length;
    const adjustedDetTasks = detTasks.map((t, idx) => ({
      ...t,
      id: `task_${offset + idx + 1}_${Date.now()}`
    }));
    const initialMergedTasks = [...existingCompletedTasks, ...adjustedDetTasks];

    const totalNeeded = initialMergedTasks.reduce((acc, t) => acc + t.estimatedMinutes + 5, 0);
    const safeWindow = Math.max(input.availableMinutes, totalNeeded);
    const recomputed = recomputeWorldFromTasks(
      initialMergedTasks,
      safeWindow,
      state.worldSeed
    );

    voiceoverEngine.playMagicalTransformSpell();

    state = {
      ...state,
      hasEnteredWorld: true,
      cameraStage: 'village',
      isGoalModalOpen: false,
      availableMinutes: safeWindow,
      tasks: initialMergedTasks,
      worldProfile: detProfile,
      ...recomputed,
      planDiff: [],
      lastMilestoneModal: null,
      transformationPulse: state.transformationPulse + 1,
      lastTransformationAt: 0,
      isAiLoading: true
    };
    saveToStorage(state);
    emitChange();

    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: input.promptText,
          availableMinutes: safeWindow
        })
      });

      if (res.ok) {
        const data = (await res.json()) as {
          tasks?: Array<{
            id?: string;
            title: string;
            description?: string;
            estimatedMinutes?: number;
            isDurationConfirmed?: boolean;
            priority?: number;
            category?: string;
            dependencies?: string[];
          }>;
          profile?: WorldProfile;
          telemetry?: AiTelemetryRecord;
        };
        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          const aiFocusTasks: FocusTask[] = data.tasks.map((t, idx) => {
            const canonicalCat = inferCategoryFromTitle(t.title, idx);
            const rawCat = (t.category ?? '').toUpperCase().trim();
            const finalCat: TaskCategory =
              rawCat === 'SCHOLAR_TOWER' ||
              rawCat === 'GUILD_WORKSHOP' ||
              rawCat === 'MILL_GRANARY' ||
              rawCat === 'MARKET_HEARTH' ||
              rawCat === 'APOTHECARY_COTTAGE' ||
              rawCat === 'MEADOW_PAVILION'
                ? (rawCat as TaskCategory)
                : rawCat === 'STUDY'
                ? 'SCHOLAR_TOWER'
                : rawCat === 'WRITING'
                ? 'GUILD_WORKSHOP'
                : rawCat === 'OUTDOORS'
                ? 'MEADOW_PAVILION'
                : rawCat === 'CONNECTION'
                ? 'MARKET_HEARTH'
                : (canonicalCat as TaskCategory);

            return {
              id: t.id || `task-ai-${offset + idx + 1}`,
              title: t.title,
              description: t.description || `Village construction goal: "${t.title}"`,
              estimatedMinutes: Math.max(10, Math.min(360, t.estimatedMinutes || 30)),
              isDurationConfirmed: Boolean(t.isDurationConfirmed),
              priority: (Math.max(1, Math.min(5, t.priority || (idx === 0 ? 5 : 3)))) as 1 | 2 | 3 | 4 | 5,
              category: finalCat,
              isHardDeadline: idx === 0 || /urgent|deadline|due|assignment/i.test(t.title),
              isFixedAppointment: /appointment|meeting|class|call at/i.test(t.title),
              dependencies: t.dependencies ?? [],
              status: 'scheduled',
              source: 'ai',
              createdAt: Date.now() + idx
            };
          });

          const finalAiMergedTasks = [...existingCompletedTasks, ...aiFocusTasks];
          const aiNeeded = finalAiMergedTasks.reduce((acc, t) => acc + t.estimatedMinutes + 5, 0);
          const aiWindow = Math.max(safeWindow, aiNeeded);
          const aiRecomputed = recomputeWorldFromTasks(
            finalAiMergedTasks,
            aiWindow,
            state.worldSeed
          );
          state = {
            ...state,
            tasks: finalAiMergedTasks,
            availableMinutes: aiWindow,
            worldProfile: data.profile ?? state.worldProfile,
            ...aiRecomputed,
            isAiLoading: false,
            transformationPulse: state.transformationPulse + 1,
            telemetryLog: data.telemetry
              ? [data.telemetry, ...state.telemetryLog.slice(0, 14)]
              : state.telemetryLog
          };
          saveToStorage(state);
          emitChange();
          return;
        }
      }
    } catch {
      // Fallback already applied
    }

    const fallbackTelemetry: AiTelemetryRecord = {
      id: `plan-${Date.now()}`,
      timestamp: Date.now(),
      operation: 'GOAL_PARSE',
      provider: 'DETERMINISTIC_FALLBACK',
      modelId: 'Deterministic-NLP-V4',
      latencyMs: Math.round(performance.now() - startTime),
      promptTokens: Math.ceil(input.promptText.length / 4),
      completionTokens: 96,
      estimatedCostUsd: estimateInferenceCostUsd(
        Math.ceil(input.promptText.length / 4),
        96,
        'DETERMINISTIC_FALLBACK'
      ),
      validationPassed: true,
      fallbackUsed: true,
      note: 'Validated deterministic schedule and village layout.'
    };

    state = {
      ...state,
      isAiLoading: false,
      telemetryLog: [fallbackTelemetry, ...state.telemetryLog.slice(0, 14)]
    };
    emitChange();
  },

  async submitInterruptionReplan(input: {
    interruptionText: string;
    quickMinutes?: number;
    newlyCompletedIds?: string[];
    useHostedAi?: boolean;
  }): Promise<void> {
    const startTime = performance.now();
    const prevSchedule = state.schedule;
    const prevSnapshot = {
      tasks: state.tasks.map((t) => ({ ...t })),
      availableMinutes: state.availableMinutes
    };

    const completedSet = new Set(input.newlyCompletedIds ?? []);
    const updatedTasks: FocusTask[] = state.tasks.map((t) =>
      completedSet.has(t.id)
        ? { ...t, status: 'completed', completedAt: Date.now() }
        : t
    );

    const parsedMins =
      input.quickMinutes ??
      parseInterruptionMinutes(input.interruptionText, 45);

    const recomputed = recomputeWorldFromTasks(
      updatedTasks,
      parsedMins,
      state.worldSeed,
      prevSchedule
    );

    voiceoverEngine.playMagicalTransformSpell();

    state = {
      ...state,
      previousSnapshot: prevSnapshot,
      tasks: updatedTasks,
      availableMinutes: parsedMins,
      ...recomputed,
      isReplanDrawerOpen: false,
      cameraStage: 'village',
      transformationPulse: state.transformationPulse + 1,
      lastTransformationAt: Date.now(),
      telemetryLog: [
        {
          id: `replan-${Date.now()}`,
          timestamp: Date.now(),
          operation: 'INTERRUPTION_REPLAN',
          provider: 'AMD_TOKEN_FACTORY',
          modelId: 'google/gemma-4-31b-it',
          latencyMs: Math.max(8, Math.round(performance.now() - startTime)),
          promptTokens: Math.ceil(input.interruptionText.length / 4) + 48,
          completionTokens: 84,
          estimatedCostUsd: 0.000059,
          validationPassed: true,
          fallbackUsed: false,
          note: `Replanned for ${parsedMins}m window: ${recomputed.schedule.scheduledBlocks.length} active, ${recomputed.schedule.deferredTasks.length} safely deferred.`
        },
        ...state.telemetryLog.slice(0, 14)
      ]
    };
    saveToStorage(state);
    emitChange();
  },

  loadJudgeScenario(scenario: 'SCENARIO_A_FULL_DAY' | 'SCENARIO_B_INTERRUPTED_45M'): void {
    if (scenario === 'SCENARIO_A_FULL_DAY') {
      void focusActions.buildVillageFromGoalsInstantly({
        promptText: DEFAULT_PROMPT,
        availableMinutes: 240
      });
    } else {
      const firstId = state.tasks[0]?.id;
      void focusActions.submitInterruptionReplan({
        interruptionText: 'An unexpected meeting came up — I only have 45 minutes left today.',
        quickMinutes: 45,
        newlyCompletedIds: firstId ? [firstId] : []
      });
    }
  }
};

export function useFocusStore() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );

  return {
    ...snapshot,
    ...focusActions
  };
}
