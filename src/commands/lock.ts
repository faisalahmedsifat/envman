import { promises as fs } from "node:fs";

import { getSessionPath } from "../core/paths.js";

export async function runLock(repoRoot: string): Promise<void> {
  const sessionPath = getSessionPath(repoRoot);
  try {
    await fs.unlink(sessionPath);
    console.log("session locked");
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.log("no active session found");
    } else {
      throw error;
    }
  }
}
