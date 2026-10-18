import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIOS } from '@/presets/demoScenarios';
import { validateAndNormalizeTasks } from '@/schemas/taskSchemas';
import { validateAndResolveTaskDag } from '@/core/planner/dagValidator';
import { computeDeterministicSchedule } from '@/core/planner/scheduleEngine';
import {
  parseLocalInterruptionConstraint,
  replanAfterInterruption
} from '@/core/planner/replanEngine';
import type { TaskItem } from '@/types/task';

describe('Phase 3 — Deterministic Planning & Interruption-Replanning Engine', () => {
  const scenarioATasks = DEMO_SCENARIOS.SCENARIO_A_STUDY_DAY.tasks;

  it('normalizes task durations to sanity bounds and strips nonexistent dependency IDs', () => {
    const raw = [
      {
        id: 't1',
        title: 'Quick review',
        estimatedMinutes: 1, // Should clamp to minimum 5m
        priority: 9, // Should clamp to max 5
        dependencies: ['t1', 'non-existent-id']
      }
    ];

    const { tasks, warnings } = validateAndNormalizeTasks(raw);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].estimatedMinutes).toBe(5);
    expect(tasks[0].priority).toBe(5);
    expect(tasks[0].dependencies).toEqual([]);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('detects and deterministically breaks circular dependency cycles (A <-> B)', () => {
    const cyclicTasks: TaskItem[] = [
      {
        id: 'task-a',
        title: 'Task A',
        estimatedMinutes: 30,
        isDurationConfirmed: true,
        priority: 5,
        dependencies: ['task-b'],
        category: 'STUDY',
        status: 'pending',
        source: 'user',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      },
      {
        id: 'task-b',
        title: 'Task B',
        estimatedMinutes: 30,
        isDurationConfirmed: true,
        priority: 2,
        dependencies: ['task-a'],
        category: 'WRITING',
        status: 'pending',
        source: 'user',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      }
    ];

    const dagResult = validateAndResolveTaskDag(cyclicTasks);
    expect(dagResult.hadCycle).toBe(true);
    expect(dagResult.removedEdges).toHaveLength(1);
    // Lower-priority Task B has its back-edge broken so Task A runs first
    expect(dagResult.topologicalOrder).toEqual(['task-a', 'task-b']);
  });

  it('schedules Scenario A (210m budget) respecting prerequisites, deadlines, and 5m buffers', () => {
    const result = computeDeterministicSchedule({
      tasks: scenarioATasks,
      availableMinutes: 210
    });

    expect(result.effectiveBufferMinutes).toBe(5);
    expect(result.slots).toHaveLength(4);

    // 1st slot: Study (0..60) because Assignment depends on it
    expect(result.slots[0].taskId).toBe('task-study-1h');
    expect(result.slots[0].startMinuteOffset).toBe(0);
    expect(result.slots[0].endMinuteOffset).toBe(60);
    expect(result.slots[0].rationaleCode).toBe('PREREQUISITE_FOR_OTHER');

    // 2nd slot: Finish Assignment (65..110) after 5m buffer
    expect(result.slots[1].taskId).toBe('task-finish-assignment');
    expect(result.slots[1].startMinuteOffset).toBe(65);
    expect(result.slots[1].endMinuteOffset).toBe(110);

    // Total scheduled minutes = 60 + 45 + 30 + 20 = 155m
    expect(result.scheduledMinutesTotal).toBe(155);
  });

  it('locks fixed-slot appointments first and schedules flexible tasks around them', () => {
    const tasksWithAppointment: TaskItem[] = [
      {
        id: 'flex-study',
        title: 'Deep study block',
        estimatedMinutes: 45,
        isDurationConfirmed: true,
        priority: 5,
        dependencies: [],
        category: 'STUDY',
        status: 'pending',
        source: 'user',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      },
      {
        id: 'fixed-dentist',
        title: 'Advisor check-in call',
        estimatedMinutes: 30,
        isDurationConfirmed: true,
        priority: 4,
        dependencies: [],
        fixedSlot: {
          startMinuteOffset: 0,
          endMinuteOffset: 30,
          label: '10:00 AM Fixed Call'
        },
        category: 'CONNECTION',
        status: 'pending',
        source: 'user',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      }
    ];

    const result = computeDeterministicSchedule({
      tasks: tasksWithAppointment,
      availableMinutes: 120
    });

    expect(result.slots[0].taskId).toBe('fixed-dentist');
    expect(result.slots[0].rationaleCode).toBe('FIXED_APPOINTMENT');
    expect(result.slots[1].taskId).toBe('flex-study');
    expect(result.slots[1].startMinuteOffset).toBe(35);
  });

  it('accurately replans for Scenario B (45m remaining after interruption), preserving completed work and explaining deferrals', () => {
    const replan = replanAfterInterruption({
      currentTasks: scenarioATasks,
      previousAvailableMinutes: 210,
      remainingMinutes: 45,
      newlyCompletedTaskIds: ['task-study-1h'],
      currentProfile: DEMO_SCENARIOS.SCENARIO_A_STUDY_DAY.profile
    });

    const byId = new Map(replan.updatedTasks.map((t) => [t.id, t]));

    // 1. Study is preserved as completed
    expect(byId.get('task-study-1h')?.status).toBe('completed');

    // 2. Assignment (45m) fits the exact 45m window (buffer compressed to 0m)
    expect(byId.get('task-finish-assignment')?.status).toBe('scheduled');
    expect(byId.get('task-finish-assignment')?.scheduledStartOffset).toBe(0);
    expect(byId.get('task-finish-assignment')?.scheduledEndOffset).toBe(45);

    // 3. Walk (30m) and Call (20m) are deferred with INSUFFICIENT_REMAINING_TIME
    expect(byId.get('task-walk-outdoors')?.status).toBe('deferred');
    expect(byId.get('task-walk-outdoors')?.deferralCode).toBe(
      'INSUFFICIENT_REMAINING_TIME'
    );
    expect(byId.get('task-call-friend')?.status).toBe('deferred');
    expect(byId.get('task-call-friend')?.deferralCode).toBe(
      'INSUFFICIENT_REMAINING_TIME'
    );
    // Verify estimated duration uncertainty is explicitly shown ("~20 min (est.)")
    expect(byId.get('task-call-friend')?.deferralText).toContain('~20 min (est.)');

    // 4. Snapshot and diff are generated for single-click Undo
    expect(replan.planDiff).toHaveLength(4);
    expect(replan.previousSnapshot.availableMinutes).toBe(210);
  });

  it('parses natural-language interruption time expressions deterministically', () => {
    expect(
      parseLocalInterruptionConstraint('I only have 45 minutes left now')
    ).toEqual({
      remainingMinutes: 45,
      parsedFromText: true
    });

    expect(
      parseLocalInterruptionConstraint('An appointment came up, 1.5 hours left')
    ).toEqual({
      remainingMinutes: 90,
      parsedFromText: true
    });

    expect(
      parseLocalInterruptionConstraint('Only half an hour remaining today')
    ).toEqual({
      remainingMinutes: 30,
      parsedFromText: true
    });
  });
});
