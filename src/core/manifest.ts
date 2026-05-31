import { promises as fs } from "node:fs";

import type { Manifest } from "../types/index.js";
import { EnvmanError } from "./errors.js";
import { pathExists, writeFileAtomic } from "./fs.js";
import { getManifestPath } from "./paths.js";

export const DEFAULT_MANIFEST: Manifest = {
  version: 1,
  defaultProfile: "default",
  profiles: []
};

function cloneDefaultManifest(): Manifest {
  return {
    ...DEFAULT_MANIFEST,
    profiles: []
  };
}

export function normalizeManifest(raw: unknown): Manifest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EnvmanError("manifest must be a JSON object");
  }

  const input = raw as Partial<Manifest>;
  const profilesInput = input.profiles;
  if (profilesInput !== undefined && !Array.isArray(profilesInput)) {
    throw new EnvmanError("manifest.profiles must be an array");
  }

  const profiles = (profilesInput ?? [])
    .map((profile) => {
      if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
        throw new EnvmanError("manifest.profiles entries must be objects");
      }

      const name = typeof profile.name === "string" ? profile.name.trim() : "";
      const updatedAt = typeof profile.updatedAt === "string" ? profile.updatedAt.trim() : "";
      const file = typeof profile.file === "string" ? profile.file.trim() : "";

      if (name.length === 0 || updatedAt.length === 0 || file.length === 0) {
        throw new EnvmanError(
          "manifest.profiles entries must include non-empty name, updatedAt, and file values"
        );
      }

      return { name, updatedAt, file };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const defaultProfile =
    typeof input.defaultProfile === "string" && input.defaultProfile.trim().length > 0
      ? input.defaultProfile.trim()
      : DEFAULT_MANIFEST.defaultProfile;

  const version = typeof input.version === "number" ? input.version : DEFAULT_MANIFEST.version;

  return {
    version,
    defaultProfile,
    profiles
  };
}

export async function readManifest(repoRoot: string): Promise<Manifest> {
  const manifestPath = getManifestPath(repoRoot);
  if (!(await pathExists(manifestPath))) {
    return cloneDefaultManifest();
  }
  const raw = await fs.readFile(manifestPath, "utf8");
  return normalizeManifest(JSON.parse(raw));
}

export async function writeManifest(repoRoot: string, manifest: Manifest): Promise<void> {
  const manifestPath = getManifestPath(repoRoot);
  const normalized = normalizeManifest(manifest);
  await writeFileAtomic(manifestPath, JSON.stringify(normalized, null, 2) + "\n");
}
