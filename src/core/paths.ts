import path from "node:path";

export function getEnvmanDir(repoRoot: string): string {
  return path.join(repoRoot, ".envman");
}

export function getProfilesDir(repoRoot: string): string {
  return path.join(getEnvmanDir(repoRoot), "profiles");
}

export function getConfigPath(repoRoot: string): string {
  return path.join(getEnvmanDir(repoRoot), "config.json");
}

export function getManifestPath(repoRoot: string): string {
  return path.join(getEnvmanDir(repoRoot), "manifest.json");
}

export function getProfilePath(repoRoot: string, profile: string): string {
  return path.join(getProfilesDir(repoRoot), `${profile}.enc`);
}
