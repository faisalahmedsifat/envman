import { promises as fs } from "node:fs";
import path from "node:path";

import { readConfig } from "../core/config.js";
import { formatEnvFile, parseEnvFile } from "../core/env-parse.js";
import { EnvmanError } from "../core/errors.js";
import { pathExists, writeFileAtomic } from "../core/fs.js";
import { readManifest } from "../core/manifest.js";
import { mergeEnvFiles } from "../core/env-merge.js";
import { resolvePassphrase } from "../core/passphrase.js";
import { loadProfile } from "../core/profile.js";

export interface FetchOptions {
  dryRun?: boolean;
  replace?: boolean;
  passphraseEnv?: string;
  scope?: string;
}

type FetchPlanItem =
  | {
      filePath: string;
      targetPath: string;
      kind: "create" | "replace";
      content: string;
    }
  | {
      filePath: string;
      targetPath: string;
      kind: "merge";
      content: string;
      addedKeys: string[];
      preservedLocalKeys: string[];
      unchangedKeys: string[];
    }
  | {
      filePath: string;
      kind: "conflict";
      conflictKeys: string[];
    };

export async function runFetch(
  repoRoot: string,
  profile: string | undefined,
  options: FetchOptions
): Promise<void> {
  const config = await readConfig(repoRoot);
  const manifest = await readManifest(repoRoot);
  const selectedProfile = profile ?? config.defaultProfile ?? manifest.defaultProfile ?? "default";
  const passphrase = await resolvePassphrase(repoRoot, { passphraseEnv: options.passphraseEnv });
  const savedProfile = await loadProfile(repoRoot, selectedProfile, passphrase);
  const plan: FetchPlanItem[] = [];

  for (const savedFile of savedProfile.files) {
    if (options.scope && options.scope.length > 0 && !savedFile.path.startsWith(options.scope)) {
      continue;
    }

    const targetPath = path.join(repoRoot, savedFile.path);
    const exists = await pathExists(targetPath);

    if (!exists || options.replace === true) {
      plan.push({
        filePath: savedFile.path,
        targetPath,
        kind: exists ? "replace" : "create",
        content: savedFile.content
      });
      continue;
    }

    const localContent = await fs.readFile(targetPath, "utf8");
    try {
      const savedParsed = parseEnvFile(savedFile.content);
      const localParsed = parseEnvFile(localContent);
      const merged = mergeEnvFiles(savedParsed, localParsed);

      if (merged.conflicts.length > 0) {
        plan.push({
          filePath: savedFile.path,
          kind: "conflict",
          conflictKeys: merged.conflicts.map((conflict) => conflict.key)
        });
        continue;
      }

      plan.push({
        filePath: savedFile.path,
        targetPath,
        kind: "merge",
        content: formatEnvFile(merged.mergedEntries),
        addedKeys: merged.addedKeys,
        preservedLocalKeys: merged.preservedLocalKeys,
        unchangedKeys: merged.unchangedKeys
      });
    } catch (error) {
      if (error instanceof EnvmanError) {
        throw new EnvmanError(
          `Cannot merge ${savedFile.path} safely: ${error.message}. Use --replace to overwrite the file.`
        );
      }
      throw error;
    }
  }

  let conflictCount = 0;
  for (const item of plan) {
    if (item.kind === "conflict") {
      conflictCount += item.conflictKeys.length;
    }
  }

  if (conflictCount > 0) {
    for (const item of plan) {
      if (item.kind === "conflict") {
        console.log(`${item.filePath}: ${item.conflictKeys.length} conflict(s)`);
        for (const key of item.conflictKeys) {
          console.log(`  ! ${key}`);
        }
        continue;
      }

      if (item.kind === "merge") {
        console.log(
          `${item.filePath}: merge add=${item.addedKeys.length} keep-local=${item.preservedLocalKeys.length} unchanged=${item.unchangedKeys.length}`
        );
        continue;
      }

      console.log(`${item.filePath}: ${item.kind}`);
    }

    throw new EnvmanError(
      `${conflictCount} conflicting key(s) found. No files were written. Re-run with --replace to use saved values.`
    );
  }

  if (options.dryRun === true) {
    for (const item of plan) {
      if (item.kind === "merge") {
        console.log(
          `${item.filePath}: merge add=${item.addedKeys.length} keep-local=${item.preservedLocalKeys.length} unchanged=${item.unchangedKeys.length}`
        );
        continue;
      }

      console.log(`${item.filePath}: ${item.kind}`);
    }
    return;
  }

  for (const item of plan) {
    if (item.kind === "conflict") {
      continue;
    }

    await writeFileAtomic(item.targetPath, item.content);
    console.log(`${item.filePath}: ${item.kind === "merge" ? "merged" : `${item.kind}d`}`);
  }
}
