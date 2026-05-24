import { readManifest } from "../core/manifest.js";
import { EnvmanError } from "../core/errors.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { loadProfile } from "../core/profile.js";

export async function runPassphraseCheck(
  repoRoot: string,
  options: PassphraseOptions = {}
): Promise<void> {
  const manifest = await readManifest(repoRoot);
  const passphrase = await resolvePassphrase(repoRoot, options);

  for (const profile of manifest.profiles) {
    try {
      await loadProfile(repoRoot, profile.name, passphrase);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EnvmanError(`Failed to decrypt profile ${profile.name}: ${message}`);
    }
  }

  console.log(`passphrase check passed for ${manifest.profiles.length} profile(s)`);
}
