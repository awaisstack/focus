import { z } from 'zod';
import type {
  DeferralReasonCode,
  ScheduleRationaleCode,
  TaskCategory,
  TaskItem,
  TaskPriority,
  TaskStatus
} from '@/types/task';

export const MIN_TASK_DURATION_MINUTES = 5;
export const MAX_TASK_DURATION_MINUTES = 480;
export const MIN_AVAILABLE_MINUTES = 10;
export const MAX_AVAILABLE_MINUTES = 960;

export const TaskCategorySchema = z.enum([
  'STUDY',
  'WRITING',
  'OUTDOORS',
  'CONNECTION',
  'GENERAL',
  'SCHOLAR_TOWER',
  'GUILD_WORKSHOP',
  'MEADOW_PAVILION',
  'MARKET_HEARTH',
  'MILL_GRANARY',
  'APOTHECARY_COTTAGE'
]);

export const TaskStatusSchema = z.enum([
  'proposed',
  'pending',
  'scheduled',
  'in-progress',
  'completed',
  'deferred',
  'cancelled'
]);

export const TaskPrioritySchema = z
  .number()
  .int()
  .min(1)
  .max(5)
  .transform((val) => val as TaskPriority);

export const ScheduleRationaleCodeSchema = z.enum([
  'HARD_DEADLINE_FIRST',
  'FIXED_APPOINTMENT',
  'PREREQUISITE_FOR_OTHER',
  'HIGHEST_PRIORITY_FIT',
  'FITS_REMAINING_WINDOW',
  'USER_MANUAL_ORDER'
]);

export const DeferralReasonCodeSchema = z.enum([
  'INSUFFICIENT_REMAINING_TIME',
  'DEPENDENCY_DEFERRED',
  'FIXED_SLOT_CONFLICT',
  'EXCEEDS_DAILY_BUDGET',
  'USER_DEFERRED'
]);

export const FixedTimeSlotSchema = z
  .object({
    startMinuteOffset: z.number().int().min(0).max(MAX_AVAILABLE_MINUTES),
    endMinuteOffset: z.number().int().min(5).max(MAX_AVAILABLE_MINUTES),
    label: z.string().trim().max(80).optional()
  })
  .refine((slot) => slot.endMinuteOffset > slot.startMinuteOffset, {
    message: 'Fixed time slot endMinuteOffset must be greater than startMinuteOffset.'
  });

export const TaskItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1, 'Task title is required').max(120),
  description: z.string().trim().max(300).optional(),
  estimatedMinutes: z
    .number()
    .finite()
    .transform((n) =>
      Math.round(
        Math.min(MAX_TASK_DURATION_MINUTES, Math.max(MIN_TASK_DURATION_MINUTES, n))
      )
    ),
  isDurationConfirmed: z.boolean().default(false),
  priority: z
    .number()
    .finite()
    .transform((n) => Math.round(Math.min(5, Math.max(1, n))) as TaskPriority),
  dependencies: z.array(z.string().trim().min(1)).default([]),
  fixedSlot: FixedTimeSlotSchema.optional(),
  hardDeadlineOffsetMinutes: z
    .number()
    .int()
    .min(5)
    .max(MAX_AVAILABLE_MINUTES)
    .optional(),
  category: TaskCategorySchema.default('GENERAL'),
  status: TaskStatusSchema.default('pending'),
  rationaleCode: ScheduleRationaleCodeSchema.optional(),
  rationaleText: z.string().optional(),
  deferralCode: DeferralReasonCodeSchema.optional(),
  deferralText: z.string().optional(),
  scheduledStartOffset: z.number().int().min(0).optional(),
  scheduledEndOffset: z.number().int().min(0).optional(),
  source: z.enum(['user', 'ai-proposal', 'demo-preset']).default('user'),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString())
});

export interface TaskValidationResult {
  tasks: TaskItem[];
  warnings: string[];
}

/**
 * Validates raw task objects, clamps out-of-bounds durations/priorities,
 * deduplicates task IDs, and removes references to nonexistent dependency IDs.
 */
