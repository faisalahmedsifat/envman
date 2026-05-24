import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_CONFIG, writeConfig } from "../core/config.js";
import { pathExists, writeFileAtomic } from "../core/fs.js";
import { DEFAULT_MANIFEST, writeManifest } from "../core/manifest.js";
import { getBackupsDir, getEnvmanDir, getProfilesDir } from "../core/paths.js";

const GITIGNORE_LINES = [
  ".envman/session",
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
  ".env.production",
  ".env.production.local",
  ".env.staging",
  ".env.staging.local"
];

async function updateGitignore(repoRoot: string): Promise<void> {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  const existing = (await pathExists(gitignorePath))
    ? await fs.readFile(gitignorePath, "utf8")
    : "";

  const existingLines = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );

  const missing = GITIGNORE_LINES.filter((line) => !existingLines.has(line));
  if (missing.length === 0) {
    return;
  }

  const parts: string[] = [];
  if (existing.trim().length > 0) {
    parts.push(existing.trimEnd());
  }
  parts.push("# Local plaintext env files", ...missing);
  await writeFileAtomic(gitignorePath, `${parts.join("\n")}\n`);
}

export async function runInit(repoRoot: string): Promise<void> {
  await fs.mkdir(getEnvmanDir(repoRoot), { recursive: true });
  await fs.mkdir(getProfilesDir(repoRoot), { recursive: true });
  await fs.mkdir(getBackupsDir(repoRoot), { recursive: true });

  await writeConfig(repoRoot, DEFAULT_CONFIG);
  await writeManifest(repoRoot, DEFAULT_MANIFEST);
  await updateGitignore(repoRoot);
}
