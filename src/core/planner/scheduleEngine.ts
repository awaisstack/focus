import type {
  DeferralReasonCode as LegacyDeferralReasonCode,
  ScheduleSlot,
  TaskItem
} from '@/types/task';
import {
  MAX_AVAILABLE_MINUTES,
  MIN_AVAILABLE_MINUTES,
  validateAndNormalizeTasks
} from '@/schemas/taskSchemas';
import {
  validateAndResolveTaskDag,
  type RemovedDependencyEdge
} from './dagValidator';
import { formatDurationLabel, scoreEligibleTask } from './priorityScorer';

export const DEFAULT_TRANSITION_BUFFER_MINUTES = 5;
export const COMPACT_WINDOW_THRESHOLD_MINUTES = 60;

interface FreeInterval {
  start: number;
  end: number;
}

export interface ScheduleResult {
  availableMinutes: number;
  effectiveBufferMinutes: number;
  scheduledMinutesTotal: number;
  unscheduledSlackMinutes: number;
  tasks: TaskItem[];
  slots: ScheduleSlot[];
  hadDependencyCycle: boolean;
  removedDependencyEdges: RemovedDependencyEdge[];
  validationWarnings: string[];
}

function subtractInterval(
  intervals: FreeInterval[],
  blockStart: number,
  blockEnd: number
): FreeInterval[] {
  const result: FreeInterval[] = [];
  for (const interval of intervals) {
    if (blockEnd <= interval.start || blockStart >= interval.end) {
      result.push(interval);
      continue;
    }
    if (blockStart > interval.start) {
      result.push({ start: interval.start, end: blockStart });
    }
    if (blockEnd < interval.end) {
      result.push({ start: blockEnd, end: interval.end });
    }
  }
  return result.filter((iv) => iv.end - iv.start > 0);
}

/**
 * Pure deterministic scheduling engine.
 * Preserves completed tasks, locks valid fixed appointments, enforces DAG dependencies,
 * allocates highest-scoring ready tasks into open intervals, and explains every deferral.
 */
