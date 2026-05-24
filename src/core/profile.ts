import { promises as fs } from "node:fs";
import os from "node:os";

import type { DecryptedProfileData, EncryptedProfile, Manifest, ManifestProfile, TrackedEnvFile } from "../types/index.js";
import { decryptProfile, encryptProfile, rewrapEncryptedProfile } from "./crypto.js";
import { pathExists, writeFileAtomic } from "./fs.js";
import { readManifest, writeManifest } from "./manifest.js";
import { getProfileBackupPath, getProfilePath } from "./paths.js";

export async function saveProfile(
  repoRoot: string,
  profile: string,
  files: TrackedEnvFile[],
  passphrase: string
): Promise<void> {
  const payload: DecryptedProfileData = {
    profile,
    updatedAt: new Date().toISOString(),
    savedBy: os.hostname(),
    files
  };

  const encrypted = await encryptProfile(payload, passphrase);
  await writeFileAtomic(getProfilePath(repoRoot, profile), JSON.stringify(encrypted, null, 2) + "\n");

  const manifest = await readManifest(repoRoot);
  const nextEntry: ManifestProfile = {
    name: profile,
    updatedAt: payload.updatedAt,
    file: `profiles/${profile}.enc`
  };

  const existingIndex = manifest.profiles.findIndex((entry) => entry.name === profile);
  if (existingIndex >= 0) {
    manifest.profiles[existingIndex] = nextEntry;
  } else {
    manifest.profiles.push(nextEntry);
    manifest.profiles.sort((left, right) => left.name.localeCompare(right.name));
  }

  if (manifest.defaultProfile.length === 0) {
    manifest.defaultProfile = profile;
  }

  await writeManifest(repoRoot, manifest);
}

export async function loadManifest(repoRoot: string): Promise<Manifest> {
  return readManifest(repoRoot);
}

export async function loadProfile(
  repoRoot: string,
  profile: string,
  passphrase: string
): Promise<DecryptedProfileData> {
  const encrypted = await loadEncryptedProfile(repoRoot, profile);
  return decryptProfile(encrypted, passphrase);
}

export async function profileExists(repoRoot: string, profile: string): Promise<boolean> {
  return pathExists(getProfilePath(repoRoot, profile));
}

export async function loadEncryptedProfile(
  repoRoot: string,
  profile: string
): Promise<EncryptedProfile> {
  const profilePath = getProfilePath(repoRoot, profile);
  const raw = await fs.readFile(profilePath, "utf8");
  return JSON.parse(raw) as EncryptedProfile;
}

export async function createBackup(repoRoot: string, profile: string): Promise<void> {
  const profilePath = getProfilePath(repoRoot, profile);
  const raw = await fs.readFile(profilePath, "utf8");
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  await writeFileAtomic(getProfileBackupPath(repoRoot, profile, timestamp), raw);
}

export async function rewrapAndSaveProfile(
  repoRoot: string,
  profile: string,
  encryptedProfile: EncryptedProfile,
  currentPassphrase: string,
  nextPassphrase: string,
  skipWrite = false
): Promise<EncryptedProfile> {
  const rotated = await rewrapEncryptedProfile(
    encryptedProfile,
    currentPassphrase,
    nextPassphrase
  );

  if (!skipWrite) {
    await writeFileAtomic(
      getProfilePath(repoRoot, profile),
      JSON.stringify(rotated, null, 2) + "\n"
    );
  }

  return rotated;
}
