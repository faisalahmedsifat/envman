import path from "node:path";

export function getEnvmanDir(repoRoot: string): string {
  return path.join(repoRoot, ".envman");
}

export function getProfilesDir(repoRoot: string): string {
  return path.join(getEnvmanDir(repoRoot), "profiles");
}

export function getBackupsDir(repoRoot: string): string {
  return path.join(getEnvmanDir(repoRoot), "backups");
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

export function getProfileBackupPath(repoRoot: string, profile: string, timestamp: string): string {
  return path.join(getBackupsDir(repoRoot), `${profile}.${timestamp}.enc`);
}

export function getSessionPath(repoRoot: string): string {
  return path.join(getEnvmanDir(repoRoot), "session");
}
