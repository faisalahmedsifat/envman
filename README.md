# envman

**A git-backed, encryption-first CLI for syncing `.env` files across teams.**

`envman` solves the problem of sharing environment variables within a team. Instead of sending `.env` files over Slack, storing them in a 3rd party vault, or maintaining a separate sync backend, `envman` encrypts your `.env` files into a metadata folder directly inside your Git repository. 

Your repository becomes the single source of truth. Teammates get the right `.env` files simply by pulling the repo and running one command.

## How it works

1. You run `envman save` to encrypt your local `.env` files into `.envman/profiles/default.enc`.
2. You commit and push the `.envman/` folder to your Git remote.
3. Your teammate runs `git pull` on their machine.
4. Your teammate runs `envman fetch --replace` to instantly decrypt and restore the `.env` files exactly where they belong.

The plaintext `.env` files never leave your machine unencrypted, and no third-party services are required.

---

## Installation

You can run `envman` directly using `npx` or `bunx`, or install it globally:

```bash
# Using npm
npm install -g envman-cli

# Using bun
bun install -g envman-cli
```

*(Note: The exact package name may vary depending on publication.)*

---

## Getting Started

### 1. Initialize

Run this once in your repository to set up `envman`. It will create a `.envman/config.json`, add `.envman/profiles` to your tracking, and ensure your `.env` files remain strictly in your `.gitignore`.

```bash
envman init
```

### 2. Save your Environment

When you have your local `.env` files set up the way the team needs them, save them to a profile (it defaults to `default`). You will be prompted to create a **repo passphrase**. Share this passphrase securely with your team.

```bash
envman save
```
This discovers all `.env*` files in your repository, encrypts them, and saves the snapshot in `.envman/profiles/default.enc`.

### 3. Commit to Git

Commit the encrypted artifacts.

```bash
git add .envman/
git commit -m "chore: save default env profile"
git push
```

### 4. Fetch (For your Teammates)

When your teammate pulls your code, they run:

```bash
envman fetch --replace
```
They enter the shared repo passphrase, and `envman` puts all the `.env` files exactly where they belong, restoring the environment.

---

## Commands & Features

### `envman status`
See what has changed locally compared to the encrypted profile. It will show you missing files, untracked files, and files that have conflicting changes.

```bash
envman status
```

### `envman diff`
See the exact line-by-line differences between your local `.env` files and the saved profile.

```bash
envman diff
```

### `envman fetch` (Safe Merging)
By default, `fetch` will **merge** changes. It adds new keys safely and preserves your local-only overrides without blindly destroying your local work. If there are conflicts (the same key was changed both locally and remotely), it will refuse to overwrite and ask you to use `--replace`.

```bash
envman fetch           # Safely merges additions
envman fetch --replace # Forces exact remote state
```

### `envman run`
Inject the encrypted profile directly into a child process without ever writing the `.env` files to your disk.

```bash
envman run -- npm run dev
envman run staging -- npm run start
```

### Advanced Discovery: `.envmanignore` and `--scope`
Built from the ground up for massive monorepos.

- **`.envmanignore`**: Create this file at the root of your repo to permanently ignore certain directories or files using standard `.gitignore` syntax (e.g., `apps/experimental/**/*.env`).
- **`--scope`**: Limit operations to a specific folder. For example, if you only want to update the API's environment without touching the rest of the monorepo:
  ```bash
  envman save --scope apps/api
  envman fetch --scope apps/api --replace
  envman status --scope apps/api
  ```

### Session Caching
You don't have to type your passphrase every time. `envman` caches your session securely in `.envman/session` (which is `0o600` permission and gitignored).

```bash
envman unlock  # Prompts for password once and caches it
envman lock    # Clears the cache
```

### Profiles
You can manage different environments (staging, production) seamlessly.

```bash
envman save staging
envman fetch staging --replace
```

### Passphrase Management
If your team's passphrase is ever compromised or you offboard a team member, you can safely rotate the encryption keys.

```bash
envman passphrase check
envman passphrase rotate
```
This safely decrypts all profiles with the old passphrase and rewrites them using the new one. Simply commit the changes and push.

---

## Security Model

1. **Local Plaintext**: Plaintext `.env` files remain gitignored and strictly local to your machine.
2. **Encryption**: `envman` uses Node's native `crypto` with `AES-256-GCM` and `PBKDF2`. Data keys are randomly generated per-profile and then wrapped by your repo passphrase.
3. **No Third Parties**: There is no "sync backend". The encrypted ciphertext lives entirely inside your git history. 

---

## Automation (CI/CD)

For automated environments, you can bypass the interactive prompt by passing the passphrase via an environment variable.

```bash
ENVMAN_PASSPHRASE=your-secret envman fetch --replace
# OR
envman fetch --replace --passphrase-env MY_SECRET_VAR
```
