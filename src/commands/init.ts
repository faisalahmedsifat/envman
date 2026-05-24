import { promises as fs } from "node:fs";

import { DEFAULT_CONFIG, writeConfig } from "../core/config.js";
import { DEFAULT_MANIFEST, writeManifest } from "../core/manifest.js";
import { getEnvmanDir, getProfilesDir } from "../core/paths.js";

export async function runInit(repoRoot: string): Promise<void> {
  await fs.mkdir(getEnvmanDir(repoRoot), { recursive: true });
  await fs.mkdir(getProfilesDir(repoRoot), { recursive: true });

  await writeConfig(repoRoot, DEFAULT_CONFIG);
  await writeManifest(repoRoot, DEFAULT_MANIFEST);
}
