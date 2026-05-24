# envman Implementation Plan

This file turns [system.md](/home/faisal/Dev/envman/docs/product/system.md) into an implementation plan for this repo.

## Goal

Build `envman` as a git-backed, encryption-first CLI that stores encrypted env snapshots in `.envman/`, syncs them through git, and restores local `.env*` files with safe merge behavior by default.

## Scope Anchors

- Git is the transport.
- Shared encrypted metadata lives inside repo-local `.envman/`.
- Default `fetch` is merge-first, not replace-first.
- `fetch --replace` is the explicit destructive path.
- v1 uses one shared repo passphrase.
- Passphrase sharing remains out of band in v1.

## Repo Layout

```text
envman/
  README.md
  docs/
    product/
      PLAN.md
      system.md
    architecture.md
    commands.md
    merge-strategy.md
    roadmap.md
    security-model.md
    storage-format.md
  src/
    cli.ts
    commands/
      diff.ts
      fetch.ts
      init.ts
      lock.ts
      ls.ts
      passphrase-check.ts
      passphrase-rotate.ts
      run.ts
      save.ts
      status.ts
    core/
      config.ts
      crypto.ts
      discover.ts
      env-merge.ts
      env-parse.ts
      git.ts
      ignore.ts
      manifest.ts
      passphrase.ts
      profile.ts
      scope.ts
      session-cache.ts
      write-safe.ts
    types/
      index.ts
    ui/
      diff-output.ts
      output.ts
      prompts.ts
      tree.ts
  test/
    fixtures/
      repos/
        conflicts/
        monorepo/
        simple/
    integration/
    unit/
  scripts/
  package.json
  tsconfig.json
```

## Phase 0: Foundation

Objective: establish the project skeleton and lock down the data model before command work starts.

Tasks:

- Initialize `package.json`, `tsconfig.json`, and the CLI entrypoint.
- Create `src`, `docs`, and `test` directories.
- Define core types for:
  - `EnvmanConfig`
  - `Manifest`
  - `ManifestProfile`
  - `TrackedEnvFile`
  - `EncryptedProfile`
  - `WrappedKey`
  - `DecryptedProfileData`
  - `FetchPlan`
  - `MergeResult`
  - `StatusResult`
- Write `docs/storage-format.md` for `.envman/config.json`, `.envman/manifest.json`, and `profiles/*.enc`.
- Write `docs/security-model.md` for key derivation, passphrase resolution, session cache, and rotation.
- Write `docs/merge-strategy.md` for key-level merge behavior and parser limits.

Acceptance criteria:

- CLI builds and prints help.
- All persisted file formats are versioned from the start.
- Docs and internal types match [system.md](/home/faisal/Dev/envman/docs/product/system.md).

## Phase 1: Core Infrastructure

Objective: implement the shared internals every command depends on.

Tasks:

- Implement git root detection with `git rev-parse --show-toplevel`.
- Implement repo-local `.envman/` path resolution.
- Implement config and manifest read/write helpers.
- Implement recursive `.env*` discovery with built-in skips:
  - `.git`
  - `node_modules`
  - `dist`
  - `build`
  - `.next`
- Implement config-driven `include` and `exclude` matching.
- Implement env file parsing for standard `KEY=value` syntax.
- Define normalized env rewrite rules for merged files:
  - one `KEY=value` per line
  - trailing newline
  - preserve quoted values where required for correctness
  - preserve original key order where practical and append new keys at the end
  - otherwise fall back to deterministic ordering
- Implement atomic file writes and backup helpers for destructive updates.
- Implement AES-256-GCM encryption and PBKDF2 key derivation using Node `crypto`.
- Implement wrapped-key support so profile payload keys can be re-wrapped on rotation.
- Implement passphrase resolution:
  1. `--passphrase-env <NAME>`
  2. `ENVMAN_PASSPHRASE`
  3. interactive prompt
- Implement short-lived local session cache plus `lock`.

Acceptance criteria:

- Discovery returns correct relative paths for nested repos and monorepos.
- Config and manifest round-trip correctly.
- Profiles can be encrypted, decrypted, and re-wrapped without changing payload data.
- Passphrase resolution is deterministic and documented.

