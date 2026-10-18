import 'server-only';
import crypto from 'crypto';
import type {
  AiPlanProposalResponse,
  AiReplanProposalResponse,
  AiStatusCategory,
  AiTelemetryRecord,
  AmdModelCatalogueSnapshot,
  DiscoveredAmdModel
} from '@/types/ai';
import type { BiomePresetId } from '@/types/world';
import {
  AmdApiClientError,
  callAmdChatCompletion,
  fetchAmdModelsFromServer,
  getAmdServerConfig
} from './amdClient';
import {
  parseAndValidateLlmPlanOutput,
  parseAndValidateLlmReplanOutput
} from './jsonSanitizer';
import {
  buildHeuristicPlanProposal,
  buildHeuristicReplanProposal
} from './heuristicFallback';
import { buildTokenUsage, calculateExperienceCost } from './costCalculator';

const CATALOGUE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PROMPT_CACHE_ENTRIES = 100;

let cachedCatalogue: {
  expiresAt: number;
  snapshot: AmdModelCatalogueSnapshot;
} | null = null;

const normalizedPlanCache = new Map<string, AiPlanProposalResponse>();
const normalizedReplanCache = new Map<string, AiReplanProposalResponse>();

function computeRequestHash(payload: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 24);
}

/**
 * Matches preferred model names (e.g., Gemma-4-31B-IT, DeepSeek-V4.1-Flash, Qwen3.8-Flash-Next)
 * against the live /models catalogue IDs (case-insensitive exact or suffix match).
 */
function annotateDiscoveredModels(
  rawModels: Array<{ id: string; owned_by?: string; created?: number }>,
  preferredList: string[]
): DiscoveredAmdModel[] {
  return rawModels.map((raw) => {
    const lowerId = raw.id.toLowerCase();
    let matchedRank: number | undefined;

    for (let i = 0; i < preferredList.length; i++) {
      const prefLower = preferredList[i].toLowerCase();
      if (
        lowerId === prefLower ||
        lowerId.endsWith(`/${prefLower}`) ||
        lowerId.includes(prefLower)
      ) {
        matchedRank = i + 1;
        break;
      }
    }

    return {
      id: raw.id,
      ownedBy: raw.owned_by,
      created: raw.created,
      isPreferredCandidate: matchedRank !== undefined,
      preferredRank: matchedRank,
      supportsJsonObjectHint: lowerId.includes('deepseek'),
      defaultThinkingEnabledHint: lowerId.includes('qwen')
    };
  });
}

/**
 * Discovers live models from AMD Token Factory /models endpoint and caches for 5 minutes.
 */
export async function getDiscoveredModelCatalogue(
  forceRefresh = false
): Promise<AmdModelCatalogueSnapshot> {
  const now = Date.now();
  if (!forceRefresh && cachedCatalogue && cachedCatalogue.expiresAt > now) {
    return cachedCatalogue.snapshot;
  }

  const config = getAmdServerConfig();
  const defaultPrimary = config.preferredModels[0] ?? 'Gemma-4-31B-IT';
  const defaultFallback = config.preferredModels[1] ?? 'DeepSeek-V4.1-Flash';

  if (!config.apiKey) {
    const unconfiguredSnapshot: AmdModelCatalogueSnapshot = {
      fetchedAt: new Date().toISOString(),
      baseUrl: config.baseUrl,
      keyConfigured: false,
      liveFetchSucceeded: false,
      selectedPrimaryModel: defaultPrimary,
      selectedFallbackModel: defaultFallback,
      models: config.preferredModels.map((id, idx) => ({
        id,
        ownedBy: 'amd-token-factory-candidate',
        isPreferredCandidate: true,
        preferredRank: idx + 1,
        supportsJsonObjectHint: id.toLowerCase().includes('deepseek'),
        defaultThinkingEnabledHint: id.toLowerCase().includes('qwen')
      })),
      diagnosticNote:
        'AMD_TOKEN_FACTORY_API_KEY is not set in .env.local. Running in deterministic local fallback mode until configured.'
    };
    return unconfiguredSnapshot;
  }

  try {
    const { models: rawModels } = await fetchAmdModelsFromServer();
    const annotated = annotateDiscoveredModels(
      rawModels,
      config.preferredModels
    );

    // Order matched preferred candidates by their priority rank
    const rankedCandidates = annotated
      .filter((m) => m.isPreferredCandidate)
      .sort((a, b) => (a.preferredRank ?? 99) - (b.preferredRank ?? 99));

    const selectedPrimaryModel =
      rankedCandidates[0]?.id ?? annotated[0]?.id ?? defaultPrimary;
    const selectedFallbackModel =
      rankedCandidates[1]?.id ??
      annotated.find((m) => m.id !== selectedPrimaryModel)?.id ??
      null;

    const snapshot: AmdModelCatalogueSnapshot = {
      fetchedAt: new Date().toISOString(),
      baseUrl: config.baseUrl,
      keyConfigured: true,
      liveFetchSucceeded: true,
      selectedPrimaryModel,
      selectedFallbackModel,
      models: annotated,
      diagnosticNote: `Discovered ${annotated.length} live models from AMD Token Factory. Primary: ${selectedPrimaryModel}.`
    };

    cachedCatalogue = {
      expiresAt: now + CATALOGUE_CACHE_TTL_MS,
      snapshot
    };

    return snapshot;
  } catch (err) {
    const diagnosticNote =
      err instanceof Error
        ? `Live /models check failed (${err.message}); using configured model priority.`
        : 'Live /models check failed; using configured model priority.';

    return {
      fetchedAt: new Date().toISOString(),
      baseUrl: config.baseUrl,
      keyConfigured: true,
      liveFetchSucceeded: false,
      selectedPrimaryModel: defaultPrimary,
      selectedFallbackModel: defaultFallback,
      models: config.preferredModels.map((id, idx) => ({
        id,
        ownedBy: 'configured-candidate',
        isPreferredCandidate: true,
        preferredRank: idx + 1,
        supportsJsonObjectHint: id.toLowerCase().includes('deepseek'),
        defaultThinkingEnabledHint: id.toLowerCase().includes('qwen')
      })),
      diagnosticNote
    };
  }
}

