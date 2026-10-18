import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  type PersistedSanctuarySnapshot,
  type SnapshotMigrationResult
} from '@/types/persistence';
import {
  MAX_AVAILABLE_MINUTES,
  MIN_AVAILABLE_MINUTES,
  validateAndNormalizeTasks
} from '@/schemas/taskSchemas';
import { coerceValidWorldProfile } from '@/schemas/worldSchemas';
import { DEMO_SCENARIOS, type DemoScenarioId } from '@/presets/demoScenarios';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function validateAndMigrateSnapshot(
  rawInput: unknown
): SnapshotMigrationResult {
  if (!isRecord(rawInput)) {
    return {
      snapshot: null,
      wasMigrated: false,
      diagnosticWarning: 'Saved state is empty or not a valid object.'
    };
  }

  const rawVersion =
    typeof rawInput.schemaVersion === 'number' ? rawInput.schemaVersion : 0;
  const wasMigrated = rawVersion < CURRENT_STORAGE_SCHEMA_VERSION;

  const rawTasks = Array.isArray(rawInput.tasks) ? rawInput.tasks : [];
  const { tasks: validatedTasks, warnings } =
    validateAndNormalizeTasks(rawTasks);

  if (validatedTasks.length === 0) {
    return {
      snapshot: null,
      wasMigrated,
      diagnosticWarning:
        'Saved snapshot contained zero valid tasks after schema validation.'
    };
  }

  const rawMins =
    typeof rawInput.availableMinutes === 'number' &&
    Number.isFinite(rawInput.availableMinutes)
      ? rawInput.availableMinutes
      : 210;

  const availableMinutes = Math.round(
    Math.min(MAX_AVAILABLE_MINUTES, Math.max(MIN_AVAILABLE_MINUTES, rawMins))
  );

  const worldSeed =
    typeof rawInput.worldSeed === 'string' &&
    rawInput.worldSeed.trim().length >= 3
      ? rawInput.worldSeed.trim()
      : DEMO_SCENARIOS.SCENARIO_A_STUDY_DAY.worldSeed;

  const activeScenarioId: DemoScenarioId =
    rawInput.activeScenarioId === 'SCENARIO_B_INTERRUPTED_45M'
      ? 'SCENARIO_B_INTERRUPTED_45M'
      : 'SCENARIO_A_STUDY_DAY';

  const profile = coerceValidWorldProfile(
    rawInput.profile,
    availableMinutes <= 60 ? 'MISTY_ZEN_STREAM' : 'SUNLIT_GLADE'
  );

  const isAudioMuted =
    typeof rawInput.isAudioMuted === 'boolean' ? rawInput.isAudioMuted : false;
  const ambientVolume =
    typeof rawInput.ambientVolume === 'number'
      ? Math.max(0, Math.min(1, rawInput.ambientVolume))
      : 0.55;
  const effectsVolume =
    typeof rawInput.effectsVolume === 'number'
      ? Math.max(0, Math.min(1, rawInput.effectsVolume))
      : 0.7;
  const reducedMotion =
    typeof rawInput.reducedMotion === 'boolean'
      ? rawInput.reducedMotion
      : false;

  const planDiff = Array.isArray(rawInput.planDiff)
    ? (rawInput.planDiff.slice(0, 16) as PersistedSanctuarySnapshot['planDiff'])
    : [];

  const undoSnapshots = Array.isArray(rawInput.undoSnapshots)
    ? (rawInput.undoSnapshots.slice(
        0,
        5
      ) as PersistedSanctuarySnapshot['undoSnapshots'])
    : [];

  const telemetryHistory = Array.isArray(rawInput.telemetryHistory)
    ? (rawInput.telemetryHistory.slice(
        0,
        15
      ) as PersistedSanctuarySnapshot['telemetryHistory'])
    : [];

  const snapshot: PersistedSanctuarySnapshot = {
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
    savedAt:
      typeof rawInput.savedAt === 'string'
        ? rawInput.savedAt
        : new Date().toISOString(),
    activeScenarioId,
    worldSeed,
    availableMinutes,
    profile,
    tasks: validatedTasks,
    planDiff,
    undoSnapshots,
    isAudioMuted,
    ambientVolume,
    effectsVolume,
    reducedMotion,
    telemetryHistory
  };

  return {
    snapshot,
    wasMigrated,
    diagnosticWarning:
      warnings.length > 0
        ? `Recovered snapshot with warnings: ${warnings.join(' | ')}`
        : wasMigrated
        ? `Migrated saved world state from schema v${rawVersion} to v${CURRENT_STORAGE_SCHEMA_VERSION}.`
        : null
  };
}