export function computeDeterministicSchedule(params: {
  tasks: TaskItem[];
  availableMinutes: number;
  bufferMinutes?: number;
}): ScheduleResult {
  const clampedAvailable = Math.round(
    Math.min(
      MAX_AVAILABLE_MINUTES,
      Math.max(MIN_AVAILABLE_MINUTES, params.availableMinutes)
    )
  );

  // Adaptive buffer: compress transition buffer to 0m when window <= 60m (e.g., 45m replan)
  const effectiveBufferMinutes =
    params.bufferMinutes !== undefined
      ? params.bufferMinutes
      : clampedAvailable <= COMPACT_WINDOW_THRESHOLD_MINUTES
      ? 0
      : DEFAULT_TRANSITION_BUFFER_MINUTES;

  // 1. Validate & normalize input tasks
  const { tasks: normalizedTasks, warnings } = validateAndNormalizeTasks(
    params.tasks
  );

  // 2. Validate & resolve dependency DAG
  const dag = validateAndResolveTaskDag(normalizedTasks);
  const workingTasks = dag.tasks;
  const originalOrderIndex = new Map<string, number>(
    workingTasks.map((t, idx) => [t.id, idx])
  );
  const taskTitleById = new Map<string, string>(
    workingTasks.map((t) => [t.id, t.title])
  );

  // Track status and output fields per task ID
  const finalTaskMap = new Map<string, TaskItem>();
  const satisfiedTaskIds = new Set<string>();
  const completionMinuteByTaskId = new Map<string, number>();
  const slots: ScheduleSlot[] = [];

  // 3. Preserve already-completed and cancelled tasks untouched
  for (const task of workingTasks) {
    if (task.status === 'completed') {
      satisfiedTaskIds.add(task.id);
      completionMinuteByTaskId.set(task.id, 0);
      finalTaskMap.set(task.id, {
        ...task,
        deferralCode: undefined,
        deferralText: undefined,
        rationaleText:
          task.rationaleText ||
          'Completed earlier today — preserved in your sanctuary.'
      });
    } else if (task.status === 'cancelled') {
      finalTaskMap.set(task.id, { ...task });
    }
  }

  let freeIntervals: FreeInterval[] = [{ start: 0, end: clampedAvailable }];

  // 4. Reserve fixed time-slot commitments first
  const activeCandidates = workingTasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled'
  );

  const fixedTasks = activeCandidates
    .filter((t) => t.fixedSlot !== undefined)
    .sort(
      (a, b) =>
        a.fixedSlot!.startMinuteOffset - b.fixedSlot!.startMinuteOffset
    );

  for (const fixedTask of fixedTasks) {
    const slot = fixedTask.fixedSlot!;
    const slotDuration = slot.endMinuteOffset - slot.startMinuteOffset;

    if (slot.endMinuteOffset > clampedAvailable) {
      finalTaskMap.set(fixedTask.id, {
        ...fixedTask,
        status: 'deferred',
        scheduledStartOffset: undefined,
        scheduledEndOffset: undefined,
        deferralCode: 'INSUFFICIENT_REMAINING_TIME',
        deferralText: `Deferred: Fixed appointment (${slot.startMinuteOffset}m–${slot.endMinuteOffset}m) falls outside your ${clampedAvailable}-minute available window.`
      });
      continue;
    }

    const fitsInFreeInterval = freeIntervals.some(
      (iv) =>
        slot.startMinuteOffset >= iv.start && slot.endMinuteOffset <= iv.end
    );

    if (!fitsInFreeInterval) {
      finalTaskMap.set(fixedTask.id, {
        ...fixedTask,
        status: 'deferred',
        scheduledStartOffset: undefined,
        scheduledEndOffset: undefined,
        deferralCode: 'FIXED_SLOT_CONFLICT',
        deferralText: `Deferred: Fixed appointment (${slot.startMinuteOffset}m–${slot.endMinuteOffset}m) conflicts with another scheduled commitment.`
      });
      continue;
    }

    // Reserve interval (plus buffer if room remains)
    const blockEndWithBuffer = Math.min(
      clampedAvailable,
      slot.endMinuteOffset + effectiveBufferMinutes
    );
    freeIntervals = subtractInterval(
      freeIntervals,
      slot.startMinuteOffset,
      blockEndWithBuffer
    );

    const rationaleText = `Locked at ${slot.startMinuteOffset}m–${slot.endMinuteOffset}m (${slotDuration} min) because fixed appointments cannot move.`;

    slots.push({
      taskId: fixedTask.id,
      startMinuteOffset: slot.startMinuteOffset,
      endMinuteOffset: slot.endMinuteOffset,
      bufferMinutesAfter: blockEndWithBuffer - slot.endMinuteOffset,
      rationaleCode: 'FIXED_APPOINTMENT',
      rationaleText
    });

    satisfiedTaskIds.add(fixedTask.id);
    completionMinuteByTaskId.set(fixedTask.id, slot.endMinuteOffset);

    finalTaskMap.set(fixedTask.id, {
      ...fixedTask,
      status: 'scheduled',
      estimatedMinutes: slotDuration,
      scheduledStartOffset: slot.startMinuteOffset,
      scheduledEndOffset: slot.endMinuteOffset,
      rationaleCode: 'FIXED_APPOINTMENT',
      rationaleText,
      deferralCode: undefined,
      deferralText: undefined
    });
  }

  // 5. Iteratively schedule flexible tasks into free intervals
  const flexiblePool = activeCandidates.filter(
    (t) => t.fixedSlot === undefined && !finalTaskMap.has(t.id)
  );
  const scheduledFlexibleIds = new Set<string>();

  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    // Identify tasks whose dependencies are all satisfied
    const readyTasks = flexiblePool.filter(
      (t) =>
        !scheduledFlexibleIds.has(t.id) &&
        t.dependencies.every((depId) => satisfiedTaskIds.has(depId))
    );

    if (readyTasks.length === 0 || freeIntervals.length === 0) {
      break;
    }

    // Evaluate each ready task against the earliest valid interval after its prerequisites finish
    const candidatePlacements: Array<{
      task: TaskItem;
      intervalIndex: number;
      startMinute: number;
      endMinute: number;
      score: number;
      rationaleCode: ScheduleSlot['rationaleCode'];
      rationaleText: string;
    }> = [];

    for (const task of readyTasks) {
      const earliestAllowedStart = task.dependencies.reduce(
        (maxEnd, depId) =>
          Math.max(maxEnd, completionMinuteByTaskId.get(depId) ?? 0),
        0
      );

      for (let ivIdx = 0; ivIdx < freeIntervals.length; ivIdx++) {
        const iv = freeIntervals[ivIdx];
        const candidateStart = Math.max(iv.start, earliestAllowedStart);
        const candidateEnd = candidateStart + task.estimatedMinutes;

        if (candidateEnd <= iv.end) {
          // Check hard deadline feasibility if specified
          if (
            task.hardDeadlineOffsetMinutes !== undefined &&
            candidateEnd > task.hardDeadlineOffsetMinutes
          ) {
            continue;
          }

          const scoreBreakdown = scoreEligibleTask({
            task,
            currentMinuteOffset: candidateStart,
            intervalRemainingMinutes: iv.end - candidateStart,
            totalAvailableMinutes: clampedAvailable,
            dependentCount: dag.dependentCounts.get(task.id) ?? 0,
            taskTitleById
          });

          candidatePlacements.push({
            task,
            intervalIndex: ivIdx,
            startMinute: candidateStart,
            endMinute: candidateEnd,
            score: scoreBreakdown.totalScore,
            rationaleCode: scoreBreakdown.rationaleCode,
            rationaleText: scoreBreakdown.rationaleText
          });
          break; // Earliest valid interval for this task found
        }
      }
    }

    if (candidatePlacements.length === 0) {
      break;
    }

    // Sort by earliest start minute first, then highest composite score, then original list order
    candidatePlacements.sort((a, b) => {
      if (a.startMinute !== b.startMinute) {
        return a.startMinute - b.startMinute;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (
        (originalOrderIndex.get(a.task.id) ?? 0) -
        (originalOrderIndex.get(b.task.id) ?? 0)
      );
    });

    const winner = candidatePlacements[0];
    const blockEndWithBuffer = Math.min(
      clampedAvailable,
      winner.endMinute + effectiveBufferMinutes
    );

    freeIntervals = subtractInterval(
      freeIntervals,
      winner.startMinute,
      blockEndWithBuffer
    );

    scheduledFlexibleIds.add(winner.task.id);
    satisfiedTaskIds.add(winner.task.id);
    completionMinuteByTaskId.set(winner.task.id, blockEndWithBuffer);

    slots.push({
      taskId: winner.task.id,
      startMinuteOffset: winner.startMinute,
      endMinuteOffset: winner.endMinute,
      bufferMinutesAfter: blockEndWithBuffer - winner.endMinute,
      rationaleCode: winner.rationaleCode,
      rationaleText: winner.rationaleText
    });

    finalTaskMap.set(winner.task.id, {
      ...winner.task,
      status: 'scheduled',
      scheduledStartOffset: winner.startMinute,
      scheduledEndOffset: winner.endMinute,
      rationaleCode: winner.rationaleCode,
      rationaleText: winner.rationaleText,
      deferralCode: undefined,
      deferralText: undefined
    });

    madeProgress = true;
  }

  // 6. Assign honest, specific deferral reasons to any task that could not be scheduled
  const remainingMinutesTotal = freeIntervals.reduce(
    (sum, iv) => sum + (iv.end - iv.start),
    0
  );

  for (const task of flexiblePool) {
    if (scheduledFlexibleIds.has(task.id)) continue;

    const unmetDeps = task.dependencies.filter(
      (depId) => !satisfiedTaskIds.has(depId)
    );
    const durationPhrase = formatDurationLabel(task);

    let deferralCode: LegacyDeferralReasonCode = 'INSUFFICIENT_REMAINING_TIME';
    let deferralText = `Deferred: requires ${durationPhrase}, and only ${remainingMinutesTotal} min remain in today’s ${clampedAvailable}-minute budget.`;

    if (unmetDeps.length > 0) {
      const unmetTitle = taskTitleById.get(unmetDeps[0]) ?? unmetDeps[0];
      deferralCode = 'DEPENDENCY_DEFERRED';
      deferralText = `Deferred because prerequisite "${unmetTitle}" could not be completed in the remaining window.`;
    } else if (task.estimatedMinutes > clampedAvailable) {
      deferralCode = 'EXCEEDS_DAILY_BUDGET';
      deferralText = `Deferred: ${durationPhrase} exceeds your total ${clampedAvailable}-minute window.`;
    } else if (
      task.hardDeadlineOffsetMinutes !== undefined &&
      task.hardDeadlineOffsetMinutes < task.estimatedMinutes
    ) {
      deferralCode = 'INSUFFICIENT_REMAINING_TIME';
      deferralText = `Deferred: requires ${durationPhrase}, which cannot finish before the ${task.hardDeadlineOffsetMinutes}-minute deadline.`;
    }

    finalTaskMap.set(task.id, {
      ...task,
      status: 'deferred',
      scheduledStartOffset: undefined,
      scheduledEndOffset: undefined,
      rationaleCode: undefined,
      rationaleText: undefined,
      deferralCode,
      deferralText
    });
  }

  slots.sort((a, b) => a.startMinuteOffset - b.startMinuteOffset);

  const orderedFinalTasks: TaskItem[] = workingTasks.map(
    (t) => finalTaskMap.get(t.id) ?? t
  );

  const scheduledMinutesTotal = slots.reduce(
    (sum, s) => sum + (s.endMinuteOffset - s.startMinuteOffset),
    0
  );

  return {
    availableMinutes: clampedAvailable,
    effectiveBufferMinutes,
    scheduledMinutesTotal,
    unscheduledSlackMinutes: Math.max(
      0,
      clampedAvailable - scheduledMinutesTotal
    ),
    tasks: orderedFinalTasks,
    slots,
    hadDependencyCycle: dag.hadCycle,
    removedDependencyEdges: dag.removedEdges,
    validationWarnings: warnings
  };
}


