# Commands

This is the command-level reference for `envman`.

## `envman init`

Initializes `envman` in the current git repository.

```bash
envman init
```

Behavior:

- Creates `.envman/`, `.envman/profiles/`, and `.envman/backups/`.
- Writes `.envman/config.json` if missing, or rewrites the existing file in normalized form.
- Writes `.envman/manifest.json` if missing, or rewrites the existing file in normalized form.
- Updates `.gitignore` with common plaintext env filenames and `.envman/session`.
- Preserves existing saved profiles and manifest entries on rerun.

## `envman save [profile]`

Captures local `.env*` files into an encrypted profile.

```bash
envman save
envman save staging
envman save --scope apps/api
envman save --passphrase-env ENVMAN_SECRET
```

Options:

- `--passphrase-env <NAME>`: read the passphrase from an environment variable.
- `--scope <path>`: limit discovery to an exact subtree or a single env file.

Behavior:

- Uses the named profile or `config.defaultProfile`.
- Discovers files according to built-in scanning rules, `.envmanignore`, and `config.json`.
- Stores profile contents in `.envman/profiles/<profile>.enc`.
- Updates `.envman/manifest.json`.
- When `--scope` is used, only files inside that scope are replaced in the profile; files outside the scope are kept from the existing saved profile.

## `envman fetch [profile]`

Restores local files from an encrypted profile.

```bash
envman fetch
envman fetch staging
envman fetch --dry-run
envman fetch --replace
envman fetch --scope apps/api --replace
```

Options:

- `--dry-run`: print the plan without writing files.
- `--replace`: overwrite local files with the saved profile.
- `--passphrase-env <NAME>`: read the passphrase from an environment variable.
- `--scope <path>`: limit the operation to an exact subtree or a single env file.

Default behavior:

- Missing files are created.
- Existing files are merged by env key.
- Local-only keys are preserved.
- Conflicting keys stop the command and no files are written.

With `--replace`:

- Existing files are overwritten with the exact saved contents.
- Scoped replacement only affects the exact scope you selected.

## `envman status [profile]`

Compares local files against a saved profile.

```bash
envman status
envman status staging
envman status --scope apps/web
```

Output classes:

- `✓`: tracked and up to date
- `~`: tracked and safe to merge
- `⚠`: tracked but conflicting or not safely mergeable
- `+`: missing locally, available in the profile
- `✗`: local env file is not tracked by the profile

## `envman diff [leftProfile] [rightProfile]`

Shows key-level differences.

```bash
envman diff
envman diff staging
envman diff staging prod
envman diff --scope apps/api
```

Behavior:

- With zero or one profile name, compares local files to the selected profile.
- With two profile names, compares profile to profile.
- Output is key-level and file-oriented.

Markers:

- `+`: present only on the right side
- `-`: present only on the left side
- `~`: same key exists on both sides with different values

## `envman ls`

Lists saved profiles from the repo manifest.

```bash
envman ls
```

Behavior:

- Prints one profile per line with the last updated time.
- Marks the configured default profile with `*`.

## `envman run [profile] -- <command>`

Runs a child process with variables from the saved profile.

```bash
envman run -- npm run dev
envman run staging -- node server.js
envman run staging --passphrase-env ENVMAN_SECRET -- bun run build
```

Behavior:

- Decrypts the selected profile.
- Builds a process environment from saved env files.
- Starts the child process with `cwd` set to the repo root.
- Profile values override inherited parent environment variables with the same key.

## `envman unlock`

Caches the passphrase for repeated commands in the current repo.

```bash
envman unlock
envman unlock --passphrase-env ENVMAN_SECRET
```

Behavior:

- Validates the passphrase against at least one saved profile when profiles exist.
- Writes the passphrase to `.envman/session` with mode `0600`.

## `envman lock`

Clears the local session cache.

```bash
envman lock
```

## `envman passphrase check`

Validates that the current passphrase can decrypt every saved profile.

```bash
envman passphrase check
envman passphrase check --passphrase-env ENVMAN_SECRET
```

## `envman passphrase rotate`

Re-wraps all saved profiles with a new passphrase.

```bash
envman passphrase rotate
envman passphrase rotate --passphrase-env CURRENT_SECRET --new-passphrase-env NEXT_SECRET
```

Behavior:

- Loads every saved encrypted profile.
- Verifies that all profiles can be decrypted with the current passphrase.
- Writes backups into `.envman/backups/`.
- Rewrites `.envman/profiles/*.enc` with the new wrapper key.
