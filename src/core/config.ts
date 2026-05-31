import { promises as fs } from "node:fs";

import type { EnvmanConfig } from "../types/index.js";
import { EnvmanError } from "./errors.js";
import { pathExists, writeFileAtomic } from "./fs.js";
import { getConfigPath } from "./paths.js";

export const DEFAULT_CONFIG: EnvmanConfig = {
  version: 1,
  defaultProfile: "default",
  include: [],
  exclude: [".env.example", ".env.sample", "*.example", "*.sample"]
};

function cloneDefaultConfig(): EnvmanConfig {
  return {
    ...DEFAULT_CONFIG,
    include: [...DEFAULT_CONFIG.include],
    exclude: [...DEFAULT_CONFIG.exclude]
  };
}

function normalizeStringArray(value: unknown, fieldName: string, fallback: string[]): string[] {
  if (value === undefined) {
    return [...fallback];
  }

  if (!Array.isArray(value)) {
    throw new EnvmanError(`${fieldName} must be an array of strings`);
  }

  const items = value
    .map((item) => {
      if (typeof item !== "string") {
        throw new EnvmanError(`${fieldName} must contain only strings`);
      }

      return item.trim();
    })
    .filter((item) => item.length > 0);

  return [...new Set(items)];
}

export function normalizeConfig(raw: unknown): EnvmanConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EnvmanError("config must be a JSON object");
  }

  const input = raw as Partial<EnvmanConfig>;
  const defaultProfile =
    typeof input.defaultProfile === "string" && input.defaultProfile.trim().length > 0
      ? input.defaultProfile.trim()
      : DEFAULT_CONFIG.defaultProfile;

  const version = typeof input.version === "number" ? input.version : DEFAULT_CONFIG.version;

  return {
    version,
    defaultProfile,
    include: normalizeStringArray(input.include, "config.include", DEFAULT_CONFIG.include),
    exclude: normalizeStringArray(input.exclude, "config.exclude", DEFAULT_CONFIG.exclude)
  };
}

export async function readConfig(repoRoot: string): Promise<EnvmanConfig> {
  const configPath = getConfigPath(repoRoot);
  if (!(await pathExists(configPath))) {
    return cloneDefaultConfig();
  }
  const raw = await fs.readFile(configPath, "utf8");
  return normalizeConfig(JSON.parse(raw));
}

export async function writeConfig(repoRoot: string, config: EnvmanConfig): Promise<void> {
  const configPath = getConfigPath(repoRoot);
  const normalized = normalizeConfig(config);
  await writeFileAtomic(configPath, JSON.stringify(normalized, null, 2) + "\n");
}
