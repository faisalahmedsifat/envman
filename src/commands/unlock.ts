import { promises as fs } from "node:fs";

import { EnvmanError } from "../core/errors.js";
import { readManifest } from "../core/manifest.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { getSessionPath } from "../core/paths.js";
import { loadProfile } from "../core/profile.js";

export async function runUnlock(
  repoRoot: string,
  options: PassphraseOptions = {}
): Promise<void> {
  const manifest = await readManifest(repoRoot);
  const passphrase = await resolvePassphrase(repoRoot, { ...options, ignoreCache: true });

  let validated = false;
  let validationError: Error | undefined;

  for (const profile of manifest.profiles) {
    try {
      await loadProfile(repoRoot, profile.name, passphrase);
      validated = true;
      break;
    } catch (error) {
      validationError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!validated && manifest.profiles.length > 0) {
    throw new EnvmanError(`Passphrase is incorrect. Failed to decrypt profiles. Last error: ${validationError?.message}`);
  }

  const sessionPath = getSessionPath(repoRoot);
  await fs.writeFile(sessionPath, passphrase, { mode: 0o600 });
  console.log("repository unlocked for this session");
}
