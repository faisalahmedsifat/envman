import { promises as fs } from "node:fs";
import path from "node:path";

import { readConfig } from "../core/config.js";
import { diffEnvMaps } from "../core/diff.js";
import { parseEnvFile } from "../core/env-parse.js";
import { EnvmanError } from "../core/errors.js";
import { pathExists } from "../core/fs.js";
import { readManifest } from "../core/manifest.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { loadProfile } from "../core/profile.js";
import { discoverEnvFiles } from "../core/discover.js";
import { isPathWithinScope, normalizeScope } from "../core/scope.js";
import type { TrackedEnvFile } from "../types/index.js";

function printDiffHeader(label: string): void {
  console.log(label);
}

function printDiffs(diffs: ReturnType<typeof diffEnvMaps>): void {
  for (const diff of diffs) {
    if (diff.kind === "added") {
      console.log(`  + ${diff.key}`);
      continue;
    }

    if (diff.kind === "removed") {
      console.log(`  - ${diff.key}`);
      continue;
    }

    console.log(`  ~ ${diff.key}`);
  }
}

export interface DiffOptions extends PassphraseOptions {
  scope?: string;
}

async function showDiff(
  left: { name: string; files: TrackedEnvFile[] },
  right: { name: string; files: TrackedEnvFile[] }
): Promise<void> {
  const leftFiles = new Map(left.files.map((file) => [file.path, file.content]));
  const rightFiles = new Map(right.files.map((file) => [file.path, file.content]));
  const filePaths = [...new Set([...leftFiles.keys(), ...rightFiles.keys()])].sort((a, b) =>
    a.localeCompare(b)
  );

  for (const filePath of filePaths) {
    const leftContent = leftFiles.get(filePath);
    const rightContent = rightFiles.get(filePath);

    if (leftContent === undefined) {
      printDiffHeader(filePath);
      console.log(`  + file only in ${right.name}`);
      continue;
    }

    if (rightContent === undefined) {
      printDiffHeader(filePath);
      console.log(`  - file only in ${left.name}`);
      continue;
    }

    const diffs = diffEnvMaps(parseEnvFile(leftContent), parseEnvFile(rightContent));
    if (diffs.length === 0) {
      continue;
    }

    printDiffHeader(filePath);
    printDiffs(diffs);
  }
}

export async function runDiff(
  repoRoot: string,
  leftProfile: string | undefined,
  rightProfile: string | undefined,
  options: DiffOptions = {}
): Promise<void> {
  const config = await readConfig(repoRoot);
  const manifest = await readManifest(repoRoot);
  const selectedDefault = config.defaultProfile ?? manifest.defaultProfile ?? "default";
  const passphrase = await resolvePassphrase(repoRoot, options);
  const normalizedScope = normalizeScope(options.scope);

  if (rightProfile === undefined) {
    const selectedProfile = leftProfile ?? selectedDefault;
    let savedProfile;
    try {
      savedProfile = await loadProfile(repoRoot, selectedProfile, passphrase);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EnvmanError(`Failed to decrypt profile ${selectedProfile}: ${message}`);
    }

    const scopedSavedFiles = savedProfile.files.filter((file) =>
      isPathWithinScope(file.path, normalizedScope)
    );

    const localFiles = await discoverEnvFiles(repoRoot, config, normalizedScope);
    const localSavedFiles: TrackedEnvFile[] = [];
    for (const f of localFiles) {
      localSavedFiles.push({ path: f.relativePath, content: await fs.readFile(f.absolutePath, "utf8"), hash: "", lastModified: "" });
    }

    await showDiff(
      { name: "local", files: localSavedFiles },
      { name: `profile:${selectedProfile}`, files: scopedSavedFiles }
    );

    return;
  }

  const firstProfile = leftProfile ?? selectedDefault;
  const secondProfile = rightProfile;

  let leftSaved;
  try {
    leftSaved = await loadProfile(repoRoot, firstProfile, passphrase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new EnvmanError(`Failed to decrypt profile ${firstProfile}: ${message}`);
  }

  let rightSaved;
  try {
    rightSaved = await loadProfile(repoRoot, secondProfile, passphrase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new EnvmanError(
      `Failed to decrypt profile ${secondProfile}. Profiles may not share the same current repo passphrase: ${message}`
    );
  }

  const scopedLeftFiles = leftSaved.files.filter((file) =>
    isPathWithinScope(file.path, normalizedScope)
  );

  const scopedRightFiles = rightSaved.files.filter((file) =>
    isPathWithinScope(file.path, normalizedScope)
  );

  await showDiff(
    { name: `profile:${firstProfile}`, files: scopedLeftFiles },
    { name: `profile:${secondProfile}`, files: scopedRightFiles }
  );
}
