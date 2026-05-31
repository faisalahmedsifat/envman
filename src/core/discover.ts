import { promises as fs } from "node:fs";
import path from "node:path";

import type { EnvmanConfig } from "../types/index.js";
import { EnvmanFilter } from "./ignore.js";
import { normalizeRelativePath, normalizeScope } from "./scope.js";

const DEFAULT_ENV_FILE_PATTERN = /^\.env(\..+)?$/;
const DEFAULT_SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".envman"]);

export interface DiscoveredEnvFile {
  absolutePath: string;
  relativePath: string;
}

function isEnvFile(fileName: string): boolean {
  return DEFAULT_ENV_FILE_PATTERN.test(fileName);
}

async function walk(
  repoRoot: string,
  currentDir: string,
  config: EnvmanConfig,
  filter: EnvmanFilter,
  output: DiscoveredEnvFile[]
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));

    if (entry.isDirectory()) {
      if (DEFAULT_SKIP_DIRS.has(entry.name)) {
        continue;
      }
      
      // We can check if the directory itself is ignored
      // `ignore` expects paths to have a trailing slash to indicate directories
      // but `ig.ignores` works generally. Let's append / to be safe for directory ignores.
      if (filter.shouldSkipPath(relativePath + "/", config)) {
        continue;
      }

      await walk(repoRoot, absolutePath, config, filter, output);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!isEnvFile(entry.name)) {
      continue;
    }

    if (filter.shouldSkipPath(relativePath, config)) {
      continue;
    }

    output.push({
      absolutePath,
      relativePath
    });
  }
}

export async function discoverEnvFiles(
  repoRoot: string,
  config: EnvmanConfig,
  scope?: string
): Promise<DiscoveredEnvFile[]> {
  const output: DiscoveredEnvFile[] = [];
  const filter = new EnvmanFilter();
  await filter.load(repoRoot, config);

  let startDir = repoRoot;
  const normalizedScope = normalizeScope(scope);
  if (normalizedScope !== undefined) {
    const scopePath = path.join(repoRoot, normalizedScope);
    try {
      const stats = await fs.stat(scopePath);
      if (stats.isDirectory()) {
        startDir = scopePath;
      } else if (stats.isFile() && isEnvFile(path.basename(scopePath))) {
        // If scope points directly to an env file, just check if it's ignored
        const relativePath = normalizeRelativePath(path.relative(repoRoot, scopePath));
        if (!filter.shouldSkipPath(relativePath, config)) {
          output.push({ absolutePath: scopePath, relativePath });
        }
        return output;
      }
    } catch {
      // If scope doesn't exist, return empty
      return output;
    }
  }

  await walk(repoRoot, startDir, config, filter, output);
  output.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return output;
}
