import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getRepoRoot(cwd: string): Promise<string> {
  const result = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
    cwd
  });

  return result.stdout.trim();
}
