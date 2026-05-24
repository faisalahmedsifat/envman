import { promises as fs } from "node:fs";
import path from "node:path";

import password from "@inquirer/password";

import { EnvmanError } from "../core/errors.js";
import { pathExists, writeFileAtomic } from "../core/fs.js";
import { readManifest } from "../core/manifest.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { createBackup, loadEncryptedProfile, rewrapAndSaveProfile } from "../core/profile.js";

export interface RotateOptions extends PassphraseOptions {
  newPassphraseEnv?: string;
}

async function resolveNewPassphrase(options: RotateOptions): Promise<string> {
  if (options.newPassphraseEnv !== undefined) {
    const value = process.env[options.newPassphraseEnv];
    if (value === undefined || value.length === 0) {
      throw new EnvmanError(
        `Environment variable ${options.newPassphraseEnv} is not set or is empty`
      );
    }
    return value;
  }

  const first = await password({ message: "Enter new envman repo passphrase" });
  const second = await password({ message: "Confirm new envman repo passphrase" });
  if (first !== second) {
    throw new EnvmanError("New passphrases did not match");
  }
  return first;
}

export async function runPassphraseRotate(
  repoRoot: string,
  options: RotateOptions = {}
): Promise<void> {
  const manifest = await readManifest(repoRoot);
  const currentPassphrase = await resolvePassphrase(repoRoot, options);
  const nextPassphrase = await resolveNewPassphrase(options);

  const encryptedProfiles = [];
  for (const profile of manifest.profiles) {
    try {
      const encrypted = await loadEncryptedProfile(repoRoot, profile.name);
      encryptedProfiles.push({ name: profile.name, encrypted });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EnvmanError(`Failed to load profile ${profile.name}: ${message}`);
    }
  }

  const rotatedProfiles = [];
  for (const profile of encryptedProfiles) {
    try {
      rotatedProfiles.push({
        name: profile.name,
        encrypted: await rewrapAndSaveProfile(
          repoRoot,
          profile.name,
          profile.encrypted,
          currentPassphrase,
          nextPassphrase,
          true
        )
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EnvmanError(
        `Failed to rotate profile ${profile.name}. Profiles may not share the same current repo passphrase: ${message}`
      );
    }
  }

  const backupDir = path.join(repoRoot, ".envman", "backups");
  if (!(await pathExists(backupDir))) {
    await fs.mkdir(backupDir, { recursive: true });
  }

  for (const profile of encryptedProfiles) {
    await createBackup(repoRoot, profile.name);
  }

  for (const profile of rotatedProfiles) {
    await writeFileAtomic(
      path.join(repoRoot, ".envman", "profiles", `${profile.name}.enc`),
      JSON.stringify(profile.encrypted, null, 2) + "\n"
    );
  }

  console.log(`rotated passphrase for ${rotatedProfiles.length} profile(s)`);
}
