import { readManifest } from "../core/manifest.js";

export async function runLs(repoRoot: string): Promise<void> {
  const manifest = await readManifest(repoRoot);

  if (manifest.profiles.length === 0) {
    console.log("no saved profiles");
    return;
  }

  for (const profile of manifest.profiles) {
    const marker = profile.name === manifest.defaultProfile ? "*" : " ";
    console.log(`${marker} ${profile.name}  ${profile.updatedAt}`);
  }
}
