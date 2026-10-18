import { z } from 'zod';
import {
  MAX_AVAILABLE_MINUTES,
  MIN_AVAILABLE_MINUTES,
  TaskCategorySchema
} from './taskSchemas';
import { BiomePresetIdSchema, SoundscapePresetIdSchema } from './worldSchemas';

/**
 * Incoming client request validation for POST /api/ai/plan
 */
export const AiPlanRequestSchema = z.object({
  promptText: z
    .string()
    .trim()
    .min(3, 'Please describe at least one goal or task.')
    .max(1200, 'Goal description must be 1,200 characters or fewer.'),
  availableMinutes: z
    .number()
    .int()
    .min(MIN_AVAILABLE_MINUTES)
    .max(MAX_AVAILABLE_MINUTES)
    .default(210),
  preferredBiomeId: BiomePresetIdSchema.optional(),
  forceRefresh: z.boolean().optional().default(false)
});

/**
 * Incoming client request validation for POST /api/ai/replan
 */
export const AiReplanRequestSchema = z.object({
  interruptionText: z
    .string()
    .trim()
    .min(2, 'Please describe what changed in your day.')
    .max(800, 'Interruption note must be 800 characters or fewer.'),
  currentAvailableMinutes: z
    .number()
    .int()
    .min(MIN_AVAILABLE_MINUTES)
    .max(MAX_AVAILABLE_MINUTES)
    .default(210),
  currentTasks: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        title: z.string().trim().min(1).max(120),
        estimatedMinutes: z.number().int().min(5).max(480),
        status: z.string()
      })
    )
    .max(16)
    .default([]),
  forceRefresh: z.boolean().optional().default(false)
});

/**
 * Schema for each task proposed by the AMD-hosted LLM
 */
export const LlmProposedTaskSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(260).optional(),
  estimatedMinutes: z
    .number()
    .finite()
    .transform((n) => Math.round(Math.min(480, Math.max(5, n))))
    .catch(30),
  priority: z
    .number()
    .finite()
    .transform((n) => Math.round(Math.min(5, Math.max(1, n))))
    .catch(3),
  dependencies: z.array(z.string().trim()).optional().default([]),
  category: TaskCategorySchema.catch('GENERAL'),
  hardDeadlineOffsetMinutes: z.number().int().min(5).max(960).optional()
});

/**
 * Complete JSON contract expected from the AMD LLM on POST /api/ai/plan
 */
export const LlmPlanOutputSchema = z.object({
  tasks: z.array(LlmProposedTaskSchema).min(1).max(8),
  profile: z
    .object({
      biomeId: z.string().optional(),
      soundscapeId: z.string().optional(),
      narrativeLine: z.string().trim().max(220).optional(),
      atmosphereNote: z.string().trim().max(180).optional(),
      sunElevationDeg: z.number().optional(),
      fogDensity: z.number().optional()
    })
    .optional(),
  clarifyingQuestion: z.string().trim().max(200).nullable().optional()
});

/**
 * Complete JSON contract expected from the AMD LLM on POST /api/ai/replan
 */
export const LlmReplanOutputSchema = z.object({
  remainingMinutes: z
    .number()
    .finite()
    .transform((n) =>
      Math.round(Math.min(MAX_AVAILABLE_MINUTES, Math.max(MIN_AVAILABLE_MINUTES, n)))
    ),
  newlyCompletedTaskIds: z.array(z.string().trim()).optional().default([]),
  interruptionSummary: z.string().trim().min(3).max(220).optional(),
  profile: z
    .object({
      biomeId: z.string().optional(),
      soundscapeId: z.string().optional(),
      narrativeLine: z.string().trim().max(220).optional(),
      atmosphereNote: z.string().trim().max(180).optional(),
      sunElevationDeg: z.number().optional(),
      fogDensity: z.number().optional()
    })
    .optional()
});
