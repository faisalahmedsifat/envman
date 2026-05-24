## `envman` — Product Plan

### Core Identity

A git-backed, encryption-first CLI for syncing repo `.env*` files across teammates.

`envman` should feel like this:

- save the env state for a repo
- commit and push the encrypted metadata
- teammate pulls the repo
- teammate runs one command to recreate the right `.env` files locally

It is not a hosted secret manager. It is not a vault service. It is a **repo-native env sync tool** for teams already using git.

---

### The Main UX

This product should be extremely easy to use.

The default team workflow:

```bash
# one-time in a repo
envman init

# capture current env files into the repo
envman save
git add .envman
git commit -m "Update envman profile"
git push

# teammate on another machine
git pull
envman fetch --replace
```

That is the core promise: if you already have the repo, `envman` should put the right `.env` files back in the right places with one command.

---

### Product Principles

1. **Git is the sharing mechanism**
   - No separate import/export flow for normal use
   - No extra server
   - No separate sync backend for v1

2. **The repo is the source of truth for shared env snapshots**
   - Encrypted env metadata lives inside the repo
   - Teammates get updates through normal `git pull`

3. **Local `.env` files remain uncommitted**
   - The actual plaintext `.env` files stay local
   - Only encrypted `envman` artifacts are committed

4. **The default path should require very little thinking**
   - `init`
   - `save`
   - `fetch --replace`
   - `status`

5. **v1 should be honest about what it solves**
   - `envman` solves encrypted repo-local env sync
   - it does not fully solve team secret distribution
   - the shared repo passphrase is still distributed out of band in v1

---

### Mental Model

```text
local .env files
  -> envman save
  -> encrypted repo snapshot in .envman/
  -> git commit / push
  -> teammate git pull
  -> envman fetch --replace
  -> local .env files restored exactly where they belong
```

`envman` scans the repo, captures every selected `.env*` file, preserves each relative path, encrypts the contents, and stores the result in a repo-tracked metadata directory.

---

### Command Surface

Keep v1 small and obvious:

```bash
# one-time setup
envman init

# save current repo env state into tracked encrypted metadata
envman save
envman save staging

# restore env files from tracked metadata
envman fetch
envman fetch staging
envman fetch --replace
envman fetch staging --replace
envman fetch --dry-run
envman fetch --passphrase-env ENVMAN_PASS --replace

# inspect
envman status
envman ls
envman diff
envman diff staging prod

# process execution
envman run -- npm run dev
envman run staging -- npm run dev
envman run staging --passphrase-env ENVMAN_PASS -- npm run dev

# local session control
envman lock

# passphrase management
envman passphrase check
envman passphrase rotate
envman passphrase rotate --passphrase-env ENVMAN_PASS --new-passphrase-env ENVMAN_NEW_PASS
```

### Command Behavior

- `init`
  - creates repo-local `.envman/`
  - writes config and metadata structure
  - sets up encryption passphrase flow
  - updates `.gitignore` conservatively if needed so plaintext `.env` files stay ignored

- `save [profile]`
  - scans the repo for selected `.env*` files
  - encrypts them into a profile snapshot
  - writes the snapshot under `.envman/`
  - does not commit automatically
  - respects include/exclude rules from `.envman/config.json`

- `fetch [profile]`
  - reads the encrypted repo snapshot
  - diffs saved env values against existing local files
  - merges non-conflicting key changes by default
  - preserves local-only keys by default
  - refuses to overwrite conflicting keys unless `--replace` is passed
  - can decrypt non-interactively via `--passphrase-env`

- `fetch --replace`
  - the main teammate command
  - restores files back to their original relative paths
  - overwrites local files that differ
  - bypasses merge conflict protection

- `status`
  - shows tracked, modified, missing, and untracked `.env*` files
  - defaults to the repo `defaultProfile` when no profile is specified
  - explains whether `save` or `fetch --replace` is the next likely action

- `ls`
  - lists profiles stored for the current repo

- `diff`
  - compares local files to the saved profile by default
  - can also compare two named profiles
  - fails loudly if decryption fails for any requested profile
  - assumes both named profiles are decryptable under the same current repo passphrase in v1

- `run`
  - loads a profile into a child process without mutating the parent shell
  - supports `--passphrase-env` for non-interactive usage

- `lock`
  - clears cached decrypted state and requires passphrase again

- `passphrase check`
  - verifies that the provided passphrase can decrypt repo profiles

- `passphrase rotate`
  - re-wraps repo profile access with a new passphrase
  - rewrites committed `.envman/` artifacts
  - requires commit and push after rotation

---

### File Discovery

This is the core engine.

On every `save`, `envman`:

1. finds git root via `git rev-parse --show-toplevel`
2. recursively walks the repo
3. matches:
   - `.env`
   - `.env.local`
   - `.env.development`
   - `.env.staging`
   - `.env.production`
   - `.env.test`
   - `.env.*.local`
4. skips:
   - `.git`
   - `node_modules`
   - `dist`
   - `build`
   - `.next`
