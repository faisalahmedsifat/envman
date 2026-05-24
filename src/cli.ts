#!/usr/bin/env node

import { Command } from "commander";

import { runFetch } from "./commands/fetch.js";
import { runInit } from "./commands/init.js";
import { runSave } from "./commands/save.js";
import { runStatus } from "./commands/status.js";
import { getRepoRoot } from "./core/git.js";

async function resolveRepoRoot(): Promise<string> {
  return getRepoRoot(process.cwd());
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("envman")
    .description("Git-backed, encryption-first sync for repo .env files")
    .version("0.1.0");

  program
    .command("init")
    .description("Initialize envman in the current git repo")
    .action(async () => {
      const repoRoot = await resolveRepoRoot();
      await runInit(repoRoot);
      console.log(`initialized envman in ${repoRoot}`);
    });

  program
    .command("save")
    .description("Save current env files into an encrypted profile")
    .argument("[profile]", "profile name")
    .action(async (profile?: string) => {
      const repoRoot = await resolveRepoRoot();
      await runSave(repoRoot, profile);
    });

  program
    .command("fetch")
    .description("Fetch env files from a saved profile")
    .argument("[profile]", "profile name")
    .option("--dry-run", "show what would change without writing files")
    .option("--replace", "replace local files with saved contents")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .action(
      async (
        profile: string | undefined,
        options: { dryRun?: boolean; replace?: boolean; passphraseEnv?: string }
      ) => {
        const repoRoot = await resolveRepoRoot();
        await runFetch(repoRoot, profile, options);
      }
    );

  program
    .command("status")
    .description("Show local env status relative to a saved profile")
    .argument("[profile]", "profile name")
    .action(async (profile?: string) => {
      const repoRoot = await resolveRepoRoot();
      await runStatus(repoRoot, profile);
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
