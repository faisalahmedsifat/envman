#!/usr/bin/env node

import { Command } from "commander";

import { runDiff } from "./commands/diff.js";
import { runFetch } from "./commands/fetch.js";
import { runInit } from "./commands/init.js";
import { runLock } from "./commands/lock.js";
import { runUnlock } from "./commands/unlock.js";
import { runLs } from "./commands/ls.js";
import { runPassphraseCheck } from "./commands/passphrase-check.js";
import { runPassphraseRotate } from "./commands/passphrase-rotate.js";
import { runRun } from "./commands/run.js";
import { runSave } from "./commands/save.js";
import { runStatus } from "./commands/status.js";
import { getRepoRoot } from "./core/git.js";

async function resolveRepoRoot(): Promise<string> {
  return getRepoRoot(process.cwd());
}

function parseRunInvocation(argv: string[]): { profile?: string | undefined; command: string[] } {
  const doubleDashIndex = argv.indexOf("--");
  if (doubleDashIndex === -1) {
    throw new Error("run requires `--` before the child command");
  }

  const beforeDash = argv.slice(0, doubleDashIndex);
  const afterDash = argv.slice(doubleDashIndex + 1);
  if (afterDash.length === 0) {
    throw new Error("run requires a child command after `--`");
  }

  if (beforeDash.length === 0) {
    return { command: afterDash };
  }

  if (beforeDash.length === 1) {
    return {
      profile: beforeDash[0],
      command: afterDash
    };
  }

  throw new Error("run accepts at most one optional profile before `--`");
}

function getRunArgvFromProcessArgv(): string[] {
  const runIndex = process.argv.findIndex((token) => token === "run");
  if (runIndex === -1) {
    throw new Error("run command invocation could not be parsed");
  }

  return process.argv.slice(runIndex + 1);
}

async function main(): Promise<void> {
  const program = new Command();
  program.enablePositionalOptions();

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
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .option("--scope <path>", "limit the command to a specific directory or file")
    .action(async (profile: string | undefined, options: { passphraseEnv?: string; scope?: string }) => {
      const repoRoot = await resolveRepoRoot();
      await runSave(repoRoot, profile, options);
    });

  program
    .command("fetch")
    .description("Fetch env files from a saved profile")
    .argument("[profile]", "profile name")
    .option("--dry-run", "show what would change without writing files")
    .option("--replace", "replace local files with saved contents")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .option("--scope <path>", "limit the command to a specific directory or file")
    .action(
      async (
        profile: string | undefined,
        options: { dryRun?: boolean; replace?: boolean; passphraseEnv?: string; scope?: string }
      ) => {
        const repoRoot = await resolveRepoRoot();
        await runFetch(repoRoot, profile, options);
      }
    );

  program
    .command("status")
    .description("Show local env status relative to a saved profile")
    .argument("[profile]", "profile name")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .option("--scope <path>", "limit the command to a specific directory or file")
    .action(async (profile: string | undefined, options: { passphraseEnv?: string; scope?: string }) => {
      const repoRoot = await resolveRepoRoot();
      await runStatus(repoRoot, profile, options);
    });

  program
    .command("ls")
    .description("List saved profiles for the current repo")
    .action(async () => {
      const repoRoot = await resolveRepoRoot();
      await runLs(repoRoot);
    });

  program
    .command("run")
    .description("Run a command with env values from a saved profile")
    .argument("[args...]", "run arguments")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .allowUnknownOption()
    .passThroughOptions()
    .action(async (_args: string[], options: { passphraseEnv?: string }) => {
      const repoRoot = await resolveRepoRoot();
      const invocation = parseRunInvocation(getRunArgvFromProcessArgv());
      await runRun(repoRoot, invocation.profile, {
        ...options,
        command: invocation.command
      });
    });

  program
    .command("diff")
    .description("Show differences between local files and a profile, or between two profiles")
    .argument("[leftProfile]", "left profile name")
    .argument("[rightProfile]", "right profile name")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .option("--scope <path>", "limit the command to a specific directory or file")
    .action(
      async (
        leftProfile: string | undefined,
        rightProfile: string | undefined,
        options: { passphraseEnv?: string; scope?: string }
      ) => {
        const repoRoot = await resolveRepoRoot();
        await runDiff(repoRoot, leftProfile, rightProfile, options);
      }
    );

  const passphrase = program.command("passphrase").description("Passphrase management");

  passphrase
    .command("check")
    .description("Verify the current passphrase can decrypt repo profiles")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .action(async (options: { passphraseEnv?: string }) => {
      const repoRoot = await resolveRepoRoot();
      await runPassphraseCheck(repoRoot, options);
    });

  passphrase
    .command("rotate")
    .description("Rotate the shared repo passphrase")
    .option("--passphrase-env <name>", "read the current passphrase from an environment variable")
    .option("--new-passphrase-env <name>", "read the new passphrase from an environment variable")
    .action(async (options: { passphraseEnv?: string; newPassphraseEnv?: string }) => {
      const repoRoot = await resolveRepoRoot();
      await runPassphraseRotate(repoRoot, options);
    });

  program
    .command("lock")
    .description("Clear any local session state")
    .action(async () => {
      const repoRoot = await resolveRepoRoot();
      await runLock(repoRoot);
    });

  program
    .command("unlock")
    .description("Unlock the repository and cache the passphrase for this session")
    .option("--passphrase-env <name>", "read the passphrase from an environment variable")
    .action(async (options: { passphraseEnv?: string }) => {
      const repoRoot = await resolveRepoRoot();
      await runUnlock(repoRoot, options);
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