## Phase 2: `init` and Repo Setup

Objective: make first-time setup safe and predictable.

Tasks:

- Implement `envman init`.
- Create `.envman/config.json`, `.envman/manifest.json`, and `profiles/`.
- Prompt for repo passphrase and confirm it.
- Seed `defaultProfile` in config and manifest.
- Update `.gitignore` conservatively:
  - never overwrite existing rules blindly
  - avoid broad `.env*` entries
  - do not hide `.env.example` or `.env.sample` by default
- Print next-step guidance after init.

Acceptance criteria:

- A repo can be initialized once without destructive side effects.
- `.gitignore` changes are limited to plaintext env patterns intended to remain local.
- Re-running `init` behaves predictably.

## Phase 3: Save Path

Objective: capture current repo env state into encrypted tracked profiles.

Tasks:

- Implement `envman save [profile]`.
- Default profile selection to `defaultProfile` when none is provided.
- Discover selected files based on default matching plus config include/exclude rules.
- Parse env files, normalize paths, hash contents, and build profile payload.
- Encrypt payload with a random data key and current repo passphrase wrapper.
- Update `manifest.json` metadata such as `updatedAt` and profile file path.
- Add confirmation for production-like profiles such as `prod` or `production`.

Acceptance criteria:

- `save` writes encrypted profile artifacts into `.envman/profiles/`.
- Manifest metadata stays consistent with the encrypted files on disk.
- Save works for single-repo and monorepo layouts.

## Phase 4: Fetch Path

Objective: restore env files from saved profiles with merge-first default behavior.

Tasks:

- Implement `envman fetch [profile]`.
- Default profile selection to `defaultProfile` when none is provided.
- Decrypt the selected profile using passphrase resolution rules.
- Build a per-file fetch plan:
  - new file write
  - merge into existing file
  - conflict requiring user attention
  - replace path when `--replace` is set
- Implement key-level merge rules:
  - saved-only key: add locally
  - local-only key: preserve locally
  - same key and same value: unchanged
  - same key and different value: conflict by default
- Implement parser fallback behavior:
  - if local file cannot be parsed safely, refuse merge for that file
  - allow full overwrite only with `--replace`
- Write merged files back in normalized format instead of trying to preserve comments and formatting exactly.
- Implement `--dry-run` output with file-level and key-level detail.
- Implement actual writes with atomic file replacement.

Acceptance criteria:

- Default `fetch` merges safe changes and preserves local-only keys.
- Conflicting keys are never overwritten silently.
- `fetch --replace` restores saved file contents exactly as stored.
- `fetch --dry-run` performs zero writes.

## Phase 5: Status and Diff

Objective: make saved state versus local state understandable.

Tasks:

- Implement `envman status [profile]`.
- Default to `defaultProfile` when no profile is specified.
- Compare local files against the selected saved profile.
- Classify files and keys as:
  - tracked and unchanged
  - tracked and modified
  - missing locally
  - untracked locally
  - conflicted against saved profile
- Render output in a tree-like structure, grouped for monorepos when possible.
- Implement `envman diff [profileA] [profileB]`.
- Default `diff` with one or zero profile arguments to local-vs-selected-profile comparison.
- Support named profile-to-profile comparison.
- Fail loudly on decryption issues.
- If profiles cannot be decrypted under the same current repo passphrase, emit a clear mixed-access error instead of a generic wrong-passphrase error.

Acceptance criteria:

- `status` gives an obvious next action.
- `diff` is useful for both local review and profile comparison.
- Decryption errors are explicit and actionable.

## Phase 6: Run and Session Handling

Objective: support process execution without mutating the parent shell.

Tasks:

- Implement `envman run [profile] -- <command>`.
- Default to `defaultProfile` when profile is omitted.
- Decrypt selected profile.
- Merge saved values into a child-process environment according to the selected semantics for `run`.
- Support non-interactive passphrase resolution.
- Ensure no parent shell mutation occurs.
- Implement `envman lock`.

Acceptance criteria:

