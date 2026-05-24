import { promises as fs } from "node:fs";

import type { Manifest } from "../types/index.js";
import { getManifestPath } from "./paths.js";

export const DEFAULT_MANIFEST: Manifest = {
  version: 1,
  defaultProfile: "default",
  profiles: []
};

export async function readManifest(repoRoot: string): Promise<Manifest> {
  const manifestPath = getManifestPath(repoRoot);
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

export async function writeManifest(repoRoot: string, manifest: Manifest): Promise<void> {
  const manifestPath = getManifestPath(repoRoot);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}