5. records each file as:
   - `path`
   - `content`
   - `hash`
   - `lastModified`

Selection rules:

- default discovery works with zero config
- `.envman/config.json` can narrow or exclude files
- sample/example files should not be captured by accident

Future support:

- `.envmanignore` for custom excludes
- `--scope apps/api` for partial save/fetch

---

### Fetch Merge Behavior

Default `fetch` should be merge-first, not replace-first.

For each tracked `.env` file:

1. parse the saved profile file into env keys
2. parse the local file if it already exists
3. compare by key
4. apply safe changes
5. report conflicts without silently overwriting them

Merge rules:

- key exists only in saved profile: add it locally
- key exists only locally: keep it locally
- key exists in both with same value: leave unchanged
- key exists in both with different values: mark as conflict and do not overwrite by default

This gives `fetch` a safe everyday behavior:

- shared new variables flow in automatically
- personal local-only variables are preserved
- changed shared variables do not get overwritten silently

If a file cannot be parsed safely as standard `KEY=value` env content, merge should stop for that file and require `--replace`.

For v1, merged files may be rewritten in a normalized format instead of preserving original comments, spacing, or ordering exactly.

Normalized rewrite is preferred because it keeps merge behavior predictable and testable.

Expected normalization rules:

- one `KEY=value` entry per line
- trailing newline at end of file
- preserve correctness of quoted values where needed
- preserve original key order where practical and append new keys at the end
- if original order cannot be preserved safely, fall back to deterministic ordering

Example flow:

```bash
git pull
envman fetch
```

Example result:

```text
apps/api/.env
  + added: REDIS_URL
  = unchanged: NODE_ENV
  ! conflict: DATABASE_URL
  ! conflict: JWT_SECRET

2 conflicts found. No conflicting keys were changed.
Run envman fetch --replace to use saved values.
Run envman diff to inspect value changes.
```

`envman fetch --replace` remains the explicit destructive mode for restoring the saved file exactly as stored.

---

### Repo Storage Model

Shared data lives inside the repo.

```text
repo/
  .envman/
    config.json
    manifest.json
    profiles/
      default.enc
      staging.enc
      prod.enc
```

### Why this model

- teammates already sync code with git
- encrypted env snapshots travel with the repo
- onboarding becomes obvious
- restoring env files does not require sending bundle files around

### `config.json`

This file stores repo behavior, not plaintext env contents.

Example:

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

Expected behavior:

- default discovery works with zero config
- `include` can narrow scanning if needed later
- `exclude` prevents files from being captured even if they match `.env*`
- this is the main v1 mechanism for excluding personal or sample files

### `manifest.json`

This file stays unencrypted and contains safe metadata only:

```json
{
  "version": 1,
  "defaultProfile": "default",
  "profiles": [
    {
      "name": "default",
      "updatedAt": "2026-05-24T00:00:00.000Z",
      "file": "profiles/default.enc"
    }
  ]
}
```

### Encrypted profile format

Each profile file is encrypted JSON:

```json
{
  "v": 1,
  "wrappedKeys": [
    {
      "id": "repo-passphrase",
      "kdf": "pbkdf2",
      "salt": "<base64>",
      "iv": "<base64>",
      "tag": "<base64>",
      "wrappedKey": "<base64>"
    }
  ],
  "dataIv": "<base64>",
  "dataTag": "<base64>",
  "data": "<base64-encrypted-json>"
}
```

Decrypted `data` shape:

```json
{
  "profile": "default",
  "updatedAt": "2026-05-24T00:00:00.000Z",
  "savedBy": "hostname",
  "files": [
    {
      "path": "apps/api/.env",
      "content": "DATABASE_URL=...",
      "hash": "..."
    }
  ]
}
```

This structure keeps v1 simple while leaving room for future multi-user key wrapping.

---

### Passphrase Model

To keep usage simple, v1 uses one shared repo passphrase.

Expected workflow:

- team agrees on a repo passphrase out of band
- `envman init` stores repo metadata and sets the passphrase
- `envman save` uses that passphrase to encrypt profile snapshots
- teammate runs `envman fetch --replace` and is prompted for the same passphrase

Optional convenience:

- cache decrypted session locally for a short duration
- `lock` clears that cache

Important limitation:

- passphrase sharing still happens out of band in v1
- `envman` does not remove the need for a secure channel to give a new teammate the repo passphrase

### Non-interactive decryption

Commands that need decryption should support:

```bash
envman fetch --passphrase-env ENVMAN_PASS --replace
envman run --passphrase-env ENVMAN_PASS -- npm run dev
envman passphrase rotate --passphrase-env ENVMAN_PASS --new-passphrase-env ENVMAN_NEW_PASS
```

This matters for:

- local scripts
- automated developer workflows
- CI-like usage when teams intentionally inject the passphrase securely

Interactive prompting remains the default when these flags are not provided.

Passphrase resolution order should be:

1. `--passphrase-env <NAME>`
2. `ENVMAN_PASSPHRASE`
3. interactive prompt

This keeps local automation and CI simple without forcing extra flags on every command.