// =====================================================================
// AI Studio Focus Living Village Schedule Engine Extensions
// =====================================================================
import type {
  FocusTask,
  PlanDiffEntry,
  PlanScheduleResult,
  ScheduledTaskBlock,
  DeferredTaskRecord,
  DeferralReasonCode
} from '@/types/focus';

/**
 * Named scoring constants for transparent, deterministic priority scoring.
 * Grounded in working-memory offloading and interruption-aware replanning principles.
 */
export const PLANNER_WEIGHTS = {
  PRIORITY_MULTIPLIER: 24,
  HARD_DEADLINE_BONUS: 65,
  FIXED_APPOINTMENT_BONUS: 120,
  SHORT_TASK_FIT_BONUS: 14,
  TRANSITION_BUFFER_MINUTES: 5
} as const;

/**
 * Detects directed dependency cycles using 3-color DFS.
 */
export function detectDependencyCycle(tasks: readonly FocusTask[]): {
  hasCycle: boolean;
  cycleNodes: string[];
} {
  const taskMap = new Map<string, FocusTask>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  const state = new Map<string, 0 | 1 | 2>(); // 0 = unvisited, 1 = visiting, 2 = visited
  const cycleNodes: string[] = [];

  const dfs = (id: string): boolean => {
    state.set(id, 1);
    const task = taskMap.get(id);
    if (task) {
      for (const depId of task.dependencies) {
        if (!taskMap.has(depId)) continue;
        const depState = state.get(depId) ?? 0;
        if (depState === 1) {
          cycleNodes.push(id, depId);
          return true;
        }
        if (depState === 0 && dfs(depId)) {
          return true;
        }
      }
    }
    state.set(id, 2);
    return false;
  };

  for (const t of tasks) {
    if ((state.get(t.id) ?? 0) === 0) {
      if (dfs(t.id)) {
        return { hasCycle: true, cycleNodes };
      }
    }
  }

  return { hasCycle: false, cycleNodes: [] };
}

