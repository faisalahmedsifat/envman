import { promises as fs } from "node:fs";
import password from "@inquirer/password";

import { EnvmanError } from "./errors.js";
import { getSessionPath } from "./paths.js";

export interface PassphraseOptions {
  passphraseEnv?: string | undefined;
  ignoreCache?: boolean;
}

export async function resolvePassphrase(repoRoot: string, options: PassphraseOptions = {}): Promise<string> {
  if (options.passphraseEnv !== undefined) {
    const explicitValue = process.env[options.passphraseEnv];
    if (explicitValue === undefined || explicitValue.length === 0) {
      throw new EnvmanError(
        `Environment variable ${options.passphraseEnv} is not set or is empty`
      );
    }
    return explicitValue;
  }

  const conventionalValue = process.env.ENVMAN_PASSPHRASE;
  if (conventionalValue !== undefined && conventionalValue.length > 0) {
    return conventionalValue;
  }

  if (options.ignoreCache !== true) {
    try {
      const sessionPath = getSessionPath(repoRoot);
      const cached = await fs.readFile(sessionPath, "utf8");
      if (cached.length > 0) {
        return cached;
      }
    } catch {
      // ignore if file doesn't exist
    }
  }

  return password({
    message: "Enter envman repo passphrase"
  });
}
