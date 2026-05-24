import { promises as fs } from "node:fs";
import path from "node:path";

import { readConfig } from "../core/config.js";
import { discoverEnvFiles } from "../core/discover.js";
import { parseEnvFile } from "../core/env-parse.js";
import { pathExists } from "../core/fs.js";
import { readManifest } from "../core/manifest.js";
import { mergeEnvFiles } from "../core/env-merge.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { loadProfile } from "../core/profile.js";

export interface StatusOptions extends PassphraseOptions {
  scope?: string;
}

export async function runStatus(
  repoRoot: string,
  profile?: string,
  options: StatusOptions = {}
): Promise<void> {
  const config = await readConfig(repoRoot);
  const manifest = await readManifest(repoRoot);
  const selectedProfile = profile ?? config.defaultProfile ?? manifest.defaultProfile ?? "default";
  const passphrase = await resolvePassphrase(repoRoot, options);
  const savedProfile = await loadProfile(repoRoot, selectedProfile, passphrase);
  const localFiles = await discoverEnvFiles(repoRoot, config, options.scope);
  const localSet = new Set(localFiles.map((entry) => entry.relativePath));

  const scopedSavedFiles = options.scope && options.scope.length > 0
    ? savedProfile.files.filter((f) => f.path.startsWith(options.scope!))
    : savedProfile.files;

  console.log(`envman — profile: ${selectedProfile}`);

  for (const savedFile of scopedSavedFiles) {
    const targetPath = path.join(repoRoot, savedFile.path);
    if (!(await pathExists(targetPath))) {
      console.log(`+ ${savedFile.path} missing locally, available in profile`);
      continue;
    }

    const localContent = await fs.readFile(targetPath, "utf8");
    if (localContent === savedFile.content) {
      console.log(`✓ ${savedFile.path} tracked, up to date`);
      continue;
    }

    try {
      const merged = mergeEnvFiles(parseEnvFile(savedFile.content), parseEnvFile(localContent));
      if (merged.conflicts.length > 0) {
        console.log(`⚠ ${savedFile.path} tracked, conflicts with saved profile`);
      } else {
        console.log(`~ ${savedFile.path} tracked, can merge safely`);
      }
    } catch {
      console.log(`⚠ ${savedFile.path} tracked, differs and cannot be merged safely`);
    }
  }

  const savedSet = new Set(savedProfile.files.map((file) => file.path));
  for (const localFile of localFiles) {
    if (!savedSet.has(localFile.relativePath) && localSet.has(localFile.relativePath)) {
      console.log(`✗ ${localFile.relativePath} untracked local file`);
    }
  }
}
