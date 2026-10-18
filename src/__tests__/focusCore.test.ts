import { test, assert } from 'vitest';
import {
  buildDeterministicSchedule,
  computePlanDiff,
  detectDependencyCycle
} from '../core/planner/scheduleEngine';
import {
  findShortestPathAStar,
  verifyGraphConnectivity
} from '../core/pathfinding/astar';
import { SeededRandom, groundHeightAt } from '../core/pcg/prng';
import {
  clampPointOutOfRiver,
  evaluateCarpenterState,
  generateValidatedVillageWorld,
  isPointInRiverWater,
  riverCenterXAtZ,
  shouldSpawnPlotWoodPile
} from '../core/pcg/worldGenerator';
import {
  parseGoalsDeterministically,
  parseInterruptionMinutes
} from '../core/ai/heuristicFallback';
import type { FocusTask } from '../types/focus';

test('SeededRandom produces deterministic sequences for identical seeds', () => {
  const rngA = new SeededRandom(20261017);
  const rngB = new SeededRandom(20261017);
  const seqA = [rngA.next(), rngA.next(), rngA.next()];
  const seqB = [rngB.next(), rngB.next(), rngB.next()];
  assert.deepEqual(seqA, seqB);
  assert.equal(groundHeightAt(0, 0, 20261017), 0);
  assert.equal(groundHeightAt(0, 28, 20261017), 0);
});

test('detectDependencyCycle identifies circular dependencies and passes valid DAGs', () => {
  const validTasks: FocusTask[] = [
    {
      id: 't1',
      title: 'Draft Outline',
      estimatedMinutes: 30,
      isDurationConfirmed: true,
      priority: 5,
      category: 'SCHOLAR_TOWER',
      dependencies: [],
      status: 'scheduled',
      source: 'user',
      createdAt: 1
    },
    {
      id: 't2',
      title: 'Write Final Essay',
      estimatedMinutes: 45,
      isDurationConfirmed: true,
      priority: 4,
      category: 'GUILD_WORKSHOP',
      dependencies: ['t1'],
      status: 'scheduled',
      source: 'user',
      createdAt: 2
    }
  ];
  assert.equal(detectDependencyCycle(validTasks).hasCycle, false);

  const cyclicTasks: FocusTask[] = [
    { ...validTasks[0], dependencies: ['t2'] },
    { ...validTasks[1], dependencies: ['t1'] }
  ];
  assert.equal(detectDependencyCycle(cyclicTasks).hasCycle, true);
});

test('buildDeterministicSchedule schedules feasible tasks and defers excess tasks on 45-minute interruption', () => {
  const { tasks } = parseGoalsDeterministically(
    'Study for an hour, finish my assignment for 35 minutes, go for a walk for 25 minutes, and call my friend for 20 minutes'
  );
  assert.equal(tasks.length, 4);

  const fullPlan = buildDeterministicSchedule(tasks, 180);
  assert.equal(fullPlan.scheduledBlocks.length, 4);
  assert.equal(fullPlan.deferredTasks.length, 0);
  assert.ok(fullPlan.nextStepTaskId);

  const replan45 = buildDeterministicSchedule(tasks, 45);
  assert.ok(replan45.scheduledBlocks.length >= 1);
  assert.ok(replan45.totalScheduledMinutes <= 45);
  assert.ok(replan45.deferredTasks.length >= 2);
  assert.equal(replan45.deferredTasks[0].reasonCode, 'INSUFFICIENT_TIME');

  const diffs = computePlanDiff(fullPlan, replan45, tasks);
  assert.ok(diffs.length >= 2);
});

