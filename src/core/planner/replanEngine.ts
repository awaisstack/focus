import type {
  PlanDiffItem,
  PlanSnapshot,
  ScheduleSlot,
  TaskItem
} from '@/types/task';
import type { WorldProfile } from '@/types/world';
import { computeDeterministicSchedule } from './scheduleEngine';
import { formatDurationLabel } from './priorityScorer';

export interface ReplanResult {
  remainingMinutes: number;
  updatedTasks: TaskItem[];
  slots: ScheduleSlot[];
  planDiff: PlanDiffItem[];
  previousSnapshot: PlanSnapshot;
  summaryHeadline: string;
  recommendedProfile: WorldProfile;
}

/**
 * Deterministic natural-language parser for interruption constraints.
 * Extracts remaining minutes (e.g., "I only have 45 minutes left", "1.5 hours remain")
 * so offline/local replanning works reliably even without an LLM call.
 */
export function parseLocalInterruptionConstraint(
  interruptionText: string,
  fallbackMinutes = 45
): {
  remainingMinutes: number;
  parsedFromText: boolean;
} {
  const clean = interruptionText.trim().toLowerCase();
  if (!clean) {
    return { remainingMinutes: fallbackMinutes, parsedFromText: false };
  }

  // Match explicit minute mentions: "45 minutes", "30 mins", "25m"
  const minuteMatch = clean.match(
    /\b(\d{1,3})\s*(?:minutes?|mins?|m)\b/
  );
  if (minuteMatch) {
    const mins = parseInt(minuteMatch[1], 10);
    if (mins >= 10 && mins <= 720) {
      return { remainingMinutes: mins, parsedFromText: true };
    }
  }

  // Match decimal or integer hours: "1.5 hours", "2 hrs", "an hour", "half an hour"
  if (/\bhalf\s+an?\s+hour\b/.test(clean)) {
    return { remainingMinutes: 30, parsedFromText: true };
  }
  if (/\b(?:an|one)\s+hour\b/.test(clean)) {
    return { remainingMinutes: 60, parsedFromText: true };
  }
  const hourMatch = clean.match(
    /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/
  );
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    const mins = Math.round(hours * 60);
    if (mins >= 10 && mins <= 720) {
      return { remainingMinutes: mins, parsedFromText: true };
    }
  }

  return { remainingMinutes: fallbackMinutes, parsedFromText: false };
}

/**
 * Recomputes a feasible day plan after an interruption changes available time or task states.
 * Preserves completed work, calculates a transparent PlanDiffItem[] array,
 * and returns a reversible PlanSnapshot for single-click undo.
 */
export function replanAfterInterruption(params: {
  currentTasks: TaskItem[];
  previousAvailableMinutes: number;
  remainingMinutes: number;
  newlyCompletedTaskIds?: string[];
  currentProfile: WorldProfile;
  interruptionNote?: string;
}): ReplanResult {
  const {
    currentTasks,
    previousAvailableMinutes,
    remainingMinutes,
    newlyCompletedTaskIds = [],
    currentProfile
  } = params;

  const nowIso = new Date().toISOString();

  // 1. Capture snapshot BEFORE mutating for instant undo recovery
  const previousSnapshot: PlanSnapshot = {
    snapshotId: `snapshot-${Date.now()}`,
    timestamp: nowIso,
    availableMinutes: previousAvailableMinutes,
    tasks: currentTasks.map((t) => ({ ...t })),
    summaryNote: `Prior plan (${previousAvailableMinutes} min budget)`
  };

  const newlyCompletedSet = new Set(newlyCompletedTaskIds);

  // 2. Apply any newly completed status overrides while resetting non-completed tasks for fresh evaluation
  const preparedTasks: TaskItem[] = currentTasks.map((task) => {
    if (task.status === 'completed' || newlyCompletedSet.has(task.id)) {
      return {
        ...task,
        status: 'completed',
        rationaleText:
          'Completed earlier today — preserved in your sanctuary.',
        updatedAt: nowIso
      };
    }

    // Reset previously deferred/scheduled tasks back to pending so the scheduler evaluates them fairly
    return {
      ...task,
      status: 'pending',
      hardDeadlineOffsetMinutes:
        task.hardDeadlineOffsetMinutes !== undefined
          ? Math.min(task.hardDeadlineOffsetMinutes, remainingMinutes)
          : undefined,
      updatedAt: nowIso
    };
  });

  // 3. Run deterministic schedule engine for the new remaining time budget
  const scheduleResult = computeDeterministicSchedule({
    tasks: preparedTasks,
    availableMinutes: remainingMinutes
  });

  // 4. Construct transparent PlanDiffItem[] comparing previous tasks to replanned tasks
  const previousStatusById = new Map(
    currentTasks.map((t) => [t.id, t.status])
  );

  const planDiff: PlanDiffItem[] = scheduleResult.tasks.map((updated) => {
    const prevStatus = previousStatusById.get(updated.id) ?? 'pending';
    const durationPhrase = formatDurationLabel(updated);

    let explanation = updated.rationaleText ?? 'Scheduled in updated route.';
    if (updated.status === 'completed') {
      explanation = 'Completed work preserved — your landmark remains in bloom.';
    } else if (updated.status === 'deferred') {
      explanation =
        updated.deferralText ??
        `Resting for later: ${durationPhrase} does not fit the ${remainingMinutes}m window.`;
    } else if (updated.status === 'scheduled') {
      explanation =
        updated.rationaleText ??
        `Fits your ${remainingMinutes}-minute window (${durationPhrase}).`;
    }

    return {
      taskId: updated.id,
      title: updated.title,
      previousStatus: prevStatus,
      newStatus: updated.status,
      estimatedMinutes: updated.estimatedMinutes,
      explanation
    };
  });

  const completedCount = scheduleResult.tasks.filter(
    (t) => t.status === 'completed'
  ).length;
  const scheduledTasks = scheduleResult.tasks.filter(
    (t) => t.status === 'scheduled'
  );
  const deferredCount = scheduleResult.tasks.filter(
    (t) => t.status === 'deferred'
  ).length;

  const nextTaskTitle =
    scheduledTasks[0]?.title ?? 'No remaining tasks needed';

  const summaryHeadline =
    scheduledTasks.length > 0
      ? `You have ${remainingMinutes} minutes. "${nextTaskTitle}" fits now; ${deferredCount} ${
          deferredCount === 1 ? 'task is' : 'tasks are'
        } resting for later.`
      : `You have ${remainingMinutes} minutes remaining. ${completedCount} completed preserved; remaining tasks need longer windows and are resting for later.`;

  // Recommend a calm, grounded atmosphere shift when time is tight (<= 60m)
  const recommendedProfile: WorldProfile =
    remainingMinutes <= 60
      ? {
          biomeId: 'MISTY_ZEN_STREAM',
          soundscapeId: 'JADE_RAIN_STREAM',
          narrativeLine: summaryHeadline,
          atmosphereNote: `${remainingMinutes}m remaining • ${completedCount} completed • ${scheduledTasks.length} active • ${deferredCount} deferred`,
          sunElevationDeg: 28,
          fogDensity: 0.018
        }
      : {
          ...currentProfile,
          narrativeLine: summaryHeadline,
          atmosphereNote: `${remainingMinutes}m remaining • ${completedCount} completed • ${scheduledTasks.length} active • ${deferredCount} deferred`
        };

  return {
    remainingMinutes,
    updatedTasks: scheduleResult.tasks,
    slots: scheduleResult.slots,
    planDiff,
    previousSnapshot,
    summaryHeadline,
    recommendedProfile
  };
}
