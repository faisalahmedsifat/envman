import type { ParsedEnvFile } from "./env-parse.js";

export interface KeyDiff {
  key: string;
  leftValue?: string | undefined;
  rightValue?: string | undefined;
  kind: "added" | "removed" | "changed";
}

export function diffEnvMaps(left: ParsedEnvFile, right: ParsedEnvFile): KeyDiff[] {
  const diffs: KeyDiff[] = [];
  const keys = new Set<string>([...left.byKey.keys(), ...right.byKey.keys()]);

  for (const key of [...keys].sort((a, b) => a.localeCompare(b))) {
    const leftValue = left.byKey.get(key);
    const rightValue = right.byKey.get(key);

    if (leftValue === undefined && rightValue !== undefined) {
      diffs.push({ key, rightValue, kind: "added" });
      continue;
    }

    if (leftValue !== undefined && rightValue === undefined) {
      diffs.push({ key, leftValue, kind: "removed" });
      continue;
    }

    if (leftValue !== rightValue) {
      diffs.push({ key, leftValue, rightValue, kind: "changed" });
    }
  }

  return diffs;
}
