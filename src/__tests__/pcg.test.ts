import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIOS } from '@/presets/demoScenarios';
import {
  applyTaskStateToWorldModel,
  generateWorldModel
} from '@/core/pcg/worldGenerator';
import { createIsolatedStreams } from '@/core/pcg/prng';

describe('Phase 2 — Seeded Procedural Content Generation (PCG) Engine', () => {
  const scenarioA = DEMO_SCENARIOS.SCENARIO_A_STUDY_DAY;

  it('produces identical world models given the same seed, profile, and tasks', () => {
    const world1 = generateWorldModel({
      worldSeed: 'focus-test-seed-reproducible',
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });
    const world2 = generateWorldModel({
      worldSeed: 'focus-test-seed-reproducible',
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });

    expect(world1.landmarks).toEqual(world2.landmarks);
    expect(world1.decorations).toEqual(world2.decorations);
    expect(world1.activeRouteNodeIds).toEqual(world2.activeRouteNodeIds);
  });

  it('produces meaningfully diverse landmark placements across different seeds while remaining valid', () => {
    const worldAlpha = generateWorldModel({
      worldSeed: 'focus-sanctuary-seed-2026-alpha',
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });
    const worldLotus = generateWorldModel({
      worldSeed: 'focus-sanctuary-seed-2026-lotus',
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });

    expect(worldAlpha.validation.isValid).toBe(true);
    expect(worldLotus.validation.isValid).toBe(true);
    expect(worldAlpha.landmarks[0].position).not.toEqual(
      worldLotus.landmarks[0].position
    );
  });

  it('passes all JAHAN spatial validity assertions (no overlap, connected graph, clear markers)', () => {
    const seeds = [
      'focus-sanctuary-seed-2026-alpha',
      'focus-sanctuary-seed-2026-lotus',
      'focus-sanctuary-seed-2026-cypress',
      'focus-sanctuary-seed-2026-aurora'
    ];

    for (const seed of seeds) {
      const model = generateWorldModel({
        worldSeed: seed,
        profile: scenarioA.profile,
        tasks: scenarioA.tasks
      });
      expect(model.validation.noLandmarkOverlap).toBe(true);
      expect(model.validation.graphConnected).toBe(true);
      expect(model.validation.markerClearanceValid).toBe(true);
      expect(model.validation.isValid).toBe(true);
    }
  });

  it('preserves exact landmark coordinates and decorations when a task is completed (state-driven evolution without rerolling)', () => {
    const baseWorld = generateWorldModel({
      worldSeed: scenarioA.worldSeed,
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });

    const completedTasks = scenarioA.tasks.map((t, idx) =>
      idx === 0 ? { ...t, status: 'completed' as const } : t
    );

    const evolvedWorld = applyTaskStateToWorldModel(baseWorld, completedTasks);

    // Coordinates of every landmark and decoration must remain 100% invariant
    expect(evolvedWorld.landmarks.map((l) => l.position)).toEqual(
      baseWorld.landmarks.map((l) => l.position)
    );
    expect(evolvedWorld.decorations).toEqual(baseWorld.decorations);

    // Only Landmark 0 transitions to growthStage 2, and Landmark 1 becomes Next Step
    expect(evolvedWorld.landmarks[0].growthStage).toBe(2);
    expect(evolvedWorld.landmarks[0].isCompleted).toBe(true);
    expect(evolvedWorld.landmarks[1].isNextStep).toBe(true);
  });

  it('maintains isolated PRNG streams so drawing from terrain never alters landmark stream', () => {
    const streamsA = createIsolatedStreams('seed-isolation-check');
    const streamsB = createIsolatedStreams('seed-isolation-check');

    // Draw 50 random numbers from streamsA.terrain
    for (let i = 0; i < 50; i++) {
      streamsA.terrain();
    }

    // Landmark stream must still match identically
    expect(streamsA.landmarks()).toBe(streamsB.landmarks());
    expect(streamsA.decorations()).toBe(streamsB.decorations());
  });
});
