import type { ScheduleRationaleCode, TaskItem } from '@/types/task';

/**
 * Named scoring constants for transparent, explainable deterministic scheduling.
 * Total composite score scales from 0 to 100.
 */
export const SCORING_WEIGHTS = {
  /** User-assigned priority (1..5) contributes up to 40 points */
  PRIORITY_MAX_POINTS: 40,
  /** Hard deadline proximity contributes up to 30 points */
  DEADLINE_URGENCY_MAX_POINTS: 30,
  /** Unlocking downstream dependent tasks contributes up to 20 points */
  DEPENDENT_UNLOCK_MAX_POINTS: 20,
  /** Duration efficiency fit within the remaining interval contributes up to 10 points */
  INTERVAL_FIT_MAX_POINTS: 10
} as const;

export interface TaskScoreBreakdown {
  taskId: string;
  totalScore: number;
  priorityPoints: number;
  urgencyPoints: number;
  dependentPoints: number;
  fitPoints: number;
  rationaleCode: ScheduleRationaleCode;
  rationaleText: string;
}

export function formatDurationLabel(task: TaskItem): string {
  return task.isDurationConfirmed
    ? `${task.estimatedMinutes} min`
    : `~${task.estimatedMinutes} min (est.)`;
}

/**
 * Computes a deterministic priority score and human-readable rationale
 * for an eligible task at a given point in the schedule.
 */
export function scoreEligibleTask(params: {
  task: TaskItem;
  currentMinuteOffset: number;
  intervalRemainingMinutes: number;
  totalAvailableMinutes: number;
  dependentCount: number;
  taskTitleById: Map<string, string>;
}): TaskScoreBreakdown {
  const {
    task,
    currentMinuteOffset,
    intervalRemainingMinutes,
    totalAvailableMinutes,
    dependentCount,
    taskTitleById
  } = params;

  // 1. User Priority (1..5 -> 8..40 pts)
  const priorityPoints =
    (task.priority / 5) * SCORING_WEIGHTS.PRIORITY_MAX_POINTS;

  // 2. Deadline Urgency (0..30 pts)
  let urgencyPoints = 0;
  if (task.hardDeadlineOffsetMinutes !== undefined) {
    const slack =
      task.hardDeadlineOffsetMinutes -
      (currentMinuteOffset + task.estimatedMinutes);
    if (slack <= 15) {
      urgencyPoints = SCORING_WEIGHTS.DEADLINE_URGENCY_MAX_POINTS;
    } else if (slack <= 60) {
      urgencyPoints = SCORING_WEIGHTS.DEADLINE_URGENCY_MAX_POINTS * 0.8;
    } else {
      const normalizedUrgency = Math.max(
        0.25,
        1 - slack / Math.max(60, totalAvailableMinutes)
      );
      urgencyPoints =
        normalizedUrgency * SCORING_WEIGHTS.DEADLINE_URGENCY_MAX_POINTS;
    }
  }

  // 3. Downstream Prerequisite Unlock (0..20 pts)
  const dependentPoints =
    Math.min(1, dependentCount / 2) * SCORING_WEIGHTS.DEPENDENT_UNLOCK_MAX_POINTS;

  // 4. Interval Fit Bonus (0..10 pts) — rewards utilizing constrained windows cleanly
  const utilizationRatio =
    intervalRemainingMinutes > 0
      ? Math.min(1, task.estimatedMinutes / intervalRemainingMinutes)
      : 0;
  const fitPoints = utilizationRatio * SCORING_WEIGHTS.INTERVAL_FIT_MAX_POINTS;

  const totalScore = Number(
    (priorityPoints + urgencyPoints + dependentPoints + fitPoints).toFixed(3)
  );

  const durationPhrase = formatDurationLabel(task);
  const completedPrereqTitles = task.dependencies
    .map((id) => taskTitleById.get(id))
    .filter(Boolean);

  // Select the most informative rationale code and plain-language explanation
  let rationaleCode: ScheduleRationaleCode = 'HIGHEST_PRIORITY_FIT';
  let rationaleText = `Scheduled (${durationPhrase}, priority ${task.priority}/5) based on your day plan.`;

  if (dependentCount > 0) {
    rationaleCode = 'PREREQUISITE_FOR_OTHER';
    rationaleText = `Scheduled first (${durationPhrase}) because ${dependentCount} other ${
      dependentCount === 1 ? 'task depends' : 'tasks depend'
    } on completing this step.`;
  } else if (task.hardDeadlineOffsetMinutes !== undefined) {
    rationaleCode = 'HARD_DEADLINE_FIRST';
    const prereqNote =
      completedPrereqTitles.length > 0
        ? ` after "${completedPrereqTitles[0]}"`
        : '';
    rationaleText = `Scheduled${prereqNote} (${durationPhrase}) to meet your hard deadline within ${task.hardDeadlineOffsetMinutes} min.`;
  } else if (
    totalAvailableMinutes <= 60 ||
    intervalRemainingMinutes - task.estimatedMinutes <= 15
  ) {
    rationaleCode = 'FITS_REMAINING_WINDOW';
    rationaleText = `Fits cleanly (${durationPhrase}) within your ${intervalRemainingMinutes}-minute available window.`;
  } else if (completedPrereqTitles.length > 0) {
    rationaleCode = 'PREREQUISITE_FOR_OTHER';
    rationaleText = `Placed after prerequisite "${completedPrereqTitles[0]}" (${durationPhrase}).`;
  }

  return {
    taskId: task.id,
    totalScore,
    priorityPoints,
    urgencyPoints,
    dependentPoints,
    fitPoints,
    rationaleCode,
    rationaleText
  };
}