const PLAN_SYSTEM_PROMPT = `You are the Focus Sanctuary Planning & Atmosphere Architect running on AMD infrastructure.
Convert the user's natural-language goals into a structured JSON object with:
1. "tasks": array of 1 to 8 actionable, clearly divided tasks. Each task must have:
   - "id": short slug like "task-1", "task-2", etc.
   - "title": concise, inspiring action title (e.g., "Deep Study & Notes", "Build Frontend Features", "Prepare Wholesome Dinner", "Sunset Walk")
   - "description": 1 brief sentence explaining the goal and focus (max 160 chars)
   - "estimatedMinutes": integer between 10 and 240 extracted from user's stated durations or sensibly estimated
   - "priority": integer 1 (lowest) to 5 (highest)
   - "dependencies": array of prerequisite task "id" strings from this same list (only when strictly sequential)
   - "category": assign the single best fitting Village Guild Archetype:
     * "SCHOLAR_TOWER" (for study, reading, learning, research, exam prep, coursework, notes)
     * "GUILD_WORKSHOP" (for coding, programming, software dev, engineering, building, crafting, writing, projects)
     * "MILL_GRANARY" (for cooking, baking, meals, dinner, lunch, grocery shopping, eating, food, nutrition)
     * "MARKET_HEARTH" (for calls, phone, meetings, emails, talking to friends/family, social, networking)
     * "APOTHECARY_COTTAGE" (for workout, gym, exercise, fitness, health, cleaning, laundry, chores, fixing)
     * "MEADOW_PAVILION" (for walking, outdoors, fresh air, park, nature, stretching, meditation, breaks, relaxing)
2. "profile": constrained world profile object:
   - "biomeId": one of ["SUNLIT_GLADE", "GOLDEN_MEADOW", "MISTY_ZEN_STREAM", "TWILIGHT_GROVE"]
   - "soundscapeId": one of ["MORNING_BREEZE", "AMBER_STILLNESS", "JADE_RAIN_STREAM", "TWILIGHT_CRICKETS"]
   - "narrativeLine": 1 peaceful, inspiring sentence describing the valley landscape and your first goal (max 160 chars)
   - "atmosphereNote": brief summary of time budget and mood (max 120 chars)
   - "sunElevationDeg": integer 18 to 65
   - "fogDensity": float 0.008 to 0.025
3. "clarifyingQuestion": null

Return ONLY valid raw JSON matching this structure. Do not wrap in markdown or add prose outside the JSON.`;

