import { parseEnvFile } from "./env-parse.js";

export function buildProfileEnv(files: Array<{ path: string; content: string }>): Record<string, string> {
  const env: Record<string, string> = {};
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));

  for (const file of sortedFiles) {
    const parsed = parseEnvFile(file.content);
    for (const entry of parsed.entries) {
      env[entry.key] = entry.value;
    }
  }

  return env;
}
