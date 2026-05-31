# Security Model

`envman` is designed for repo-local encrypted env sync, not for replacing a full secret-management platform.

## Trust Model

Assumptions:

- The team already shares access to the git repository.
- Plaintext `.env` files should stay local and gitignored.
- Encrypted snapshots can be committed to the repo.
- The shared repo passphrase is distributed out of band.

If someone has both the encrypted `.envman/profiles/*.enc` files and the repo passphrase, they can decrypt the saved snapshots.

## What Is Encrypted

Encrypted:

- env file contents
- tracked env file paths inside the encrypted payload
- file hashes and metadata inside the encrypted payload

Not encrypted:

- `.envman/manifest.json`
- profile names
- profile update timestamps
- the existence of `envman` in the repo

## Crypto Design

Each saved profile is encrypted with a random 32-byte data key.

- Payload encryption: `AES-256-GCM`
- Passphrase KDF: `PBKDF2-SHA256`
- PBKDF2 iterations: `310000`
- Data-key wrapper ID: `repo-passphrase`

Flow:

1. Generate a random data key for the profile payload.
2. Encrypt the profile JSON with AES-256-GCM.
3. Derive a wrapping key from the repo passphrase with PBKDF2.
4. Encrypt the data key with the wrapping key.
5. Store the wrapped key plus encrypted payload in `profiles/<name>.enc`.

Passphrase rotation re-wraps the data key. It does not decrypt and re-encrypt every payload field through the save pipeline.

## Passphrase Resolution Order

Commands resolve the passphrase in this order:

1. `--passphrase-env <NAME>`
2. `ENVMAN_PASSPHRASE`
3. `.envman/session`
4. Interactive prompt

That order matters. An explicitly named environment variable always wins over cached state.

## Session Cache

`envman unlock` writes the passphrase into `.envman/session` with file mode `0600`.

Properties:

- local to the repo
- plaintext on disk
- intended for short-lived convenience
- gitignored by `envman init`

Use `envman lock` to remove it.

If you do not want a plaintext local cache at all, do not use `unlock`.

## Backups and Rotation

`envman passphrase rotate`:

- validates the current passphrase against all saved profiles
- creates timestamped backups under `.envman/backups/`
- rewrites profile files with a new wrapped key

Rotation protects you from losing access during the rewrite, but the backups are still encrypted with the previous passphrase and should be handled accordingly.

## Practical Limits

- Anyone who can read your live local `.env` files can read the secrets directly.
- Anyone who can read your shell history or exported environment variables may recover passphrases if you pass them unsafely.
- `envman` does not handle audit logs, per-user access control, or server-side secret revocation.

Use it when repo-native encrypted sharing is the right level of tooling. Do not present it as a substitute for a full vault product.
