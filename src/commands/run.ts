import { spawn, type ChildProcess } from "node:child_process";

import { readConfig } from "../core/config.js";
import { EnvmanError } from "../core/errors.js";
import { readManifest } from "../core/manifest.js";
import { resolvePassphrase, type PassphraseOptions } from "../core/passphrase.js";
import { buildProfileEnv } from "../core/profile-env.js";
import { loadProfile } from "../core/profile.js";

export interface RunOptions extends PassphraseOptions {
  command: string[];
}

export async function runRun(
  repoRoot: string,
  profile: string | undefined,
  options: RunOptions
): Promise<void> {
  if (options.command.length === 0) {
    throw new EnvmanError("No command provided to run");
  }

  const config = await readConfig(repoRoot);
  const manifest = await readManifest(repoRoot);
  const selectedProfile = profile ?? config.defaultProfile ?? manifest.defaultProfile ?? "default";
  const passphrase = await resolvePassphrase(repoRoot, options);
  const savedProfile = await loadProfile(repoRoot, selectedProfile, passphrase);
  const profileEnv = buildProfileEnv(savedProfile.files);

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...profileEnv
  };
  const commandBinary = options.command[0];
  if (commandBinary === undefined) {
    throw new EnvmanError("No command provided to run");
  }
  const commandArgs = options.command.slice(1);

  await new Promise<void>((resolve, reject) => {
    const child: ChildProcess = spawn(commandBinary, commandArgs, {
      cwd: repoRoot,
      env: childEnv,
      stdio: "inherit"
    });

    child.on("error", (error: Error) => {
      reject(error);
    });

    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (signal !== null) {
        reject(new EnvmanError(`Command terminated by signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new EnvmanError(`Command exited with code ${code ?? 1}`));
        return;
      }

      resolve();
    });
  });
}
