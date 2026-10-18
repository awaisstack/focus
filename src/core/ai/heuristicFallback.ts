import type { TaskCategory, TaskItem, TaskPriority } from '@/types/task';
import type { BiomePresetId, WorldProfile } from '@/types/world';
import {
  inferTaskCategoryFromText,
  validateAndNormalizeTasks
} from '@/schemas/taskSchemas';
import { coerceValidWorldProfile } from '@/schemas/worldSchemas';
import { parseLocalInterruptionConstraint } from '@/core/planner/replanEngine';

function extractMinutesFromClause(clause: string): {
  minutes: number;
  isExplicit: boolean;
} {
  const lower = clause.toLowerCase();

  const minMatch = lower.match(/\b(\d{1,3})\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) {
    return {
      minutes: Math.min(480, Math.max(5, parseInt(minMatch[1], 10))),
      isExplicit: true
    };
  }

  if (/\bhalf\s+an?\s+hour\b/.test(lower)) {
    return { minutes: 30, isExplicit: true };
  }

  if (/\b(?:an|one)\s+hour\b/.test(lower)) {
    return { minutes: 60, isExplicit: true };
  }

  const hourMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) {
    return {
      minutes: Math.min(480, Math.max(5, Math.round(parseFloat(hourMatch[1]) * 60))),
      isExplicit: true
    };
  }

  const category = inferTaskCategoryFromText(clause);
  const defaultByCat: Record<TaskCategory, number> = {
    STUDY: 60,
    WRITING: 45,
    OUTDOORS: 30,
    CONNECTION: 20,
    GENERAL: 30,
    SCHOLAR_TOWER: 60,
    GUILD_WORKSHOP: 50,
    MILL_GRANARY: 35,
    MARKET_HEARTH: 25,
    APOTHECARY_COTTAGE: 40,
    MEADOW_PAVILION: 30
  };

  return {
    minutes: defaultByCat[category] ?? 30,
    isExplicit: false
  };
}

function defaultPriorityForCategory(category: TaskCategory): TaskPriority {
  switch (category) {
    case 'STUDY':
    case 'WRITING':
    case 'SCHOLAR_TOWER':
    case 'GUILD_WORKSHOP':
      return 5;
    case 'OUTDOORS':
    case 'CONNECTION':
    case 'MILL_GRANARY':
    case 'APOTHECARY_COTTAGE':
    case 'MEADOW_PAVILION':
      return 3;
    default:
      return 3;
  }
}