const REPLAN_SYSTEM_PROMPT = `You are the Focus Sanctuary Interruption Replanner running on AMD infrastructure.
Given the user's current task list and their interruption statement (e.g., "I only have 45 minutes now"), output a JSON object with:
1. "remainingMinutes": integer between 10 and 480 representing their updated available time window.
2. "newlyCompletedTaskIds": array of task IDs from the provided list that the user explicitly says they already completed.
3. "interruptionSummary": 1 calm, non-judgmental sentence summarizing the constraint adjustment.
4. "profile": constrained world profile object:
   - "biomeId": choose "MISTY_ZEN_STREAM" if remainingMinutes <= 60, else one of ["SUNLIT_GLADE", "GOLDEN_MEADOW", "MISTY_ZEN_STREAM", "TWILIGHT_GROVE"]
   - "soundscapeId": one of ["MORNING_BREEZE", "AMBER_STILLNESS", "JADE_RAIN_STREAM", "TWILIGHT_CRICKETS"]
   - "narrativeLine": 1 reassuring sentence guiding focus to the single next step.
   - "atmosphereNote": brief summary of the adjusted window.

Return ONLY valid raw JSON. Do not include markdown fences or extra text.`;

/**
 * Executes a single-call AMD inference for Goal Capture -> Task Proposal + World Profile,
 * with normalized caching, bounded fallback, and deterministic local recovery.
 */
export async function routeGoalPlanGeneration(params: {
  promptText: string;
  availableMinutes: number;
  preferredBiomeId?: BiomePresetId;
  forceRefresh?: boolean;
}): Promise<AiPlanProposalResponse> {
  const startTime = Date.now();
  const requestId = `req-plan-${Date.now().toString(36)}`;
  const config = getAmdServerConfig();

  const cacheKey = computeRequestHash({
    op: 'PLAN',
    prompt: params.promptText.trim().toLowerCase(),
    mins: params.availableMinutes,
    biome: params.preferredBiomeId ?? 'AUTO'
  });

  if (!params.forceRefresh && normalizedPlanCache.has(cacheKey)) {
    const cached = normalizedPlanCache.get(cacheKey)!;
    return {
      ...cached,
      telemetry: {
        ...cached.telemetry,
        requestId,
        timestamp: new Date().toISOString(),
        statusCategory: 'CACHE_HIT',
        latencyMs: Date.now() - startTime,
        cacheHit: true,
        safeDiagnosticMessage: `Normalized cache hit for model ${cached.telemetry.activeModelUsed} (0 quota points consumed).`
      }
    };
  }

  const catalogue = await getDiscoveredModelCatalogue();
  const candidateModels = [
    catalogue.selectedPrimaryModel,
    catalogue.selectedFallbackModel
  ].filter((m): m is string => Boolean(m));

  // If no API key is configured, immediately use deterministic heuristic parser
  if (!config.apiKey) {
    const fallbackResult = buildHeuristicPlanProposal(params);
    const usage = buildTokenUsage({
      promptText: params.promptText,
      completionText: JSON.stringify(fallbackResult)
    });
    return {
      ...fallbackResult,
      telemetry: {
        requestId,
        timestamp: new Date().toISOString(),
        operation: 'GOAL_PLAN',
        endpointBaseUrl: config.baseUrl,
        requestedModel: catalogue.selectedPrimaryModel,
        activeModelUsed: 'local-deterministic-heuristic',
        statusCategory: 'FALLBACK_MISSING_KEY',
        latencyMs: Date.now() - startTime,
        fallbackCount: 0,
        cacheHit: false,
        tokenUsage: usage,
        cost: calculateExperienceCost(usage),
        safeDiagnosticMessage:
          'AMD_TOKEN_FACTORY_API_KEY not set in .env.local; generated plan via deterministic local parser.'
      }
    };
  }

  const userPrompt = JSON.stringify({
    goalDescription: params.promptText,
    availableMinutesToday: params.availableMinutes,
    preferredBiomeId: params.preferredBiomeId ?? 'AUTO'
  });

  let fallbackCount = 0;
  let lastStatusCategory: AiStatusCategory = 'FALLBACK_TRANSIENT_ERROR';
  let lastDiagnostic = '';

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    if (i > 0) fallbackCount++;

    const useJsonFormat = modelName.toLowerCase().includes('deepseek');

    try {
      let rawResponse;
      try {
        rawResponse = await callAmdChatCompletion({
          model: modelName,
          systemPrompt: PLAN_SYSTEM_PROMPT,
          userPrompt,
          useJsonObjectResponseFormat: useJsonFormat
        });
      } catch (innerErr) {
        // If 400 Bad Request occurred while sending response_format, retry once without it
        if (
          innerErr instanceof AmdApiClientError &&
          innerErr.category === 'BAD_REQUEST_400' &&
          useJsonFormat
        ) {
          rawResponse = await callAmdChatCompletion({
            model: modelName,
            systemPrompt: PLAN_SYSTEM_PROMPT,
            userPrompt,
            useJsonObjectResponseFormat: false
          });
        } else {
          throw innerErr;
        }
      }

      const validated = parseAndValidateLlmPlanOutput({
        rawContent: rawResponse.content,
        availableMinutes: params.availableMinutes,
        preferredBiomeId: params.preferredBiomeId
      });

      const tokenUsage = buildTokenUsage({
        rawUsage: rawResponse.usage,
        promptText: userPrompt,
        completionText: rawResponse.content
      });

      const telemetry: AiTelemetryRecord = {
        requestId,
        timestamp: new Date().toISOString(),
        operation: 'GOAL_PLAN',
        endpointBaseUrl: config.baseUrl,
        requestedModel: catalogue.selectedPrimaryModel,
        activeModelUsed: rawResponse.modelUsed,
        statusCategory: 'LIVE_AMD_SUCCESS',
        latencyMs: Date.now() - startTime,
        fallbackCount,
        cacheHit: false,
        tokenUsage,
        cost: calculateExperienceCost(tokenUsage),
        safeDiagnosticMessage: `Live AMD inference succeeded with ${rawResponse.modelUsed} in ${
          Date.now() - startTime
        }ms.`
      };

      const finalResponse: AiPlanProposalResponse = {
        ...validated,
        telemetry
      };

      if (normalizedPlanCache.size >= MAX_PROMPT_CACHE_ENTRIES) {
        const oldestKey = normalizedPlanCache.keys().next().value;
        if (oldestKey) normalizedPlanCache.delete(oldestKey);
      }
      normalizedPlanCache.set(cacheKey, finalResponse);

      return finalResponse;
    } catch (err) {
      if (err instanceof AmdApiClientError) {
        lastDiagnostic = err.message;
        // CRITICAL POLICY: Stop immediately on 401/403 Auth Error or 429 Account Quota Exhaustion
        if (err.category === 'AUTH_401_403') {
          lastStatusCategory = 'FALLBACK_AUTH_ERROR';
          break;
        }
        if (err.category === 'QUOTA_OR_RATE_429') {
          lastStatusCategory = 'FALLBACK_QUOTA_429';
          break;
        }
        lastStatusCategory = 'FALLBACK_TRANSIENT_ERROR';
      } else {
        lastStatusCategory = 'FALLBACK_VALIDATION_ERROR';
        lastDiagnostic =
          err instanceof Error
            ? `Schema validation error on ${modelName}: ${err.message}`
            : 'Model output validation failed.';
      }
    }
  }

  // Graceful fallback to deterministic heuristic parser preserving the user's exact input
  const fallbackResult = buildHeuristicPlanProposal(params);
  const usage = buildTokenUsage({
    promptText: userPrompt,
    completionText: JSON.stringify(fallbackResult)
  });

  return {
    ...fallbackResult,
    telemetry: {
      requestId,
      timestamp: new Date().toISOString(),
      operation: 'GOAL_PLAN',
      endpointBaseUrl: config.baseUrl,
      requestedModel: catalogue.selectedPrimaryModel,
      activeModelUsed: 'local-deterministic-heuristic',
      statusCategory: lastStatusCategory,
      latencyMs: Date.now() - startTime,
      fallbackCount,
      cacheHit: false,
      tokenUsage: usage,
      cost: calculateExperienceCost(usage),
      safeDiagnosticMessage: `${lastDiagnostic} — Preserved your input using deterministic local planner.`
    }
  };
}