- `run` works interactively and in automation with `ENVMAN_PASSPHRASE` or `--passphrase-env`.
- `lock` clears local decrypted session state.

## Phase 7: Passphrase Management

Objective: support verification and safe rotation of the shared repo passphrase.

Tasks:

- Implement `envman passphrase check`.
- Implement `envman passphrase rotate`.
- Verify current passphrase before any rewrite.
- Prompt for new passphrase or accept `--new-passphrase-env`.
- Re-wrap each profile data key with the new passphrase.
- Preserve encrypted payload contents.
- Create backups before rewriting profile files.
- Write temp files and replace originals only after all re-wraps succeed.
- Require commit/push guidance after successful rotation.

Acceptance criteria:

- Rotation changes access without rebuilding profiles from live `.env` files.
- Rotation is atomic from the repo’s point of view.
- Failed rotation leaves original `.envman/` state intact.

## Phase 8: Polish and Monorepo UX

Objective: improve usability without widening the core model.

Tasks:

- Detect `turbo.json` and `pnpm-workspace.yaml` for better grouping.
- Add `--scope` for partial save/fetch/status where feasible.
- Add `.envmanignore` support on top of config rules.
- Improve prompts and conflict messaging.
- Improve `status` and `diff` output formatting for large repos.

Acceptance criteria:

- Large repos remain understandable.
- Scoped operations affect only requested subtrees.
- Ignore behavior is predictable.

## Suggested Build Order

1. Storage, security, and merge docs.
2. Type definitions.
3. Config, manifest, and filesystem safety helpers.
4. Crypto, wrapped keys, and passphrase resolution.
5. Git root and discovery.
6. Env parsing and merge engine.
7. `init`.
8. `save`.
9. `fetch`.
10. `status`.
11. `diff`.
12. `run` and `lock`.
13. `passphrase check` and `passphrase rotate`.
14. Monorepo polish and scope support.

## Testing Strategy

### Unit tests

- Config parsing and defaults
- Manifest round-trip
- Env parser behavior for valid and invalid lines
- Merge engine behavior for:
  - added keys
  - preserved local-only keys
  - unchanged keys
  - conflicting keys
- Passphrase resolution order
- Crypto encrypt/decrypt round-trip
- Wrapped-key re-wrap behavior
- Atomic write helper behavior

### Integration tests

- `init` in a fresh repo
- `save` then `fetch` round-trip in a simple repo
- `save` then `fetch` round-trip in a monorepo
- merge-first `fetch` with local-only keys preserved
- merge-first `fetch` with conflicting keys blocked
- `fetch --replace` full overwrite behavior
- `fetch --dry-run` zero-write behavior
- `status` default profile behavior
- `diff` local-vs-profile behavior
- `diff` profile-vs-profile behavior
- passphrase resolution using `ENVMAN_PASSPHRASE`
- passphrase rotation success
- passphrase rotation failure rollback

### Fixtures

- `test/fixtures/repos/simple`
  - one root `.env`
  - one root `.env.local`
- `test/fixtures/repos/monorepo`
  - root env files
  - nested app and package env files
- `test/fixtures/repos/conflicts`
  - files crafted for merge conflicts
  - files with local-only keys
  - files with parser edge cases

## Risks and Open Decisions

- Merged env files are intentionally rewritten in normalized form in v1; exact comment and formatting preservation is out of scope.
- Non-standard shell syntax in env files should likely be unsupported for merge and require `--replace`.
- `run` needs a final decision on whether local process env wins over profile values or vice versa.
- Mixed-passphrase profile states should be rare, but the error path must still be clear.
- Team secret distribution remains outside the product boundary in v1.

## Definition of v1 Done

`envman` is v1-ready when a team can:

1. run `envman init` in a repo
2. run `envman save`
3. commit and push `.envman/`
4. pull the repo on another machine
5. run `envman fetch` to merge safe changes
6. run `envman fetch --replace` when they explicitly want saved values to win
7. inspect differences with `status` and `diff`
8. run commands with decrypted profile values when needed
9. rotate the shared repo passphrase without rebuilding profiles from scratch

If that flow works cleanly, the project is ready to build on.
