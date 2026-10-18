import type { AiCostBreakdown, AiTokenUsage } from '@/types/ai';

/**
 * Reference open-weights production hosting rates on cloud AMD Instinct GPUs:
 * - $0.20 USD per 1,000,000 prompt tokens
 * - $0.60 USD per 1,000,000 completion tokens
 * Assumption for Monthly Active User (MAU): 3 calls/day * 25 active days/month = 75 calls/month.
 */
export const PRODUCTION_INPUT_COST_PER_1M_USD = 0.2;
export const PRODUCTION_OUTPUT_COST_PER_1M_USD = 0.6;
export const ASSUMED_CALLS_PER_USER_MONTH = 75;

export function estimateTokenCountFromText(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

export function buildTokenUsage(params: {
  rawUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  promptText: string;
  completionText: string;
}): AiTokenUsage {
  const { rawUsage, promptText, completionText } = params;

  if (
    rawUsage &&
    typeof rawUsage.prompt_tokens === 'number' &&
    typeof rawUsage.completion_tokens === 'number'
  ) {
    const promptTokens = rawUsage.prompt_tokens;
    const completionTokens = rawUsage.completion_tokens;
    const totalTokens =
      typeof rawUsage.total_tokens === 'number'
        ? rawUsage.total_tokens
        : promptTokens + completionTokens;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      isEstimated: false
    };
  }

  const promptTokens = estimateTokenCountFromText(promptText) + 180; // includes system prompt
  const completionTokens = estimateTokenCountFromText(completionText);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    isEstimated: true
  };
}

export function calculateExperienceCost(
  usage: AiTokenUsage
): AiCostBreakdown {
  const inputCostUsd =
    (usage.promptTokens / 1_000_000) * PRODUCTION_INPUT_COST_PER_1M_USD;
  const outputCostUsd =
    (usage.completionTokens / 1_000_000) * PRODUCTION_OUTPUT_COST_PER_1M_USD;

  const estimatedProductionExperienceUsd = Number(
    (inputCostUsd + outputCostUsd).toFixed(6)
  );
  const estimatedMonthlyActiveUserUsd = Number(
    (estimatedProductionExperienceUsd * ASSUMED_CALLS_PER_USER_MONTH).toFixed(4)
  );

  return {
    hackathonBilledUsd: 0,
    estimatedProductionExperienceUsd,
    estimatedMonthlyActiveUserUsd,
    assumptionsSummary:
      'Shared AMD Token Factory endpoint is $0.00 billed during hackathon (quota-governed). Production estimate assumes $0.20/1M input + $0.60/1M output tokens across 75 calls/user/month (3 calls/day × 25 days).'
  };
}