export function scoreTaskPriority(task: FocusTask, remainingMinutes: number): number {
  let score = task.priority * PLANNER_WEIGHTS.PRIORITY_MULTIPLIER;
  if (task.isFixedAppointment) {
    score += PLANNER_WEIGHTS.FIXED_APPOINTMENT_BONUS;
  }
  if (task.isHardDeadline) {
    score += PLANNER_WEIGHTS.HARD_DEADLINE_BONUS;
  }
  if (task.estimatedMinutes <= Math.max(30, remainingMinutes * 0.5)) {
    score += PLANNER_WEIGHTS.SHORT_TASK_FIT_BONUS;
  }
  return score;
}

/**
 * Pure deterministic day scheduler.
 * Preserves completed tasks, validates DAG dependencies, schedules feasible tasks
 * within `availableMinutes`, and generates plain-language explanations for deferred items.
 */
export function buildDeterministicSchedule(
  tasks: readonly FocusTask[],
  availableMinutes: number
): PlanScheduleResult {
  const safeAvailable = Math.max(10, Math.min(960, Math.round(availableMinutes)));
  const cycleCheck = detectDependencyCycle(tasks);

  if (cycleCheck.hasCycle) {
    return {
      availableMinutes: safeAvailable,
      scheduledBlocks: [],
      deferredTasks: tasks
        .filter((t) => t.status !== 'completed')
        .map((t) => ({
          taskId: t.id,
          title: t.title,
          estimatedMinutes: t.estimatedMinutes,
          reasonCode: 'DEPENDENCY_BLOCKED',
          explanation: 'Dependency cycle detected between tasks; please remove circular prerequisites.'
        })),
      completedTaskIds: tasks.filter((t) => t.status === 'completed').map((t) => t.id),
      totalScheduledMinutes: 0,
      remainingFreeMinutes: safeAvailable,
      nextStepTaskId: null,
      hasCycleError: true,
      cycleErrorMessage: `Circular dependency detected involving: ${cycleCheck.cycleNodes.join(' -> ')}`
    };
  }

  const completedTaskIds = tasks.filter((t) => t.status === 'completed').map((t) => t.id);
  const completedOrScheduledSet = new Set<string>(completedTaskIds);

  const activeCandidates = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled'
  );

  const scheduledBlocks: ScheduledTaskBlock[] = [];
  const deferredTasks: DeferredTaskRecord[] = [];
  const processedIds = new Set<string>();

  let usedMinutes = 0;

  // Iteratively select the highest-scoring eligible task whose dependencies are satisfied
  let progressMade = true;
  while (progressMade) {
    progressMade = false;

    const readyCandidates = activeCandidates
      .filter((t) => !processedIds.has(t.id))
      .filter((t) =>
        t.dependencies.every((depId) => completedOrScheduledSet.has(depId))
      );

    if (readyCandidates.length === 0) break;

    const remainingNow = Math.max(0, safeAvailable - usedMinutes);

    readyCandidates.sort((a, b) => {
      const scoreDiff =
        scoreTaskPriority(b, remainingNow) - scoreTaskPriority(a, remainingNow);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.estimatedMinutes !== b.estimatedMinutes) {
        return a.estimatedMinutes - b.estimatedMinutes;
      }
      return a.id.localeCompare(b.id);
    });

    const chosen = readyCandidates[0];
    processedIds.add(chosen.id);
    progressMade = true;

    const duration = Math.max(5, Math.min(480, Math.round(chosen.estimatedMinutes)));
    const buffer =
      scheduledBlocks.length > 0 ? PLANNER_WEIGHTS.TRANSITION_BUFFER_MINUTES : 0;

    if (usedMinutes + buffer + duration <= safeAvailable) {
      const startOffset = usedMinutes + buffer;
      const endOffset = startOffset + duration;
      usedMinutes = endOffset;
      completedOrScheduledSet.add(chosen.id);

      const isFirstBlock = scheduledBlocks.length === 0;
      let reasonCode: DeferralReasonCode = 'FITS_SCHEDULE';
      let explanation = `Fits comfortably in your ${safeAvailable}m window (${duration}m estimated).`;

      if (chosen.isFixedAppointment) {
        reasonCode = 'FIXED_APPOINTMENT';
        explanation = `Anchored first because this is a fixed commitment (${duration}m).`;
      } else if (chosen.isHardDeadline) {
        reasonCode = 'HARD_DEADLINE_FIRST';
        explanation = `Prioritized first because of its high deadline urgency (${duration}m).`;
      } else if (chosen.dependencies.length > 0) {
        reasonCode = 'PREREQUISITE_READY';
        explanation = `Scheduled immediately after its prerequisite building (${duration}m).`;
      } else if (isFirstBlock) {
        explanation = `Highlighted as your clearest Next Step (${duration}m est., priority ${chosen.priority}/5).`;
      }

      scheduledBlocks.push({
        taskId: chosen.id,
        title: chosen.title,
        category: chosen.category,
        startMinuteOffset: startOffset,
        endMinuteOffset: endOffset,
        durationMinutes: duration,
        bufferAfterMinutes: PLANNER_WEIGHTS.TRANSITION_BUFFER_MINUTES,
        priorityScore: scoreTaskPriority(chosen, remainingNow),
        isNextStep: isFirstBlock,
        reasonCode,
        explanation
      });
    } else {
      const freeLeft = Math.max(0, safeAvailable - usedMinutes);
      deferredTasks.push({
        taskId: chosen.id,
        title: chosen.title,
        estimatedMinutes: duration,
        reasonCode: 'INSUFFICIENT_TIME',
        explanation: `Safely stored in the Town Storehouse: ${freeLeft}m remain in your ${safeAvailable}m window, and this goal needs ~${duration}m.`
      });
    }
  }

  // Any remaining unprocessed tasks were blocked by an unscheduled prerequisite
  for (const t of activeCandidates) {
    if (!processedIds.has(t.id)) {
      deferredTasks.push({
        taskId: t.id,
        title: t.title,
        estimatedMinutes: t.estimatedMinutes,
        reasonCode: 'DEPENDENCY_BLOCKED',
        explanation: `Deferred because its prerequisite task could not fit into today's ${safeAvailable}m window.`
      });
    }
  }

  return {
    availableMinutes: safeAvailable,
    scheduledBlocks,
    deferredTasks,
    completedTaskIds,
    totalScheduledMinutes: usedMinutes,
    remainingFreeMinutes: Math.max(0, safeAvailable - usedMinutes),
    nextStepTaskId: scheduledBlocks[0]?.taskId ?? null,
    hasCycleError: false
  };
}

