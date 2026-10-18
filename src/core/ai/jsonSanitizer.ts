import type { TaskItem, TaskPriority } from '@/types/task';
import type { BiomePresetId, WorldProfile } from '@/types/world';
import {
  inferTaskCategoryFromText,
  validateAndNormalizeTasks
} from '@/schemas/taskSchemas';
import { coerceValidWorldProfile } from '@/schemas/worldSchemas';
import {
  LlmPlanOutputSchema,
  LlmReplanOutputSchema
} from '@/schemas/aiSchemas';

/**
 * Removes <think>...</think> reasoning blocks emitted by reasoning-enabled models
 * (such as Qwen3.8-Flash-Next) and strips surrounding Markdown ```json fences.
 */
export function stripThinkBlocksAndFences(rawText: string): string {
  if (!rawText) return '';

  // 1. Strip complete <think>...</think> blocks (case-insensitive, multiline)
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. If an unclosed <think> tag exists before a JSON block, strip up to the first '{'
  if (/^<think>/i.test(cleaned)) {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace !== -1) {
      cleaned = cleaned.slice(firstBrace);
    }
  }

  // 3. Extract content inside ```json ... ``` or ``` ... ``` fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  return cleaned.trim();
}

/**
 * Locates the outermost balanced JSON object { ... } in a string so trailing
 * conversational commentary from a model does not break JSON.parse.
 */
export function extractFirstJsonObject(text: string): string {
  const cleaned = stripThinkBlocksAndFences(text);
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) {
    throw new Error('No JSON object opening brace found in model output.');
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return cleaned.slice(startIdx, i + 1);
        }
      }
    }
  }

  // Fallback to last closing brace if unbalanced
  const lastIdx = cleaned.lastIndexOf('}');
  if (lastIdx > startIdx) {
    return cleaned.slice(startIdx, lastIdx + 1);
  }

  throw new Error('Unbalanced JSON braces in model output.');
}

/**
 * Parses and validates the raw LLM output for POST /api/ai/plan.
 */
export function parseAndValidateLlmPlanOutput(params: {
  rawContent: string;
  availableMinutes: number;
  preferredBiomeId?: BiomePresetId;
}): {
  tasks: TaskItem[];
  profile: WorldProfile;
  clarifyingQuestion: string | null;
} {
  const jsonString = extractFirstJsonObject(params.rawContent);
  const parsedJson = JSON.parse(jsonString);
  const validated = LlmPlanOutputSchema.parse(parsedJson);

  const nowIso = new Date().toISOString();
  const rawTaskItems = validated.tasks.map((t, index) => ({
    id:
      t.id && /^[a-zA-Z0-9_-]+$/.test(t.id)
        ? t.id
        : `task-ai-${index + 1}`,
    title: t.title,
    description: t.description,
    estimatedMinutes: t.estimatedMinutes,
    isDurationConfirmed: false,
    priority: (t.priority ?? 3) as TaskPriority,
    dependencies: t.dependencies ?? [],
    hardDeadlineOffsetMinutes: t.hardDeadlineOffsetMinutes,
    category:
      t.category && t.category !== 'GENERAL'
        ? t.category
        : inferTaskCategoryFromText(t.title),
    status: 'proposed' as const,
    source: 'ai-proposal' as const,
    createdAt: nowIso,
    updatedAt: nowIso
  }));

  const { tasks: normalizedTasks } = validateAndNormalizeTasks(rawTaskItems);
  if (normalizedTasks.length === 0) {
    throw new Error('Model returned zero valid tasks after schema normalization.');
  }

  const defaultBiome: BiomePresetId =
    params.preferredBiomeId ??
    (params.availableMinutes <= 60 ? 'MISTY_ZEN_STREAM' : 'SUNLIT_GLADE');

  const profile = coerceValidWorldProfile(validated.profile, defaultBiome);

  return {
    tasks: normalizedTasks,
    profile,
    clarifyingQuestion: validated.clarifyingQuestion ?? null
  };
}

/**
 * Parses and validates the raw LLM output for POST /api/ai/replan.
 */
export function parseAndValidateLlmReplanOutput(params: {
  rawContent: string;
  validTaskIds: string[];
}): {
  remainingMinutes: number;
  newlyCompletedTaskIds: string[];
  profile: WorldProfile;
  interruptionSummary: string;
} {
  const jsonString = extractFirstJsonObject(params.rawContent);
  const parsedJson = JSON.parse(jsonString);
  const validated = LlmReplanOutputSchema.parse(parsedJson);

  const validIdSet = new Set(params.validTaskIds);
  const newlyCompletedTaskIds = (validated.newlyCompletedTaskIds ?? []).filter(
    (id) => validIdSet.has(id)
  );

  const fallbackBiome: BiomePresetId =
    validated.remainingMinutes <= 60 ? 'MISTY_ZEN_STREAM' : 'SUNLIT_GLADE';

  const profile = coerceValidWorldProfile(validated.profile, fallbackBiome);
  const interruptionSummary =
    validated.interruptionSummary ??
    `Adjusted plan for your ${validated.remainingMinutes}-minute remaining window.`;

  return {
    remainingMinutes: validated.remainingMinutes,
    newlyCompletedTaskIds,
    profile,
    interruptionSummary
  };
}
