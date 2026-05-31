import { promises as fs } from "node:fs";
import crypto from "node:crypto";

import { readConfig } from "../core/config.js";
import { discoverEnvFiles } from "../core/discover.js";
import { readManifest } from "../core/manifest.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { loadProfile, saveProfile } from "../core/profile.js";
import { isPathWithinScope, normalizeScope } from "../core/scope.js";
import type { TrackedEnvFile } from "../types/index.js";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export interface SaveOptions extends PassphraseOptions {
  scope?: string;
}

export async function runSave(
  repoRoot: string,
  profile?: string,
  options: SaveOptions = {}
): Promise<void> {
  const config = await readConfig(repoRoot);
  const manifest = await readManifest(repoRoot);
  const selectedProfile = profile ?? config.defaultProfile ?? manifest.defaultProfile ?? "default";
  const passphrase = await resolvePassphrase(repoRoot, options);
  const normalizedScope = normalizeScope(options.scope);
  const discoveredFiles = await discoverEnvFiles(repoRoot, config, normalizedScope);

  const newFiles: TrackedEnvFile[] = [];
  for (const file of discoveredFiles) {
    const stats = await fs.stat(file.absolutePath);
    const content = await fs.readFile(file.absolutePath, "utf8");
    newFiles.push({
      path: file.relativePath,
      content,
      hash: sha256(content),
      lastModified: stats.mtime.toISOString()
    });
  }

  let trackedFiles: TrackedEnvFile[] = newFiles;

  if (normalizedScope !== undefined) {
    const existingProfile = await loadProfile(repoRoot, selectedProfile, passphrase).catch(() => ({ files: [] }));
    const filesOutOfScope = existingProfile.files.filter(
      (file) => !isPathWithinScope(file.path, normalizedScope)
    );
    trackedFiles = [...filesOutOfScope, ...newFiles];
    trackedFiles.sort((left, right) => left.path.localeCompare(right.path));
  }

  await saveProfile(repoRoot, selectedProfile, trackedFiles, passphrase);
  console.log(`saved ${trackedFiles.length} env file(s) to profile ${selectedProfile}`);
}