function cleanClauseTitle(rawClause: string): string {
  const trimmed = rawClause
    .replace(/^(?:and|then|also|plus|next)\s+/i, '')
    .trim();
  if (!trimmed) return 'Focused sanctuary step';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Deterministic local parser that converts natural-language goals into structured
 * TaskItem[] and a WorldProfile whenever hosted AI is unconfigured, offline, or out of quota.
 */
export function buildHeuristicPlanProposal(params: {
  promptText: string;
  availableMinutes: number;
  preferredBiomeId?: BiomePresetId;
}): {
  tasks: TaskItem[];
  profile: WorldProfile;
  clarifyingQuestion: string | null;
} {
  const { promptText, availableMinutes, preferredBiomeId } = params;
  const nowIso = new Date().toISOString();

  // Split natural language on commas, semicolons, newlines, or " and "
  const rawClauses = promptText
    .split(/(?:,|;|\n|\band\b)+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .slice(0, 8);

  const clauses =
    rawClauses.length > 0 ? rawClauses : [promptText.trim() || 'Focus session'];

  const draftTasks: TaskItem[] = clauses.map((clause, index) => {
    const title = cleanClauseTitle(clause);
    const category = inferTaskCategoryFromText(title);
    const { minutes, isExplicit } = extractMinutesFromClause(clause);
    const priority = defaultPriorityForCategory(category);

    return {
      id: `task-local-${index + 1}`,
      title,
      description: `Captured from your goal prompt (${
        isExplicit ? 'stated duration' : 'estimated duration'
      }).`,
      estimatedMinutes: minutes,
      isDurationConfirmed: isExplicit,
      priority,
      dependencies: [],
      category,
      status: 'proposed',
      source: 'ai-proposal',
      createdAt: nowIso,
      updatedAt: nowIso
    };
  });

  // If both a STUDY task and a WRITING/assignment task exist, link Writing after Study
  const firstStudyTask = draftTasks.find((t) => t.category === 'STUDY');
  const firstWritingTask = draftTasks.find(
    (t) => t.category === 'WRITING' && t.id !== firstStudyTask?.id
  );
  if (firstStudyTask && firstWritingTask) {
    firstWritingTask.dependencies = [firstStudyTask.id];
    firstWritingTask.hardDeadlineOffsetMinutes = Math.min(
      availableMinutes,
      firstStudyTask.estimatedMinutes + firstWritingTask.estimatedMinutes + 45
    );
  }

  const { tasks } = validateAndNormalizeTasks(draftTasks);

  const targetBiome: BiomePresetId =
    preferredBiomeId ??
    (availableMinutes <= 60 ? 'MISTY_ZEN_STREAM' : 'SUNLIT_GLADE');

  const profile = coerceValidWorldProfile(
    {
      biomeId: targetBiome,
      narrativeLine:
        targetBiome === 'MISTY_ZEN_STREAM'
          ? 'Calm mist settles across the stream. Focus on the single step that fits your window.'
          : 'Morning light warms the moss glade. Your tasks are arranged along a clear stepping-stone route.',
      atmosphereNote: `${availableMinutes}m budget • ${tasks.length} destinations prepared`
    },
    targetBiome
  );

  // Ask one concise clarifying question only if no durations were explicitly stated
  const anyExplicitDuration = draftTasks.some((t) => t.isDurationConfirmed);
  const clarifyingQuestion = anyExplicitDuration
    ? null
    : 'Durations were estimated automatically—feel free to adjust any minute estimate before cultivating your world.';

  return {
    tasks,
    profile,
    clarifyingQuestion
  };
}

/**
 * Deterministic local parser for interruption text when hosted AI is unavailable.
 */
export function buildHeuristicReplanProposal(params: {
  interruptionText: string;
  currentAvailableMinutes: number;
  currentTasks: Array<{ id: string; title: string; status: string }>;
}): {
  remainingMinutes: number;
  newlyCompletedTaskIds: string[];
  profile: WorldProfile;
  interruptionSummary: string;
} {
  const { interruptionText, currentTasks } = params;
  const parsedTime = parseLocalInterruptionConstraint(interruptionText, 45);
  const lower = interruptionText.toLowerCase();

  // Detect if user mentioned finishing/completing a task in their interruption text
  const newlyCompletedTaskIds: string[] = [];
  if (/\b(done|finished|completed|already did)\b/.test(lower)) {
    for (const task of currentTasks) {
      const keywords = task.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4);
      if (keywords.some((kw) => lower.includes(kw))) {
        newlyCompletedTaskIds.push(task.id);
      }
    }
  }

  const biomeId: BiomePresetId =
    parsedTime.remainingMinutes <= 60 ? 'MISTY_ZEN_STREAM' : 'SUNLIT_GLADE';

  const profile = coerceValidWorldProfile(
    {
      biomeId,
      narrativeLine: `Replanned for your ${parsedTime.remainingMinutes}-minute window. Completed work is preserved and non-fitting tasks rest for later.`,
      atmosphereNote: `${parsedTime.remainingMinutes}m remaining window • Calm recalibration`
    },
    biomeId
  );

  return {
    remainingMinutes: parsedTime.remainingMinutes,
    newlyCompletedTaskIds,
    profile,
    interruptionSummary: `Updated available time to ${parsedTime.remainingMinutes} minutes based on your note.`
  };
}


// =====================================================================
// AI Studio Focus Living Village Heuristic Extensions
// =====================================================================
import type {
  FocusTask,
  TaskCategory as VillageTaskCategory,
  WorldProfile as VillageWorldProfile
} from '@/types/focus';

const CATEGORY_CYCLE: readonly VillageTaskCategory[] = [
  'GUILD_WORKSHOP',
  'MILL_GRANARY',
  'SCHOLAR_TOWER',
  'MARKET_HEARTH',
  'APOTHECARY_COTTAGE',
  'MEADOW_PAVILION'
];

export function inferCategoryFromTitle(title: string, idx: number): VillageTaskCategory {
  const lower = title.toLowerCase();
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
  if (
    /\b(build|code|coding|software|dev|program|programming|engineer|engineering|write|writing|essay|draft|report|assignment|project|design|finish|ship|carpenter|wood)\b/.test(
      lower
    )
  ) {
    return 'GUILD_WORKSHOP';
  }
  return CATEGORY_CYCLE[idx % CATEGORY_CYCLE.length];
}

export function extractMinutesFromGoalClause(clause: string): {
  minutes: number;
  confirmed: boolean;
} {
  const hrMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i);
  if (hrMatch) {
    return {
      minutes: Math.max(10, Math.min(360, Math.round(parseFloat(hrMatch[1]) * 60))),
      confirmed: true
    };
  }
  if (/\b(?:half\s+an?\s+hour)\b/i.test(clause)) {
    return { minutes: 30, confirmed: true };
  }
  if (/\ban?\s+hour\b/i.test(clause)) {
    return { minutes: 60, confirmed: true };
  }
  const minMatch = clause.match(/(\d+)\s*(?:minutes?|mins?|m\b)/i);
  if (minMatch) {
    return {
      minutes: Math.max(10, Math.min(360, parseInt(minMatch[1], 10))),
      confirmed: true
    };
  }

  // Sensible estimates when not explicitly stated
  const lower = clause.toLowerCase();
  if (/walk|stroll|rest|meditate|breathe/.test(lower)) {
    return { minutes: 25, confirmed: false };
  }
  if (/call|phone|email|chat|message|quick/.test(lower)) {
    return { minutes: 20, confirmed: false };
  }
  if (/cook|bake|meal|dinner|lunch/.test(lower)) {
    return { minutes: 35, confirmed: false };
  }
  if (/study|assignment|project|deep|report|code|build/.test(lower)) {
    return { minutes: 50, confirmed: false };
  }
  if (/gym|workout|run|lift|exercise/.test(lower)) {
    return { minutes: 45, confirmed: false };
  }
  return { minutes: 30, confirmed: false };
}

