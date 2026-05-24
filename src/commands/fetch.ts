export interface FetchOptions {
  dryRun?: boolean;
  replace?: boolean;
  passphraseEnv?: string;
}

export async function runFetch(
  repoRoot: string,
  profile: string | undefined,
  options: FetchOptions
): Promise<void> {
  const selectedProfile = profile ?? "default";
  console.log(
    `fetch not implemented yet: repo=${repoRoot} profile=${selectedProfile} dryRun=${options.dryRun === true} replace=${options.replace === true} passphraseEnv=${options.passphraseEnv ?? ""}`
  );
}
