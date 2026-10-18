import { openDB, type IDBPDatabase } from 'idb';
import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  type PersistedSanctuarySnapshot,
  type SnapshotMigrationResult
} from '@/types/persistence';
import { validateAndMigrateSnapshot } from './migrations';

const DB_NAME = 'focus-sanctuary-db';
const DB_VERSION = 1;
const STORE_NAME = 'sanctuary_snapshots';
const PRIMARY_KEY = 'active-sanctuary-v1';
const LOCAL_STORAGE_FALLBACK_KEY = 'focus_sanctuary_fallback_snapshot_v1';

let dbPromise: Promise<IDBPDatabase> | null = null;

function isBrowserWithIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Saves the current sanctuary snapshot to IndexedDB (with localStorage fallback).
 */
export async function saveSanctuarySnapshot(
  snapshot: Omit<PersistedSanctuarySnapshot, 'schemaVersion' | 'savedAt'>
): Promise<PersistedSanctuarySnapshot> {
  const fullSnapshot: PersistedSanctuarySnapshot = {
    ...snapshot,
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
    savedAt: new Date().toISOString()
  };

  if (isBrowserWithIndexedDb()) {
    try {
      const db = await getDb();
      await db.put(STORE_NAME, fullSnapshot, PRIMARY_KEY);
      return fullSnapshot;
    } catch {
      // Fall through to localStorage fallback if IndexedDB is blocked
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_FALLBACK_KEY,
        JSON.stringify(fullSnapshot)
      );
    } catch {
      // Ignore quota errors on fallback
    }
  }

  return fullSnapshot;
}

/**
 * Loads and validates the saved sanctuary snapshot from IndexedDB or fallback storage.
 */
export async function loadSanctuarySnapshot(): Promise<SnapshotMigrationResult> {
  if (isBrowserWithIndexedDb()) {
    try {
      const db = await getDb();
      const raw = await db.get(STORE_NAME, PRIMARY_KEY);
      if (raw) {
        return validateAndMigrateSnapshot(raw);
      }
    } catch {
      // Fall through to localStorage fallback
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const rawStr = window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
      if (rawStr) {
        const parsed = JSON.parse(rawStr);
        return validateAndMigrateSnapshot(parsed);
      }
    } catch {
      return {
        snapshot: null,
        wasMigrated: false,
        diagnosticWarning: 'Corrupt local fallback snapshot ignored.'
      };
    }
  }

  return {
    snapshot: null,
    wasMigrated: false,
    diagnosticWarning: null
  };
}

/**
 * Clears saved state from both IndexedDB and localStorage fallback.
 */
export async function clearSanctuarySnapshot(): Promise<void> {
  if (isBrowserWithIndexedDb()) {
    try {
      const db = await getDb();
      await db.delete(STORE_NAME, PRIMARY_KEY);
    } catch {
      // Ignore delete error
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
    } catch {
      // Ignore
    }
  }
}

export function serializeSnapshotToJson(
  snapshot: PersistedSanctuarySnapshot
): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseSnapshotFromJson(
  jsonString: string
): SnapshotMigrationResult {
  try {
    const raw = JSON.parse(jsonString);
    return validateAndMigrateSnapshot(raw);
  } catch (err) {
    return {
      snapshot: null,
      wasMigrated: false,
      diagnosticWarning:
        err instanceof Error
          ? `Invalid JSON syntax: ${err.message}`
          : 'Invalid JSON syntax.'
    };
  }
}
