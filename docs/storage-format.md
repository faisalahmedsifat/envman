# Storage Format

`envman` stores all repo-local metadata under `.envman/`.

## Directory Layout

```text
.envman/
  config.json
  manifest.json
  session
  backups/
    default.2026-06-01T12-34-56.789Z.enc
  profiles/
    default.enc
    staging.enc
```

## `config.json`

This is the user-facing configuration file.

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

Fields:

- `version`: config schema version
- `defaultProfile`: default profile when commands omit a profile name
- `include`: optional allowlist of env paths or globs
- `exclude`: denylist of env paths or globs

Normalization rules:

- missing arrays are filled with defaults
- blank strings are removed
- duplicate include or exclude entries are deduplicated

## `manifest.json`

This is unencrypted metadata for saved profiles.

Example:

```json
{
  "version": 1,
  "defaultProfile": "default",
  "profiles": [
    {
      "name": "default",
      "updatedAt": "2026-06-01T00:00:00.000Z",
      "file": "profiles/default.enc"
    }
  ]
}
```

Fields:

- `version`: manifest schema version
- `defaultProfile`: compatibility fallback for old state; commands prefer `config.json`
- `profiles`: list of saved profiles and their file locations

Notes:

- `manifest.json` is rewritten in normalized form by `init` and profile saves.
- `profiles[].file` is relative to `.envman/`.

## `profiles/*.enc`

Each profile file is encrypted JSON.

Shape:

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
  "data": "<base64>"
}
```

The decrypted payload contains:

- profile name
- save timestamp
- machine hostname that performed the save
- tracked files with relative paths, content, hash, and last-modified metadata

Tracked file paths are stored as forward-slash relative paths for cross-platform consistency.

## `session`

This file is created only by `envman unlock`.

Properties:

- contains the plaintext repo passphrase
- stored with mode `0600`
- intended as a local convenience cache
- should never be committed

## `backups/`

This directory is used during passphrase rotation.

- Each backup file is a pre-rotation copy of `profiles/<name>.enc`.
- Filenames include the profile name and an ISO timestamp with `:` replaced by `-`.
- Backups remain encrypted.
