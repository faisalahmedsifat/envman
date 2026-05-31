import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { runDiff } from "../../src/commands/diff.js";
import { runFetch } from "../../src/commands/fetch.js";
import { runInit } from "../../src/commands/init.js";
import { runPassphraseCheck } from "../../src/commands/passphrase-check.js";
import { runPassphraseRotate } from "../../src/commands/passphrase-rotate.js";
import { runRun } from "../../src/commands/run.js";
import { runSave } from "../../src/commands/save.js";
import { runStatus } from "../../src/commands/status.js";

const tempDirs: string[] = [];

function makeTempRepo(): string {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "envman-it-"));
  tempDirs.push(repoDir);

  mkdirSync(path.join(repoDir, "apps/api"), { recursive: true });
  mkdirSync(path.join(repoDir, "apps/web"), { recursive: true });

  return repoDir;
}

async function withCapturedOutput<T>(
  callback: () => Promise<T>
): Promise<{ logs: string[]; result?: T; error?: Error }> {
  const logs: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const result = await callback();
    return { logs, result };
  } catch (error) {
    return {
      logs,
      error: error instanceof Error ? error : new Error(String(error))
    };
  } finally {
    console.log = originalLog;
  }
}

afterEach(() => {
  delete process.env.ENVMAN_PASSPHRASE;

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("envman command integration", () => {
  test("fetch merges safe changes, preserves local-only keys, and restores missing files", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nROOT_KEEP=base\n");
    writeFileSync(
      path.join(repoDir, "apps/api/.env"),
      "API_URL=https://saved.example\nAPI_TOKEN=saved-token\n"
    );
    writeFileSync(path.join(repoDir, "apps/web/.env.local"), "WEB_URL=https://web.example\n");

    await runInit(repoDir);
    await runSave(repoDir);

    writeFileSync(
      path.join(repoDir, ".env"),
      "ROOT_KEY=shared\nROOT_KEEP=base\nROOT_LOCAL_ONLY=mine\n"
    );
    writeFileSync(
      path.join(repoDir, "apps/api/.env"),
      "API_URL=https://local.example\nAPI_TOKEN=local-token\nLOCAL_ONLY=1\n"
    );
    unlinkSync(path.join(repoDir, "apps/web/.env.local"));

    const status = await withCapturedOutput(() => runStatus(repoDir));
    expect(status.logs).toContain("envman — profile: default");
    expect(status.logs).toContain("~ .env tracked, can merge safely");
    expect(status.logs).toContain("⚠ apps/api/.env tracked, conflicts with saved profile");
    expect(status.logs).toContain("+ apps/web/.env.local missing locally, available in profile");

    const fetch = await withCapturedOutput(() => runFetch(repoDir, undefined, { dryRun: true }));
    expect(fetch.logs).toContain(".env: merge add=0 keep-local=1 unchanged=2");
    expect(fetch.logs).toContain("apps/api/.env: 2 conflict(s)");
    expect(fetch.logs).toContain("  ! API_URL");
    expect(fetch.logs).toContain("  ! API_TOKEN");
    expect(fetch.logs).toContain("apps/web/.env.local: create");
    expect(fetch.error?.message).toContain("2 conflicting key(s) found");

    const fetchRun = await withCapturedOutput(() => runFetch(repoDir, undefined, {}));

    expect(fetchRun.logs).toContain(".env: merge add=0 keep-local=1 unchanged=2");
    expect(fetchRun.logs).toContain("apps/api/.env: 2 conflict(s)");
    expect(fetchRun.logs).toContain("apps/web/.env.local: create");
    expect(fetchRun.error?.message).toContain("2 conflicting key(s) found. No files were written.");

    expect(readFileSync(path.join(repoDir, ".env"), "utf8")).toBe(
      "ROOT_KEY=shared\nROOT_KEEP=base\nROOT_LOCAL_ONLY=mine\n"
    );
    expect(readFileSync(path.join(repoDir, "apps/api/.env"), "utf8")).toBe(
      "API_URL=https://local.example\nAPI_TOKEN=local-token\nLOCAL_ONLY=1\n"
    );
    expect(() => readFileSync(path.join(repoDir, "apps/web/.env.local"), "utf8")).toThrow();
  });

  test("fetch --replace restores saved file contents exactly", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nROOT_KEEP=base\n");
    writeFileSync(
      path.join(repoDir, "apps/api/.env"),
      "API_URL=https://saved.example\nAPI_TOKEN=saved-token\n"
    );
    writeFileSync(path.join(repoDir, "apps/web/.env.local"), "WEB_URL=https://web.example\n");

    await runInit(repoDir);
    await runSave(repoDir);

    writeFileSync(
      path.join(repoDir, ".env"),
      "ROOT_KEY=shared\nROOT_KEEP=base\nROOT_LOCAL_ONLY=mine\n"
    );
    writeFileSync(
      path.join(repoDir, "apps/api/.env"),
      "API_URL=https://local.example\nAPI_TOKEN=local-token\nLOCAL_ONLY=1\n"
    );
    unlinkSync(path.join(repoDir, "apps/web/.env.local"));

    const replace = await withCapturedOutput(() =>
      runFetch(repoDir, undefined, { replace: true })
    );
    expect(replace.logs).toContain(".env: replaced");
    expect(replace.logs).toContain("apps/api/.env: replaced");
    expect(replace.logs).toContain("apps/web/.env.local: created");

    expect(readFileSync(path.join(repoDir, ".env"), "utf8")).toBe(
      "ROOT_KEY=shared\nROOT_KEEP=base\n"
    );
    expect(readFileSync(path.join(repoDir, "apps/api/.env"), "utf8")).toBe(
      "API_URL=https://saved.example\nAPI_TOKEN=saved-token\n"
    );
    expect(readFileSync(path.join(repoDir, "apps/web/.env.local"), "utf8")).toBe(
      "WEB_URL=https://web.example\n"
    );
  });

  test("diff shows local-vs-profile and profile-vs-profile changes", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nROOT_KEEP=base\n");
    writeFileSync(path.join(repoDir, "apps/api/.env"), "API_URL=https://saved.example\n");

    await runInit(repoDir);
    await runSave(repoDir);

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nROOT_KEEP=changed\nROOT_LOCAL=1\n");
    const localDiff = await withCapturedOutput(() => runDiff(repoDir, undefined, undefined));
    expect(localDiff.logs).toContain(".env");
    expect(localDiff.logs).toContain("  ~ ROOT_KEEP");
    expect(localDiff.logs).toContain("  - ROOT_LOCAL");

    await runSave(repoDir, "staging");
    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nROOT_KEEP=prod\nPROD_ONLY=1\n");
    await runSave(repoDir, "prod");

    const profileDiff = await withCapturedOutput(() => runDiff(repoDir, "staging", "prod"));
    expect(profileDiff.logs).toContain(".env");
    expect(profileDiff.logs).toContain("  + PROD_ONLY");
    expect(profileDiff.logs).toContain("  - ROOT_LOCAL");
    expect(profileDiff.logs).toContain("  ~ ROOT_KEEP");
  });

  test("passphrase check and rotate keep profiles readable and create backups", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nROOT_KEEP=base\n");

    await runInit(repoDir);
    await runSave(repoDir);
    await runSave(repoDir, "staging");

    const beforeCheck = await withCapturedOutput(() => runPassphraseCheck(repoDir));
    expect(beforeCheck.logs).toContain("passphrase check passed for 2 profile(s)");

    process.env.ENVMAN_NEW_PASS = "next-pass";
    const rotate = await withCapturedOutput(() =>
      runPassphraseRotate(repoDir, { newPassphraseEnv: "ENVMAN_NEW_PASS" })
    );
    expect(rotate.logs).toContain("rotated passphrase for 2 profile(s)");

    const backupFiles = readdirSync(path.join(repoDir, ".envman", "backups"));
    expect(backupFiles.length).toBe(2);

    const oldCheck = await withCapturedOutput(() => runPassphraseCheck(repoDir));
    expect(oldCheck.error?.message).toContain("Failed to decrypt profile");

    process.env.ENVMAN_PASSPHRASE = "next-pass";
    const afterCheck = await withCapturedOutput(() => runPassphraseCheck(repoDir));
    expect(afterCheck.logs).toContain("passphrase check passed for 2 profile(s)");
  });

  test("run injects saved profile values into the child process and profile values win", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\nOVERRIDE_KEY=from-profile\n");
    writeFileSync(
      path.join(repoDir, "apps/api/.env"),
      "API_URL=https://saved.example\nOVERRIDE_KEY=from-api\n"
    );

    await runInit(repoDir);
    await runSave(repoDir);

    const script = [
      "const payload = {",
      "ROOT_KEY: process.env.ROOT_KEY,",
      "API_URL: process.env.API_URL,",
      "OVERRIDE_KEY: process.env.OVERRIDE_KEY,",
      "LOCAL_ONLY: process.env.LOCAL_ONLY",
      "};",
      "process.stdout.write(JSON.stringify(payload));"
    ].join("");

    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `import { runRun } from ${JSON.stringify(path.join(process.cwd(), "src/commands/run.js"))};
const repoRoot = ${JSON.stringify(repoDir)};
await runRun(repoRoot, undefined, { command: [process.execPath, "-e", ${JSON.stringify(script)}] });`
      ],
      {
        cwd: repoDir,
        env: {
          ...process.env,
          ENVMAN_PASSPHRASE: "test-pass",
          LOCAL_ONLY: "local-value",
          OVERRIDE_KEY: "from-parent"
        },
        encoding: "utf8"
      }
    );

    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    expect(JSON.parse(child.stdout)).toEqual({
      ROOT_KEY: "shared",
      API_URL: "https://saved.example",
      OVERRIDE_KEY: "from-api",
      LOCAL_ONLY: "local-value"
    });
  });

  test("init is idempotent and preserves existing config and manifest state", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\n");

    await runInit(repoDir);
    await runSave(repoDir, "staging");

    writeFileSync(
      path.join(repoDir, ".envman", "config.json"),
      JSON.stringify(
        {
          version: 1,
          defaultProfile: "staging"
        },
        null,
        2
      ) + "\n"
    );

    await runInit(repoDir);

    expect(JSON.parse(readFileSync(path.join(repoDir, ".envman", "config.json"), "utf8"))).toEqual({
      version: 1,
      defaultProfile: "staging",
      include: [],
      exclude: [".env.example", ".env.sample", "*.example", "*.sample"]
    });

    expect(JSON.parse(readFileSync(path.join(repoDir, ".envman", "manifest.json"), "utf8"))).toEqual({
      version: 1,
      defaultProfile: "default",
      profiles: [
        {
          name: "staging",
          updatedAt: expect.any(String),
          file: "profiles/staging.enc"
        }
      ]
    });
  });

  test("scoped operations only affect the exact scope subtree", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    mkdirSync(path.join(repoDir, "apps/api-admin"), { recursive: true });
    writeFileSync(path.join(repoDir, "apps/api/.env"), "API_ONLY=saved\n");
    writeFileSync(path.join(repoDir, "apps/api-admin/.env"), "ADMIN_ONLY=saved\n");

    await runInit(repoDir);
    await runSave(repoDir);

    writeFileSync(path.join(repoDir, "apps/api/.env"), "API_ONLY=local\n");
    writeFileSync(path.join(repoDir, "apps/api-admin/.env"), "ADMIN_ONLY=local\n");

    await runFetch(repoDir, undefined, { scope: "apps/api", replace: true });

    expect(readFileSync(path.join(repoDir, "apps/api/.env"), "utf8")).toBe("API_ONLY=saved\n");
    expect(readFileSync(path.join(repoDir, "apps/api-admin/.env"), "utf8")).toBe(
      "ADMIN_ONLY=local\n"
    );
  });

  test("partial config files are normalized with defaults during command reads", async () => {
    const repoDir = makeTempRepo();
    process.env.ENVMAN_PASSPHRASE = "test-pass";

    writeFileSync(path.join(repoDir, ".env"), "ROOT_KEY=shared\n");

    await runInit(repoDir);
    writeFileSync(
      path.join(repoDir, ".envman", "config.json"),
      JSON.stringify(
        {
          version: 1,
          defaultProfile: "default"
        },
        null,
        2
      ) + "\n"
    );

    await runSave(repoDir);

    expect(JSON.parse(readFileSync(path.join(repoDir, ".envman", "manifest.json"), "utf8"))).toEqual({
      version: 1,
      defaultProfile: "default",
      profiles: [
        {
          name: "default",
          updatedAt: expect.any(String),
          file: "profiles/default.enc"
        }
      ]
    });
  });
});
