import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIOS } from '@/presets/demoScenarios';
import { generateWorldModel } from '@/core/pcg/worldGenerator';
import {
  checkGraphConnectivity,
  findShortestPathAStar
} from '@/core/pathfinding/astar';
import { SANCTUARY_GATE_NODE_ID } from '@/core/pathfinding/graphBuilder';

describe('Phase 2 — Navigation Graph & A* Pathfinding Engine', () => {
  const scenarioA = DEMO_SCENARIOS.SCENARIO_A_STUDY_DAY;
  const scenarioB = DEMO_SCENARIOS.SCENARIO_B_INTERRUPTED_45M;

  it('verifies 100% BFS reachability from Sanctuary Gate to all task landmarks', () => {
    const model = generateWorldModel({
      worldSeed: scenarioA.worldSeed,
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });

    const connectivity = checkGraphConnectivity(
      model.pathNodes,
      model.pathEdges,
      SANCTUARY_GATE_NODE_ID
    );

    expect(connectivity.isConnected).toBe(true);
    expect(connectivity.unreachableLandmarkNodeIds).toHaveLength(0);
  });

  it('finds a valid A* shortest path from the Sanctuary Gate to every landmark', () => {
    const model = generateWorldModel({
      worldSeed: scenarioA.worldSeed,
      profile: scenarioA.profile,
      tasks: scenarioA.tasks
    });

    for (const lm of model.landmarks) {
      const targetNodeId = `node-${lm.id}`;
      const path = findShortestPathAStar(
        model.pathNodes,
        model.pathEdges,
        SANCTUARY_GATE_NODE_ID,
        targetNodeId
      );

      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0]).toBe(SANCTUARY_GATE_NODE_ID);
      expect(path[path.length - 1]).toBe(targetNodeId);
    }
  });

  it('updates the active route and marks deferred side-trails in Scenario B (45m Interrupted Day)', () => {
    const modelB = generateWorldModel({
      worldSeed: scenarioB.worldSeed,
      profile: scenarioB.profile,
      tasks: scenarioB.tasks
    });

    const activeEdges = modelB.pathEdges.filter((e) => e.isActiveRoute);
    const completedEdges = modelB.pathEdges.filter((e) => e.isCompletedSegment);
    const deferredEdges = modelB.pathEdges.filter((e) => e.isDeferredTrail);

    expect(activeEdges.length).toBeGreaterThan(0);
    expect(completedEdges.length).toBeGreaterThan(0);
    expect(deferredEdges.length).toBeGreaterThan(0);
  });
});