export function validateAndNormalizeTasks(
  rawTasks: unknown[]
): TaskValidationResult {
  const warnings: string[] = [];
  const parsedTasks: TaskItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawTasks.length; i++) {
    const result = TaskItemSchema.safeParse(rawTasks[i]);
    if (!result.success) {
      warnings.push(
        `Task at index ${i} failed validation: ${result.error.issues
          .map((iss) => iss.message)
          .join('; ')}`
      );
      continue;
    }

    const task = result.data as TaskItem;
    const uniqueId = seenIds.has(task.id) ? `${task.id}-${i + 1}` : task.id;
    if (uniqueId !== task.id) {
      warnings.push(`Duplicate task ID "${task.id}" renamed to "${uniqueId}".`);
    }
    seenIds.add(uniqueId);

    parsedTasks.push({
      ...task,
      id: uniqueId
    });
  }

  // Second pass: strip self-dependencies and nonexistent dependency IDs
  const validIdSet = new Set(parsedTasks.map((t) => t.id));
  const cleanedTasks = parsedTasks.map((task) => {
    const validDeps: string[] = [];
    for (const depId of task.dependencies) {
      if (depId === task.id) {
        warnings.push(`Removed self-dependency on task "${task.title}".`);
        continue;
      }
      if (!validIdSet.has(depId)) {
        warnings.push(
          `Removed unknown dependency ID "${depId}" from task "${task.title}".`
        );
        continue;
      }
      if (!validDeps.includes(depId)) {
        validDeps.push(depId);
      }
    }

    return {
      ...task,
      dependencies: validDeps
    };
  });

  return {
    tasks: cleanedTasks,
    warnings
  };
}

/**
 * Maps any raw category or title text to one of the 6 canonical Village Guild Archetypes:
 * - SCHOLAR_TOWER: Wisdom, study, reading, research, analysis, exam prep, learning
 * - GUILD_WORKSHOP: Coding, software dev, engineering, building, craft, writing, projects
 * - MILL_GRANARY: Food, cooking, baking, meals, groceries, nutrition, water
 * - MARKET_HEARTH: Calls, friends, family, meetings, social, messages, community
 * - APOTHECARY_COTTAGE: Workouts, gym, fitness, health, medicine, cleaning, repairs, chores
 * - MEADOW_PAVILION: Walking, fresh air, outdoors, nature, meditation, breaks, relaxing
 */
export function toCanonicalVillageCategory(raw: string, title = ''): string {
  const norm = (raw || '').toUpperCase().trim();
  if (norm === 'SCHOLAR_TOWER' || norm === 'STUDY') return 'SCHOLAR_TOWER';
  if (norm === 'GUILD_WORKSHOP' || norm === 'WRITING') return 'GUILD_WORKSHOP';
  if (norm === 'MILL_GRANARY') return 'MILL_GRANARY';
  if (norm === 'MARKET_HEARTH' || norm === 'CONNECTION') return 'MARKET_HEARTH';
  if (norm === 'APOTHECARY_COTTAGE') return 'APOTHECARY_COTTAGE';
  if (norm === 'MEADOW_PAVILION' || norm === 'OUTDOORS') return 'MEADOW_PAVILION';

  const lower = (title || raw).toLowerCase();
  if (
    /\b(cook|bake|meal|dinner|lunch|breakfast|grocery|groceries|food|eat|snack|drink|water|coffee|tea|recipe)\b/.test(
      lower
    )
  ) {
    return 'MILL_GRANARY';
  }
  if (
    /\b(gym|workout|lift|fitness|cardio|exercise|clean|cleaning|tidy|tidying|laundry|dishes|chore|chores|repair|fix|doctor|dentist|health|meds)\b/.test(
      lower
    )
  ) {
    return 'APOTHECARY_COTTAGE';
  }
  if (
    /\b(walk|hike|park|nature|outside|fresh air|stroll|meditate|meditation|breathe|journal|journaling|relax|rest|nap|break)\b/.test(
      lower
    )
  ) {
    return 'MEADOW_PAVILION';
  }
  if (
    /\b(study|read|reading|book|books|research|paper|exam|test|quiz|lecture|class|course|learn|learning|notes|review|math|history|science|physics|chem|biology)\b/.test(
      lower
    )
  ) {
    return 'SCHOLAR_TOWER';
  }
  if (
    /\b(call|phone|talk|meet|meeting|sync|chat|message|text|email|zoom|friend|friends|family|mom|dad|brother|sister|partner|hangout|trade)\b/.test(
      lower
    )
  ) {
    return 'MARKET_HEARTH';
  }
  return 'GUILD_WORKSHOP';
}

/**
 * Infers a default TaskCategory from a task title when created manually or via fallback.
 */
export function inferTaskCategoryFromText(text: string): TaskCategory {
  const lower = text.toLowerCase();
  if (
    /\b(study|read|review|course|lecture|exam|research|learn|chapter|notes|book)\b/.test(
      lower
    )
  ) {
    return 'STUDY';
  }
  if (
    /\b(write|assignment|essay|draft|report|paper|code|project|submit|slides|build)\b/.test(
      lower
    )
  ) {
    return 'WRITING';
  }
  if (
    /\b(walk|run|outside|jog|stretch|park|hike|fresh air|exercise|gym|workout)\b/.test(
      lower
    )
  ) {
    return 'OUTDOORS';
  }
  if (
    /\b(call|friend|family|mom|dad|meet|chat|message|email|catch up|phone)\b/.test(
      lower
    )
  ) {
    return 'CONNECTION';
  }
  return 'GENERAL';
}
