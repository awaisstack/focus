import type { PlanDiffItem, PlanSnapshot, TaskItem } from './task';
import type { WorldProfile } from './world';
import type { AiTelemetryRecord } from './ai';
import type { DemoScenarioId } from '@/presets/demoScenarios';

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export interface PersistedSanctuarySnapshot {
  schemaVersion: number;
  savedAt: string;
  activeScenarioId: DemoScenarioId;
  worldSeed: string;
  availableMinutes: number;
  profile: WorldProfile;
  tasks: TaskItem[];
  planDiff: PlanDiffItem[];
  undoSnapshots: PlanSnapshot[];
  isAudioMuted: boolean;
  ambientVolume?: number;
  effectsVolume?: number;
  reducedMotion: boolean;
  telemetryHistory: AiTelemetryRecord[];
}

export interface SnapshotMigrationResult {
  snapshot: PersistedSanctuarySnapshot | null;
  wasMigrated: boolean;
  diagnosticWarning: string | null;
}