/**
 * Deterministic natural-language goal parser used when offline or as a baseline validator.
 */
export function parseGoalsDeterministically(rawPrompt: string): {
  tasks: FocusTask[];
  worldProfile: VillageWorldProfile;
} {
  const cleaned = rawPrompt.trim();

  // Normalize bullet points, newlines, sentences, and connectors
  const normalized = cleaned
    .replace(/(?:\r\n|\r|\n)+/g, '\n')
    .replace(/(?:^|\s+)(?:\d+[\.\)\-]|[-*•])\s+/g, ' | ')
    .replace(/\s*\.\s+(?=[A-Z0-9])/g, ' | ')
    .replace(/\s*;\s*/g, ' | ')
    .replace(/\s*,\s*(?:and\s+)?/gi, ' | ')
    .replace(/\s*\b(?:and\s+then|then|after\s+that|afterwards|also)\b\s*/gi, ' | ');

  const rawSegments = normalized
    .split(/\s*\|\s*/)
    .map((s) => s.replace(/^(?:and|also|plus|then|next|after\s+that)\s+/i, '').trim())
    .filter((s) => s.length >= 3 && !/^(?:today|goals?|plans?|schedule)$/i.test(s))
    .slice(0, 10);

  const finalSegments =
    rawSegments.length > 0
      ? rawSegments
      : [
          'Study for an hour',
          'Finish my assignment (45m)',
          'Go for a golden-hour walk (25m)',
          'Call my friend (20m)'
        ];

  const now = Date.now();
  const tasks: FocusTask[] = finalSegments.map((seg, idx) => {
    const { minutes, confirmed } = extractMinutesFromGoalClause(seg);
    const cleanTitle = seg
      .replace(/\b(?:for\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/gi, '')
      .replace(/\b(?:for\s+)?(?:an?|one)\s+hour\b/gi, '')
      .replace(/\b(?:for\s+)?half\s+an?\s+hour\b/gi, '')
      .replace(/\(\s*\d+\s*(?:m(?:in)?|h(?:r)?)\s*\)/gi, '')
      .replace(/^[\d\.\)\-\*\•\s]+/, '')
      .trim();

    const formattedTitle =
      (cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)) ||
      `Village Goal ${idx + 1}`;

    const priority: 1 | 2 | 3 | 4 | 5 =
      idx === 0 ? 5 : idx === 1 ? 4 : idx === 2 ? 3 : 2;

    return {
      id: `task-${idx + 1}`,
      title: formattedTitle,
      description: `Village construction goal parsed from: "${seg}"`,
      estimatedMinutes: minutes,
      isDurationConfirmed: confirmed,
      priority,
      category: inferCategoryFromTitle(formattedTitle, idx),
      isHardDeadline: idx === 0 || /urgent|deadline|due|assignment/i.test(seg),
      isFixedAppointment: /appointment|meeting|class|call at/i.test(seg),
      dependencies: [],
      status: 'scheduled',
      source: 'user',
      createdAt: now + idx
    };
  });

  const worldProfile: VillageWorldProfile = {
    biomePreset: 'GOLDEN_VALE',
    soundscapePreset: 'MORNING_BIRDS_BREEZE',
    sunElevationDeg: 28,
    narrativeLine:
      'Golden-hour light warms the half-timbered rooftops as telekinetic builders raise your village.',
    villagerStewardGreeting:
      'We framed your goals into living timber and stone! Follow the glowing golden path to your first building.'
  };

  return { tasks, worldProfile };
}

/**
 * Extracts remaining minutes from an interruption statement (e.g. "I only have 45 minutes left").
 */
export function parseInterruptionMinutes(
  interruptionText: string,
  fallbackMinutes = 45
): number {
  const { minutes, confirmed } = extractMinutesFromGoalClause(interruptionText);
  return confirmed ? minutes : fallbackMinutes;
}

/**
 * Calculates transparent token usage and estimated USD cost for judge inspection.
 */
export function estimateInferenceCostUsd(
  promptTokens: number,
  completionTokens: number,
  provider: 'AMD_TOKEN_FACTORY' | 'GEMINI_SERVER' | 'DETERMINISTIC_FALLBACK'
): number {
  if (provider === 'DETERMINISTIC_FALLBACK') return 0;
  // ~ $0.15 per 1M input tokens, $0.60 per 1M output tokens representative cloud GPU rate
  const cost = (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000;
  return Number(cost.toFixed(6));
}
