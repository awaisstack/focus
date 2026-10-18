import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIOS } from '@/presets/demoScenarios';
import {
  parseSnapshotFromJson,
  serializeSnapshotToJson
} from '@/core/persistence/dbAdapter';
import { validateAndMigrateSnapshot } from '@/core/persistence/migrations';
import { CURRENT_STORAGE_SCHEMA_VERSION } from '@/types/persistence';

describe('Phase 5 — Versioned Local Persistence & Schema Migration', () => {
  const scenarioA = DEMO_SCENARIOS.SCENARIO_A_STUDY_DAY;

  it('serializes and restores a valid PersistedSanctuarySnapshot losslessly', () => {
    const rawSnapshot = {
      schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
      savedAt: '2026-10-17T10:00:00.000Z',
      activeScenarioId: scenarioA.id,
      worldSeed: scenarioA.worldSeed,
      availableMinutes: scenarioA.availableMinutes,
      profile: scenarioA.profile,
      tasks: scenarioA.tasks,
      planDiff: [],
      undoSnapshots: [],
      isAudioMuted: false,
      reducedMotion: true,
      telemetryHistory: []
    };

    const json = serializeSnapshotToJson(rawSnapshot);
    const restored = parseSnapshotFromJson(json);

    expect(restored.wasMigrated).toBe(false);
    expect(restored.snapshot).not.toBeNull();
    expect(restored.snapshot?.worldSeed).toBe(scenarioA.worldSeed);
    expect(restored.snapshot?.tasks).toHaveLength(4);
    expect(restored.snapshot?.reducedMotion).toBe(true);
  });

  it('migrates legacy schemaVersion 0 snapshots and coerces invalid biome tokens safely', () => {
    const legacySnapshot = {
      schemaVersion: 0,
      worldSeed: 'legacy-seed-2025',
      availableMinutes: 120,
      profile: {
        biomeId: 'INVALID_OLD_BIOME',
        soundscapeId: 'INVALID_OLD_SOUND'
      },
      tasks: [
        {
          id: 't1',
          title: 'Legacy study task',
          estimatedMinutes: 45,
          priority: 4
        }
      ]
    };

    const result = validateAndMigrateSnapshot(legacySnapshot);
    expect(result.wasMigrated).toBe(true);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.schemaVersion).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(result.snapshot?.profile.biomeId).toBe('SUNLIT_GLADE');
    expect(result.snapshot?.tasks[0].title).toBe('Legacy study task');
  });

  it('rejects corrupt JSON strings or snapshots with zero valid tasks gracefully without throwing', () => {
    const corruptJsonResult = parseSnapshotFromJson('{not-valid-json');
    expect(corruptJsonResult.snapshot).toBeNull();
    expect(corruptJsonResult.diagnosticWarning).toContain('Invalid JSON');

    const emptyTasksResult = validateAndMigrateSnapshot({
      schemaVersion: 1,
      tasks: []
    });
    expect(emptyTasksResult.snapshot).toBeNull();
  });
});
