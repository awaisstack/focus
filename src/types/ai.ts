import type { TaskItem } from './task';
import type { WorldProfile } from './world';

export type AiStatusCategory =
  | 'LIVE_AMD_SUCCESS'
  | 'CACHE_HIT'
  | 'FALLBACK_MISSING_KEY'
  | 'FALLBACK_AUTH_ERROR'
  | 'FALLBACK_QUOTA_429'
  | 'FALLBACK_TRANSIENT_ERROR'
  | 'FALLBACK_VALIDATION_ERROR';

export interface DiscoveredAmdModel {
  id: string;
  ownedBy?: string;
  created?: number;
  isPreferredCandidate: boolean;
  preferredRank?: number;
  supportsJsonObjectHint: boolean;
  defaultThinkingEnabledHint: boolean;
}

export interface AmdModelCatalogueSnapshot {
  fetchedAt: string;
  baseUrl: string;
  keyConfigured: boolean;
  liveFetchSucceeded: boolean;
  selectedPrimaryModel: string;
  selectedFallbackModel: string | null;
  models: DiscoveredAmdModel[];
  diagnosticNote: string;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isEstimated: boolean;
}

export interface AiCostBreakdown {
  hackathonBilledUsd: number;
  estimatedProductionExperienceUsd: number;
  estimatedMonthlyActiveUserUsd: number;
  assumptionsSummary: string;
}

export interface AiTelemetryRecord {
  requestId: string;
  timestamp: string;
  operation: 'GOAL_PLAN' | 'INTERRUPTION_REPLAN';
  endpointBaseUrl: string;
  requestedModel: string;
  activeModelUsed: string;
  statusCategory: AiStatusCategory;
  latencyMs: number;
  fallbackCount: number;
  cacheHit: boolean;
  tokenUsage: AiTokenUsage;
  cost: AiCostBreakdown;
  safeDiagnosticMessage: string;
}

export interface AiPlanProposalResponse {
  tasks: TaskItem[];
  profile: WorldProfile;
  clarifyingQuestion: string | null;
  telemetry: AiTelemetryRecord;
}

export interface AiReplanProposalResponse {
  remainingMinutes: number;
  newlyCompletedTaskIds: string[];
  profile: WorldProfile;
  interruptionSummary: string;
  telemetry: AiTelemetryRecord;
}