test('generateValidatedVillageWorld places river at eastern boundary and keeps all village plots & paths out of water', () => {
  const { tasks } = parseGoalsDeterministically(
    'Study for 45 minutes, build prototype for 40 minutes, walk outside for 20 minutes'
  );
  const plan = buildDeterministicSchedule(tasks, 150);
  const worldBefore = generateValidatedVillageWorld(4242, tasks, plan);

  assert.equal(worldBefore.isConnected, true);
  assert.equal(worldBefore.landmarks.length, 3);

  // Verify the river flows along the eastern perimeter (x > 18), not splitting the village center (x = 0)
  for (const z of [-10, -4.5, 0, 6.5, 10]) {
    assert.ok(riverCenterXAtZ(z) > 18);
  }

  // Verify no landmark or path waypoint is inside river water
  for (const lm of worldBefore.landmarks) {
    assert.equal(isPointInRiverWater(lm.position[0], lm.position[2]), false);
  }
  for (const edge of worldBefore.edges) {
    for (const wp of edge.waypoints) {
      assert.equal(isPointInRiverWater(wp[0], wp[2]), false);
    }
  }

  // Verify clampPointOutOfRiver pushes a point in open water onto the dry bank, while allowing bridge crossings
  const riverMidAtZero = riverCenterXAtZ(0);
  assert.equal(isPointInRiverWater(riverMidAtZero, 0), true);
  const [clampedX, clampedZ] = clampPointOutOfRiver(riverMidAtZero, 0);
  assert.equal(isPointInRiverWater(clampedX, clampedZ), false);

  // At z = 6.5 (Lower Stone Bridge), crossing the river is dry/valid
  assert.equal(isPointInRiverWater(riverCenterXAtZ(6.5), 6.5), false);

  const updatedTasks: FocusTask[] = tasks.map((t, idx) =>
    idx === 0 ? { ...t, status: 'completed' } : t
  );
  const planAfter = buildDeterministicSchedule(updatedTasks, 150);
  const worldAfter = generateValidatedVillageWorld(4242, updatedTasks, planAfter);

  assert.deepEqual(
    worldBefore.landmarks[0].position,
    worldAfter.landmarks[0].position
  );
  assert.equal(worldAfter.landmarks[0].isCompleted, true);
  assert.equal(worldAfter.landmarks[0].growthStage, 3);
});

test('Carpenter AI state machine only chops wood when capacity or lumber is needed, and wood piles only spawn on active/selected plots', () => {
  // Sufficient capacity (6 tasks, 6 plot capacity, 90 lumber, 0 active clear timer) -> NOT chopping
  assert.equal(
    evaluateCarpenterState({
      totalTasksCount: 6,
      plotCapacity: 6,
      villageLumber: 90,
      activeTreeClearWindowMs: 0,
      hasActiveConstruction: true
    }),
    'ASSISTING_CONSTRUCTION'
  );

  // Capacity exceeded (8 tasks, 6 plot capacity) -> CHOPPING_FRONTIER_TREE
  assert.equal(
    evaluateCarpenterState({
      totalTasksCount: 8,
      plotCapacity: 6,
      villageLumber: 90,
      activeTreeClearWindowMs: 0,
      hasActiveConstruction: true
    }),
    'CHOPPING_FRONTIER_TREE'
  );

  // Dynamic wood piles only spawn on active next-step or explicitly selected plots
  assert.equal(
    shouldSpawnPlotWoodPile(
      { id: 'lm-1', isCompleted: false, isNextStep: false, isDeferred: false },
      'lm-other'
    ),
    false
  );
  assert.equal(
    shouldSpawnPlotWoodPile(
      { id: 'lm-1', isCompleted: false, isNextStep: false, isDeferred: false },
      'lm-1'
    ),
    true
  );
  assert.equal(
    shouldSpawnPlotWoodPile(
      { id: 'lm-1', isCompleted: false, isNextStep: true, isDeferred: false },
      null
    ),
    true
  );
  assert.equal(
    shouldSpawnPlotWoodPile(
      { id: 'lm-1', isCompleted: true, isNextStep: false, isDeferred: false },
      'lm-1'
    ),
    false
  );
});

test('A* pathfinding finds shortest route across connected village nodes', () => {
  const nodes = [
    { id: 'hub', x: 0, z: 0 },
    { id: 'a', x: 2, z: 0 },
    { id: 'b', x: 5, z: 0 }
  ];
  const edges = [
    { from: 'hub', to: 'a', weight: 2 },
    { from: 'a', to: 'b', weight: 3 },
    { from: 'hub', to: 'b', weight: 9 }
  ];
  assert.equal(verifyGraphConnectivity(nodes, edges), true);
  const path = findShortestPathAStar(nodes, edges, 'hub', 'b');
  assert.deepEqual(path, ['hub', 'a', 'b']);
  assert.equal(
    parseInterruptionMinutes('My day got interrupted — I only have 45 minutes left now.'),
    45
  );
});
