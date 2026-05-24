export async function runStatus(repoRoot: string, profile?: string): Promise<void> {
  const selectedProfile = profile ?? "default";
  console.log(`status not implemented yet: repo=${repoRoot} profile=${selectedProfile}`);
}
