# Merge Strategy

`envman fetch` is merge-first by default and replace-first only when `--replace` is explicitly requested.

## Default Merge Rules

For each tracked env file:

1. Parse the saved profile file.
2. Parse the local file if it exists.
3. Compare keys, not raw file text.
4. Build a merge plan.

Key-level behavior:

- Saved only: add the key locally.
- Local only: keep the key locally.
- Same key, same value: leave it unchanged.
- Same key, different value: mark a conflict and stop the fetch.

If any file has conflicts, `envman fetch` aborts without writing any files.

## Replace Mode

`envman fetch --replace` skips merge protection and writes the saved file contents exactly as stored in the profile.

Use replace mode when:

- you want the repo snapshot exactly
- you are onboarding a fresh machine
- you intentionally want to discard local env drift

## Dry Run

`envman fetch --dry-run` prints the same plan without writing files.

Typical output includes:

- `create`
- `replace`
- `merge add=<n> keep-local=<n> unchanged=<n>`
- `conflict(s)` followed by the affected keys

## Parsing Rules

Merge and diff rely on `envman` being able to parse the file as standard dotenv content.

Supported:

- `KEY=value`
- quoted values such as `KEY="value with spaces"`
- blank lines
- comment lines beginning with `#`

Rejected for safe merge:

- lines without `=`
- invalid env keys
- syntax `envman` cannot round-trip predictably

If parsing fails for a file, merge stops for that file and you must use `--replace` if you want to overwrite it.

## Normalization

Merged files are rewritten in normalized form:

- one `KEY=value` entry per line
- trailing newline at EOF
- values quoted when needed for correctness
- local key order is preserved for existing local entries
- saved-only keys are appended after local keys

This means comments and exact formatting are not preserved during merge mode.

## Scope Behavior

When `--scope` is provided, merge planning only considers files inside the exact subtree or exact file path requested.

Examples:

- `--scope apps/api` matches `apps/api/.env`
- `--scope apps/api/.env.local` matches only that file
- `--scope apps/api` does not match `apps/api-admin/.env`