/**
 * Executes a single-call AMD inference for Interruption Replanning ("My plans changed"),
 * with normalized caching, bounded fallback, and deterministic local recovery.
 */
export async function routeInterruptionReplanGeneration(params: {
  interruptionText: string;
  currentAvailableMinutes: number;
  currentTasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    status: string;
  }>;
  forceRefresh?: boolean;
}): Promise<AiReplanProposalResponse> {
  const startTime = Date.now();
  const requestId = `req-replan-${Date.now().toString(36)}`;
  const config = getAmdServerConfig();

  const cacheKey = computeRequestHash({
    op: 'REPLAN',
    text: params.interruptionText.trim().toLowerCase(),
    tasks: params.currentTasks.map((t) => `${t.id}:${t.status}`)
  });

  if (!params.forceRefresh && normalizedReplanCache.has(cacheKey)) {
    const cached = normalizedReplanCache.get(cacheKey)!;
    return {
      ...cached,
      telemetry: {
        ...cached.telemetry,
        requestId,
        timestamp: new Date().toISOString(),
        statusCategory: 'CACHE_HIT',
        latencyMs: Date.now() - startTime,
        cacheHit: true,
        safeDiagnosticMessage: `Normalized replan cache hit for ${cached.telemetry.activeModelUsed} (0 quota points consumed).`
      }
    };
  }

  const catalogue = await getDiscoveredModelCatalogue();
  const candidateModels = [
    catalogue.selectedPrimaryModel,
    catalogue.selectedFallbackModel
  ].filter((m): m is string => Boolean(m));

  if (!config.apiKey) {
    const fallback = buildHeuristicReplanProposal(params);
    const usage = buildTokenUsage({
      promptText: params.interruptionText,
      completionText: JSON.stringify(fallback)
    });
    return {
      ...fallback,
      telemetry: {
        requestId,
        timestamp: new Date().toISOString(),
        operation: 'INTERRUPTION_REPLAN',
        endpointBaseUrl: config.baseUrl,
        requestedModel: catalogue.selectedPrimaryModel,
        activeModelUsed: 'local-deterministic-heuristic',
        statusCategory: 'FALLBACK_MISSING_KEY',
        latencyMs: Date.now() - startTime,
        fallbackCount: 0,
        cacheHit: false,
        tokenUsage: usage,
        cost: calculateExperienceCost(usage),
        safeDiagnosticMessage:
          'AMD_TOKEN_FACTORY_API_KEY not set in .env.local; parsed interruption constraint locally.'
      }
    };
  }

  const userPrompt = JSON.stringify({
    interruptionStatement: params.interruptionText,
    previousAvailableMinutes: params.currentAvailableMinutes,
    currentTasks: params.currentTasks
  });

  let fallbackCount = 0;
  let lastStatusCategory: AiStatusCategory = 'FALLBACK_TRANSIENT_ERROR';
  let lastDiagnostic = '';

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    if (i > 0) fallbackCount++;

    try {
      const rawResponse = await callAmdChatCompletion({
        model: modelName,
        systemPrompt: REPLAN_SYSTEM_PROMPT,
        userPrompt,
        useJsonObjectResponseFormat: modelName.toLowerCase().includes('deepseek')
      });

      const validated = parseAndValidateLlmReplanOutput({
        rawContent: rawResponse.content,
        validTaskIds: params.currentTasks.map((t) => t.id)
      });

      const tokenUsage = buildTokenUsage({
        rawUsage: rawResponse.usage,
        promptText: userPrompt,
        completionText: rawResponse.content
      });

      const telemetry: AiTelemetryRecord = {
        requestId,
        timestamp: new Date().toISOString(),
        operation: 'INTERRUPTION_REPLAN',
        endpointBaseUrl: config.baseUrl,
        requestedModel: catalogue.selectedPrimaryModel,
        activeModelUsed: rawResponse.modelUsed,
        statusCategory: 'LIVE_AMD_SUCCESS',
        latencyMs: Date.now() - startTime,
        fallbackCount,
        cacheHit: false,
        tokenUsage,
        cost: calculateExperienceCost(tokenUsage),
        safeDiagnosticMessage: `Live AMD replan inference succeeded with ${rawResponse.modelUsed} in ${
          Date.now() - startTime
        }ms.`
      };

      const finalResponse: AiReplanProposalResponse = {
        ...validated,
        telemetry
      };

      normalizedReplanCache.set(cacheKey, finalResponse);
      return finalResponse;
    } catch (err) {
      if (err instanceof AmdApiClientError) {
        lastDiagnostic = err.message;
        if (err.category === 'AUTH_401_403') {
          lastStatusCategory = 'FALLBACK_AUTH_ERROR';
          break;
        }
        if (err.category === 'QUOTA_OR_RATE_429') {
          lastStatusCategory = 'FALLBACK_QUOTA_429';
          break;
        }
        lastStatusCategory = 'FALLBACK_TRANSIENT_ERROR';
      } else {
        lastStatusCategory = 'FALLBACK_VALIDATION_ERROR';
        lastDiagnostic =
          err instanceof Error
            ? `Replan validation error on ${modelName}: ${err.message}`
            : 'Replan output validation failed.';
      }
    }
  }

  const fallback = buildHeuristicReplanProposal(params);
  const usage = buildTokenUsage({
    promptText: userPrompt,
    completionText: JSON.stringify(fallback)
  });

  return {
    ...fallback,
    telemetry: {
      requestId,
      timestamp: new Date().toISOString(),
      operation: 'INTERRUPTION_REPLAN',
      endpointBaseUrl: config.baseUrl,
      requestedModel: catalogue.selectedPrimaryModel,
      activeModelUsed: 'local-deterministic-heuristic',
      statusCategory: lastStatusCategory,
      latencyMs: Date.now() - startTime,
      fallbackCount,
      cacheHit: false,
      tokenUsage: usage,
      cost: calculateExperienceCost(usage),
      safeDiagnosticMessage: `${lastDiagnostic} — Parsed interruption constraint via deterministic local fallback.`
    }
  };
}