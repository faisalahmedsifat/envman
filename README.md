# envman

Git-backed, encryption-first sync for repo `.env*` files.

`envman` stores encrypted environment snapshots inside your repository under `.envman/`. Teams share those encrypted snapshots with normal git pushes and pulls, while plaintext `.env` files stay local and gitignored.

## What It Is Good At

- Sharing the current repo env state across a team without adding a hosted secret manager.
- Restoring `.env`, `.env.local`, and nested app env files into the correct paths in a monorepo.
- Merging safe additions from the saved profile without silently overwriting local-only keys.
- Running a child process from a saved profile without writing decrypted files back to disk.

## What It Does Not Solve

- Passphrase distribution. Teams still need to share the repo passphrase out of band.
- Full dotenv language support. `envman` supports standard `KEY=value` files and rejects unsupported syntax for safe merges.
- Comment-preserving merges. Merged files are rewritten in normalized form.

## Install

```bash
npm install -g @xyph3r/envman
```

Or run it without a global install:

```bash
npx @xyph3r/envman init
bunx @xyph3r/envman init
```

## Quick Start

### 1. Initialize the Repo

```bash
envman init
```

This creates:

- `.envman/config.json`
- `.envman/manifest.json`
- `.envman/profiles/`
- `.envman/backups/`

It also adds common plaintext env filenames and `.envman/session` to `.gitignore`.

Re-running `envman init` is safe. Existing config and saved profile metadata are preserved.

### 2. Save the Current Env State

```bash
envman save
```

`envman save` discovers matching `.env*` files, encrypts them, and writes the snapshot to `.envman/profiles/default.enc`.

### 3. Commit the Encrypted Metadata

```bash
git add .envman
git commit -m "chore: update envman profile"
git push
```

### 4. Restore on Another Machine

```bash
git pull
envman fetch --replace
```

That is the main onboarding path: pull the repo, enter the shared passphrase, and restore the saved env files exactly where they belong.

## Everyday Workflow

Use the merge-first path when you want safe updates:

```bash
envman fetch
```

Default `fetch` behavior:

- Adds keys that exist only in the saved profile.
- Keeps keys that exist only in your local file.
- Refuses to overwrite conflicting keys.
- Rewrites merged files in normalized `KEY=value` form.

Use the explicit overwrite path when you want the saved profile exactly:

```bash
envman fetch --replace
```

Inspect before changing anything:

```bash
envman status
envman diff
envman diff staging prod
```

Run a command from the saved profile without writing `.env` files:

```bash
envman run -- npm run dev
envman run staging -- npm run start
```

## Configuration

`envman init` writes the default config:

```json
{
  "version": 1,
  "defaultProfile": "default",
  "include": [],
  "exclude": [
    ".env.example",
    ".env.sample",
    "*.example",
    "*.sample"
  ]
}
```

`config.json` is the user-facing source of truth.

- `defaultProfile`: used when a command does not receive a profile name.
- `include`: optional allowlist. When empty, all discovered `.env*` files are eligible.
- `exclude`: denylist applied after discovery and `.envmanignore`.

Example: only track env files inside the app packages you care about.

```json
{
  "version": 1,
  "defaultProfile": "staging",
  "include": [
    "apps/api/.env",
    "apps/web/.env.local",
    "packages/*/.env"
  ],
  "exclude": [
    ".env.example",
    ".env.sample",
    "apps/experimental/**"
  ]
}
```

## Discovery, Ignore Rules, and Scope

By default, `envman` discovers `.env` files recursively and skips these directories:

- `.git`
- `.envman`
- `node_modules`
- `dist`
- `build`
- `.next`

Use `.envmanignore` for repo-specific ignore rules:

```gitignore
apps/legacy/**
apps/mobile/.env.local
```

Use `--scope` to limit a command to an exact subtree or a single env file:

```bash
envman save --scope apps/api
envman fetch --scope apps/api --replace
envman status --scope apps/api
envman diff --scope apps/api
```

Scope matching is exact. `--scope apps/api` affects `apps/api/**`, not sibling paths such as `apps/api-admin`.

## Profiles

Profiles let you store multiple snapshots in the same repo.

```bash
envman save staging
envman save prod
envman ls
envman fetch staging --replace
```

If you want a different default profile, update `.envman/config.json`:

```json
{
  "version": 1,
  "defaultProfile": "staging",
  "include": [],
  "exclude": [
    ".env.example",
    ".env.sample",
    "*.example",
    "*.sample"
  ]
}
```

## Passphrases and Sessions

Passphrase resolution order is:

1. `--passphrase-env <NAME>`
2. `ENVMAN_PASSPHRASE`
3. `.envman/session` cache
4. Interactive prompt

Cache the passphrase locally for repeated commands:

```bash
envman unlock
envman lock
```

Non-interactive usage:

```bash
ENVMAN_PASSPHRASE=repo-secret envman fetch --replace
envman fetch --replace --passphrase-env MY_TEAM_SECRET
```

Rotate the repo passphrase:

```bash
envman passphrase check
envman passphrase rotate
envman passphrase rotate --passphrase-env CURRENT_SECRET --new-passphrase-env NEXT_SECRET
```

Rotation writes timestamped backups to `.envman/backups/` before replacing encrypted profile files.

## Docs

- [Command reference](./docs/commands.md)
- [Merge behavior](./docs/merge-strategy.md)
- [Storage format](./docs/storage-format.md)
- [Security model](./docs/security-model.md)
- [Architecture](./docs/architecture.md)
