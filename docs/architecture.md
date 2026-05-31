# Architecture

`envman` is a small CLI, but the runtime has four clear layers:

1. CLI command dispatch
2. Repo-local configuration and file discovery
3. Profile encryption and persistence
4. Merge, diff, and process-execution workflows

## Runtime Shape

```text
CLI command
  -> resolve git repo root
  -> load config + manifest
  -> resolve passphrase
  -> discover or decrypt files
  -> perform save / fetch / diff / run action
  -> write updated repo-local artifacts
```

## Main Modules

### `src/cli.ts`

The CLI is the Facade for the system. It exposes a small command surface and delegates each action to a dedicated command module.

### `src/commands/*`

Each command is a thin orchestration layer:

- `init`: prepares repo-local directories and normalized config files
- `save`: discovers files and persists a new encrypted profile
- `fetch`: builds a file-level plan, then merges or replaces
- `status` and `diff`: present local-versus-saved state
- `run`: injects a saved profile into a child process
- `passphrase-*`, `unlock`, `lock`: handle access and session concerns

### `src/core/config.ts` and `src/core/manifest.ts`

These modules normalize on-disk JSON into stable internal shapes.

- Missing config values are filled with defaults.
- Invalid shapes fail fast with explicit errors.
- Re-running `init` rewrites these files in normalized form instead of resetting them.

### `src/core/discover.ts`, `src/core/ignore.ts`, and `src/core/scope.ts`

These modules implement discovery as a small Pipeline:

1. Walk the repo
2. Skip built-in directories
3. Keep only `.env*` files
4. Apply `.envmanignore`
5. Apply config `exclude`
6. Apply config `include`
7. Apply exact scope matching when requested

Stored env paths are normalized to forward-slash relative paths so profile contents stay consistent across platforms.

### `src/core/profile.ts` and `src/core/crypto.ts`

These modules separate storage concerns from encryption concerns.

- `profile.ts` handles manifest updates, profile reads/writes, and backups.
- `crypto.ts` handles data-key generation, profile encryption, decryption, and passphrase rotation.

That separation keeps encryption logic out of the command modules and makes rotation a focused operation instead of a special case in `save`.

### `src/core/env-parse.ts`, `src/core/env-merge.ts`, and `src/core/diff.ts`

These modules treat env files as structured key/value data, not raw text blobs.

- Parsing converts file contents into ordered key lists plus lookup maps.
- Merge operates by key and returns a structured result.
- Diff operates by key and prints a small, readable change set.

This is why default `fetch` can safely preserve local-only keys while refusing conflicting overwrites.

## Storage Layout

```text
.envman/
  config.json
  manifest.json
  session
  backups/
  profiles/
    default.enc
    staging.enc
```

`config.json` is the user-edited policy file. `manifest.json` is profile metadata. `profiles/*.enc` hold encrypted snapshots. `session` is a local passphrase cache and should never be committed.

## Design Notes

- Facade pattern: the CLI entrypoint keeps the public interface small.
- Pipeline pattern: discovery and fetch planning are sequential transformations over repo state.
- Strategy kept deliberately simple: merge versus replace stays as a command option instead of separate command families.

The code stays intentionally flat. `envman` does not need a large abstraction graph; it needs predictable repo-local behavior and explicit failure modes.
