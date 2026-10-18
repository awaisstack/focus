import { describe, expect, it } from 'vitest';
import { buildHeuristicPlanProposal } from '@/core/ai/heuristicFallback';
import { computeDeterministicSchedule } from '@/core/planner/scheduleEngine';
import { replanAfterInterruption } from '@/core/planner/replanEngine';
import {
  applyTaskStateToWorldModel,
  generateWorldModel
} from '@/core/pcg/worldGenerator';
import {
  parseSnapshotFromJson,
  serializeSnapshotToJson
} from '@/core/persistence/dbAdapter';
import { CURRENT_STORAGE_SCHEMA_VERSION } from '@/types/persistence';

describe('Phase 7 — End-to-End Sanctuary Journey Integration Test', () => {
  it('executes Goal Capture -> Deterministic Schedule -> PCG World -> Task Completion -> 45m Replan -> Snapshot Restore', () => {
    // 1. Goal Capture (Natural language decomposition)
    const proposal = buildHeuristicPlanProposal({
      promptText:
        'Study for an hour, finish my assignment, go for a walk, and call my friend.',
      availableMinutes: 210,
      preferredBiomeId: 'SUNLIT_GLADE'
    });

    expect(proposal.tasks).toHaveLength(4);
    expect(proposal.profile.biomeId).toBe('SUNLIT_GLADE');

    // 2. Confirm Proposals & Run Deterministic Scheduler (210m window)
    const initialSchedule = computeDeterministicSchedule({
      tasks: proposal.tasks.map((t) => ({ ...t, status: 'pending' as const })),
      availableMinutes: 210
    });

    expect(initialSchedule.slots).toHaveLength(4);
    expect(initialSchedule.tasks.every((t) => t.status === 'scheduled')).toBe(
      true
    );

    // 3. Generate Seeded 2.5D World Model & Verify PCG + A* Assertions
    const seed = 'focus-integration-seed-2026';
    const worldA = generateWorldModel({
      worldSeed: seed,
      profile: proposal.profile,
      tasks: initialSchedule.tasks
    });

    expect(worldA.validation.isValid).toBe(true);
    expect(worldA.landmarks).toHaveLength(4);
    expect(worldA.landmarks[0].isNextStep).toBe(true);

    // 4. Complete Task 1 ("Study for an hour") -> Verify Stage 2 Bloom & Coordinate Invariance
    const tasksAfterCompletion = initialSchedule.tasks.map((t, idx) =>
      idx === 0 ? { ...t, status: 'completed' as const } : t
    );

    const worldAfterCompletion = applyTaskStateToWorldModel(
      worldA,
      tasksAfterCompletion
    );

    expect(worldAfterCompletion.landmarks[0].growthStage).toBe(2);
    expect(worldAfterCompletion.landmarks[0].isCompleted).toBe(true);
    expect(worldAfterCompletion.landmarks[1].isNextStep).toBe(true);
    // Landmark positions must never reroll upon completion
    expect(worldAfterCompletion.landmarks.map((l) => l.position)).toEqual(
      worldA.landmarks.map((l) => l.position)
    );

    // 5. Interruption Replanning ("I only have 45 minutes left now")
    const replan = replanAfterInterruption({
      currentTasks: tasksAfterCompletion,
      previousAvailableMinutes: 210,
      remainingMinutes: 45,
      currentProfile: proposal.profile,
      interruptionNote: 'I only have 45 minutes left now.'
    });

    expect(replan.recommendedProfile.biomeId).toBe('MISTY_ZEN_STREAM');

    const worldB = applyTaskStateToWorldModel(
      worldAfterCompletion,
      replan.updatedTasks,
      replan.recommendedProfile
    );

    // Task 0 stays in bloom (Stage 2)
    expect(worldB.landmarks[0].growthStage).toBe(2);
    // Task 1 (45m Assignment) is the single active Next Step (Stage 1)
    expect(worldB.landmarks[1].isNextStep).toBe(true);
    expect(worldB.landmarks[1].growthStage).toBe(1);
    // Tasks 2 and 3 (Walk & Call) transition to resting state (Stage 0 / Deferred)
    expect(worldB.landmarks[2].isDeferred).toBe(true);
    expect(worldB.landmarks[2].growthStage).toBe(0);
    expect(worldB.landmarks[3].isDeferred).toBe(true);
    expect(worldB.landmarks[3].growthStage).toBe(0);

    // 6. Persist to Versioned JSON Snapshot & Restore
    const serialized = serializeSnapshotToJson({
      schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      activeScenarioId: 'SCENARIO_B_INTERRUPTED_45M',
      worldSeed: seed,
      availableMinutes: replan.remainingMinutes,
      profile: replan.recommendedProfile,
      tasks: replan.updatedTasks,
      planDiff: replan.planDiff,
      undoSnapshots: [replan.previousSnapshot],
      isAudioMuted: false,
      ambientVolume: 0.55,
      effectsVolume: 0.7,
      reducedMotion: false,
      telemetryHistory: []
    });

    const restored = parseSnapshotFromJson(serialized);
    expect(restored.snapshot).not.toBeNull();
    expect(restored.snapshot?.availableMinutes).toBe(45);
    expect(restored.snapshot?.tasks[0].status).toBe('completed');
    expect(restored.snapshot?.tasks[1].status).toBe('scheduled');
    expect(restored.snapshot?.tasks[2].status).toBe('deferred');
  });
});