/**
 * Computes a transparent diff between a previous schedule and a newly replanned schedule.
 */
export function computePlanDiff(
  previousPlan: PlanScheduleResult,
  nextPlan: PlanScheduleResult,
  tasks: readonly FocusTask[]
): PlanDiffEntry[] {
  const prevScheduled = new Set(previousPlan.scheduledBlocks.map((b) => b.taskId));
  const prevCompleted = new Set(previousPlan.completedTaskIds);

  const nextScheduledMap = new Map(
    nextPlan.scheduledBlocks.map((b) => [b.taskId, b])
  );
  const nextDeferredMap = new Map(
    nextPlan.deferredTasks.map((d) => [d.taskId, d])
  );
  const nextCompleted = new Set(nextPlan.completedTaskIds);

  const diffs: PlanDiffEntry[] = [];

  for (const t of tasks) {
    const prevState: 'scheduled' | 'deferred' | 'completed' = prevCompleted.has(t.id)
      ? 'completed'
      : prevScheduled.has(t.id)
      ? 'scheduled'
      : 'deferred';

    const newState: 'scheduled' | 'deferred' | 'completed' = nextCompleted.has(t.id)
      ? 'completed'
      : nextScheduledMap.has(t.id)
      ? 'scheduled'
      : 'deferred';

    const scheduledBlock = nextScheduledMap.get(t.id);
    const deferredRec = nextDeferredMap.get(t.id);

    if (prevState !== newState || scheduledBlock?.isNextStep) {
      diffs.push({
        taskId: t.id,
        title: t.title,
        previousState: prevState,
        newState,
        reasonCode:
          scheduledBlock?.reasonCode ??
          deferredRec?.reasonCode ??
          'ALREADY_COMPLETED',
        explanation:
          scheduledBlock?.explanation ??
          deferredRec?.explanation ??
          'Completed monument preserved in the village.'
      });
    }
  }

  return diffs;
}