### Passphrase rotation

Rotation should be supported in v1.

The model:

1. each profile is encrypted with a random data key
2. the data key is wrapped by the repo passphrase
3. rotation changes the wrapper, not the underlying profile payload

Expected behavior:

- prompt for current passphrase
- prompt for new passphrase
- decrypt each wrapped profile key with the old passphrase
- re-wrap each profile key with the new passphrase
- rewrite `.envman/profiles/*.enc`
- preserve profile contents and metadata
- require the rotation result to be committed and pushed

Safety requirements:

- create a backup before rewriting files
- write atomically using temp files and replace-on-success
- fail loudly if any profile cannot be decrypted
- never produce partial success silently

Teammate effect:

- after pulling the rotation commit, teammates must use the new passphrase
- old passphrase should no longer unlock updated profiles
- if a repo somehow contains profiles encrypted under different passphrases, commands like `diff profileA profileB` should fail with a clear mixed-access error instead of a generic wrong-passphrase message

---

### Team Sharing Flow

This is the canonical product flow:

```bash
# Alice
envman save staging
git add .envman
git commit -m "Update staging env profile"
git push

# Bob
git pull
envman fetch staging --replace
```

No bundle files. No import command. No manual path mapping.

If Bob already has conflicting local `.env` files, `fetch` should:

- merge non-conflicting keys by default
- keep local-only keys by default
- show a clear summary of conflicting keys
- proceed with full saved-file overwrite only when `--replace` is used

If the repo passphrase was rotated, Bob must use the new passphrase after pulling the rotation commit.

---

### Safety Design

| Scenario | Behavior |
|---|---|
| `fetch` would overwrite existing `.env` files | Refuse by default and require `--replace` |
| `fetch --dry-run` | Show exact files and keys that would be written, merged, conflicted, changed, or removed |
| `save prod` or `save production` | Ask for explicit confirmation |
| local `.env` exists but is not in saved profile | `status` marks it as untracked |
| saved profile contains file missing locally | `status` marks it as missing |
| multiple teammates update same profile | normal git conflict or last merged state decides outcome |
| wrong passphrase | decryption fails cleanly with no writes |
| `run` command | injects env only into child process |
| passphrase rotation fails midway | original profile files remain intact |

---

### `status` Output

`status` should be the command that makes the tool feel understandable.

Example:

```text
envman — profile: staging

  ROOT
  ✓  .env                     tracked, up to date
  ⚠  .env.local               tracked, differs from saved profile

  apps/api
  ✓  .env                     tracked, up to date
  +  .env.staging             missing locally, available in profile

  apps/web
  ✗  .env.local               untracked local file

Next actions:
  - Run envman save staging to capture local changes
  - Run envman fetch staging to merge safe saved changes
  - Run envman fetch staging --replace to force saved values
```

---

### Monorepo Support

This is a first-class use case.

- detect repo root once and operate from there
- preserve exact relative paths for all `.env*` files
- support nested app/package env files
- detect `turbo.json` or `pnpm-workspace.yaml` for nicer grouped output
- later add `--scope` for partial operations

Example:

```text
/
  .env
  apps/
    web/.env.local
    api/.env
    api/.env.staging
  packages/
    db/.env
```

One `envman save staging` should capture the whole tree.

One `envman fetch staging --replace` on another machine should restore the whole tree.

### `.gitignore` behavior

`init` should be careful here.

Rules:

- never overwrite existing `.gitignore` behavior blindly
- avoid adding broad patterns that would hide intentionally tracked example files
- do not treat `.env.example` or `.env.sample` as secrets by default

Safe default additions should prefer plaintext secret files only, such as:

- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

The tool should avoid broad `.env*` writes unless the user explicitly opts in.

---

### Build Stack

- Runtime: Node.js
- Language: TypeScript
- Encryption: Node built-in `crypto` using AES-256-GCM and PBKDF2
- CLI parsing: `commander`
- Terminal output: `chalk`
- Password prompt: `@inquirer/password`
- Packaging: npm CLI package first, single-binary packaging later

The implementation should avoid heavy dependencies.

---

### v1 Build Phases

### Phase 1: Core

Ship the simplest useful flow:

- `init`
- `save`
- `fetch`
- `status`

This phase should already work for real teams using git.

### Phase 2: Inspection and execution

- `ls`
- `diff`
- `run`
- `lock`
- `passphrase check`
- `passphrase rotate`

### Phase 3: Monorepo and polish

- `--scope`
- `.envmanignore`
- improved tree output
- better conflict messaging

---

### v1 Definition of Done

`envman` is ready when a team can:

1. initialize `envman` in a repo
2. save encrypted env snapshots into `.envman/`
3. commit and push `.envman/` through git
4. pull on another machine
5. run `envman fetch` to merge safe changes or `envman fetch --replace` to force restore
6. get the correct `.env` files written back to the correct paths without losing local-only values by default
7. rotate the shared repo passphrase without rebuilding profiles from scratch

If that path is smooth, the product is doing the right thing.
