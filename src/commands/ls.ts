import { readConfig } from "../core/config.js";
import { readManifest } from "../core/manifest.js";

export async function runLs(repoRoot: string): Promise<void> {
  const config = await readConfig(repoRoot);
  const manifest = await readManifest(repoRoot);
  const defaultProfile = config.defaultProfile ?? manifest.defaultProfile;

  if (manifest.profiles.length === 0) {
    console.log("no saved profiles");
    return;
  }

  for (const profile of manifest.profiles) {
    const marker = profile.name === defaultProfile ? "*" : " ";
    console.log(`${marker} ${profile.name}  ${profile.updatedAt}`);
  }
}
