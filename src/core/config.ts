import { promises as fs } from "node:fs";

import type { EnvmanConfig } from "../types/index.js";
import { pathExists, writeFileAtomic } from "./fs.js";
import { getConfigPath } from "./paths.js";

export const DEFAULT_CONFIG: EnvmanConfig = {
  version: 1,
  defaultProfile: "default",
  include: [],
  exclude: [".env.example", ".env.sample", "*.example", "*.sample"]
};

export async function readConfig(repoRoot: string): Promise<EnvmanConfig> {
  const configPath = getConfigPath(repoRoot);
  if (!(await pathExists(configPath))) {
    return DEFAULT_CONFIG;
  }
  const raw = await fs.readFile(configPath, "utf8");
  return JSON.parse(raw) as EnvmanConfig;
}

export async function writeConfig(repoRoot: string, config: EnvmanConfig): Promise<void> {
  const configPath = getConfigPath(repoRoot);
  await writeFileAtomic(configPath, JSON.stringify(config, null, 2) + "\n");
}
