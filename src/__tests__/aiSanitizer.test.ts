import { describe, expect, it } from 'vitest';
import {
  extractFirstJsonObject,
  parseAndValidateLlmPlanOutput,
  parseAndValidateLlmReplanOutput,
  stripThinkBlocksAndFences
} from '@/core/ai/jsonSanitizer';
import {
  buildHeuristicPlanProposal,
  buildHeuristicReplanProposal
} from '@/core/ai/heuristicFallback';
import {
  buildTokenUsage,
  calculateExperienceCost
} from '@/core/ai/costCalculator';

describe('Phase 4 — AMD AI Output Sanitizer, Heuristic Fallback & Cost Accounting', () => {
  it('strips <think>...</think> blocks and markdown code fences from reasoning models (e.g., Qwen3.8-Flash-Next)', () => {
    const rawModelOutput = `<think>
The user wants to study for 60 minutes and go for a walk.
Let me structure this into tasks and select SUNLIT_GLADE.
</think>
\`\`\`json
{
  "tasks": [
    {
      "id": "task-study",
      "title": "Study for 60 minutes",
      "estimatedMinutes": 60,
      "priority": 5,
      "category": "STUDY"
    }
  ],
  "profile": {
    "biomeId": "SUNLIT_GLADE",
    "soundscapeId": "MORNING_BREEZE",
    "narrativeLine": "Morning light filters across the glade."
  },
  "clarifyingQuestion": null
}
\`\`\`
Here is your requested JSON!`;

    const stripped = stripThinkBlocksAndFences(rawModelOutput);
    expect(stripped).not.toContain('<think>');

    const extracted = extractFirstJsonObject(rawModelOutput);
    const validated = parseAndValidateLlmPlanOutput({
      rawContent: extracted,
      availableMinutes: 180
    });

    expect(validated.tasks).toHaveLength(1);
    expect(validated.tasks[0].title).toBe('Study for 60 minutes');
    expect(validated.tasks[0].estimatedMinutes).toBe(60);
    expect(validated.profile.biomeId).toBe('SUNLIT_GLADE');
  });

  it('coerces unknown or hallucinated biome tokens into safe whitelisted WorldProfile tokens', () => {
    const rawWithInvalidTokens = JSON.stringify({
      tasks: [
        {
          id: 't1',
          title: 'Write project summary',
          estimatedMinutes: 45,
          priority: 4,
          category: 'WRITING'
        }
      ],
      profile: {
        biomeId: 'CYBERPUNK_MARS_DESERT', // Invalid token — should coerce safely
        soundscapeId: 'HEAVY_METAL_SYNTH', // Invalid token — should coerce safely
        narrativeLine: 'A quiet afternoon for writing.'
      }
    });

    const validated = parseAndValidateLlmPlanOutput({
      rawContent: rawWithInvalidTokens,
      availableMinutes: 120
    });

    expect(validated.profile.biomeId).toBe('SUNLIT_GLADE');
    expect(validated.profile.soundscapeId).toBe('MORNING_BREEZE');
  });

  it('validates replan JSON and filters out nonexistent newlyCompletedTaskIds', () => {
    const rawReplan = JSON.stringify({
      remainingMinutes: 45,
      newlyCompletedTaskIds: ['task-study-1h', 'fake-hallucinated-id'],
      interruptionSummary: '45 minutes remain today.',
      profile: {
        biomeId: 'MISTY_ZEN_STREAM',
        soundscapeId: 'JADE_RAIN_STREAM'
      }
    });

    const result = parseAndValidateLlmReplanOutput({
      rawContent: rawReplan,
      validTaskIds: ['task-study-1h', 'task-finish-assignment']
    });

    expect(result.remainingMinutes).toBe(45);
    expect(result.newlyCompletedTaskIds).toEqual(['task-study-1h']);
    expect(result.profile.biomeId).toBe('MISTY_ZEN_STREAM');
  });

  it('decomposes natural-language goals deterministically when running in local heuristic fallback mode', () => {
    const fallback = buildHeuristicPlanProposal({
      promptText:
        'Study for an hour, finish my assignment, go for a walk, and call my friend.',
      availableMinutes: 210
    });

    expect(fallback.tasks).toHaveLength(4);
    expect(fallback.tasks[0].category).toBe('STUDY');
    expect(fallback.tasks[0].estimatedMinutes).toBe(60);
    expect(fallback.tasks[1].category).toBe('WRITING');
    // Verify automatic prerequisite inference between Study and Assignment
    expect(fallback.tasks[1].dependencies).toContain(fallback.tasks[0].id);
  });

  it('parses interruption constraints and completed tasks in local heuristic replan mode', () => {
    const replanFallback = buildHeuristicReplanProposal({
      interruptionText:
        'I already finished study core material, and I only have 45 minutes left now.',
      currentAvailableMinutes: 210,
      currentTasks: [
        { id: 'task-1', title: 'Study core material', status: 'scheduled' },
        { id: 'task-2', title: 'Finish my assignment', status: 'scheduled' }
      ]
    });

    expect(replanFallback.remainingMinutes).toBe(45);
    expect(replanFallback.newlyCompletedTaskIds).toContain('task-1');
    expect(replanFallback.profile.biomeId).toBe('MISTY_ZEN_STREAM');
  });

  it('computes transparent token usage and unit-economics cost breakdown', () => {
    const usage = buildTokenUsage({
      rawUsage: {
        prompt_tokens: 650,
        completion_tokens: 350,
        total_tokens: 1000
      },
      promptText: 'Sample prompt',
      completionText: 'Sample response'
    });

    expect(usage.isEstimated).toBe(false);
    expect(usage.totalTokens).toBe(1000);

    const cost = calculateExperienceCost(usage);
    expect(cost.hackathonBilledUsd).toBe(0);
    // (650 * 0.20 + 350 * 0.60) / 1,000,000 = 0.000340 USD
    expect(cost.estimatedProductionExperienceUsd).toBe(0.00034);
    // 0.00034 * 75 calls/month = 0.0255 USD/month
    expect(cost.estimatedMonthlyActiveUserUsd).toBe(0.0255);
  });
});