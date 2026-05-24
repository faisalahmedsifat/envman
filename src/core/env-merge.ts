import type { EnvEntry, ParsedEnvFile } from "./env-parse.js";

export interface MergeConflict {
  key: string;
  localValue: string;
  savedValue: string;
}

export interface MergeResult {
  mergedEntries: EnvEntry[];
  addedKeys: string[];
  unchangedKeys: string[];
  preservedLocalKeys: string[];
  conflicts: MergeConflict[];
}

export function mergeEnvFiles(saved: ParsedEnvFile, local: ParsedEnvFile): MergeResult {
  const mergedEntries: EnvEntry[] = [];
  const addedKeys: string[] = [];
  const unchangedKeys: string[] = [];
  const preservedLocalKeys: string[] = [];
  const conflicts: MergeConflict[] = [];

  for (const localEntry of local.entries) {
    const savedValue = saved.byKey.get(localEntry.key);
    if (savedValue === undefined) {
      mergedEntries.push(localEntry);
      preservedLocalKeys.push(localEntry.key);
      continue;
    }

    if (savedValue === localEntry.value) {
      mergedEntries.push(localEntry);
      unchangedKeys.push(localEntry.key);
      continue;
    }

    mergedEntries.push(localEntry);
    conflicts.push({
      key: localEntry.key,
      localValue: localEntry.value,
      savedValue
    });
  }

  const localKeys = new Set(local.entries.map((entry) => entry.key));
  for (const savedEntry of saved.entries) {
    if (localKeys.has(savedEntry.key)) {
      continue;
    }
    mergedEntries.push(savedEntry);
    addedKeys.push(savedEntry.key);
  }

  return {
    mergedEntries,
    addedKeys,
    unchangedKeys,
    preservedLocalKeys,
    conflicts
  };
}
