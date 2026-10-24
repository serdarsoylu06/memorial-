# Safety changes and validation

This branch is based on current `main` and selectively replaces the older work in PR #2. It preserves YAML device rules, sidecars, source-folder/session grouping, configurable scan gaps, and frontend operation/progress flows.

## File operations

- Existing destinations are conflicts, even when their bytes match. Copy never moves a source into `DUPLICATES`.
- Every real copy/move writes a temporary file in the destination directory, verifies SHA-256, and publishes with `persist_noclobber`. Sources are removed only after verified publication for moves.
- Moves also use verified copying on the same filesystem. This is slower than rename and temporarily needs destination space equal to the source size.
- Dry-run validates sources, existing destinations, parent paths and duplicate batch targets without creating directories. It cannot guarantee free space or future permissions, and a batch is not a transaction: earlier completed files remain if a later file fails.
- Existing symlinks in source/destination paths are rejected. Use real directory paths, including on macOS where `/tmp` itself may be a symlink. Archive directories and sources must not be concurrently replaced by untrusted processes; this is not a sandbox against a malicious local user racing directory operations.
- On Unix, destination-directory sync is required before source deletion. Unsupported filesystem operations fail while retaining the source. Exercise real exFAT media before enabling moves for valuable archives.

## ZIP imports

Each archive is extracted into a fresh `STAGING/memorial-import-*` directory. The command returns actual extracted file paths. On any validation/decompression/write error, partial import output is removed. Existing imports are retained.

Limits: 10,000 entries; 2 GiB per file; 8 GiB total expanded bytes. Output is streamed with an actual-byte limit. Path escapes, Windows drive/backslash paths, symlinks, special entries and destination collisions are rejected. macOS metadata is skipped. Empty archives do not retain an import directory.

## Checks

```sh
npm ci
npm run type-check
npm run lint -- --max-warnings 0
npm test
npm run build
cargo test --locked --manifest-path tests/safety/Cargo.toml
cargo clippy --locked --manifest-path tests/safety/Cargo.toml --all-targets -- -D warnings
```

The safety harness imports the actual production Rust modules, with dependency versions locked to those used by the desktop application. It does not require GTK/WebKit. Run desktop checks separately on a host with Tauri prerequisites (the CI desktop job uses macOS):

```sh
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets
npm run tauri build -- --bundles app
```

Rust 1.88 is the declared/tested toolchain for the current dependency lock. Confidence values now serialize as lowercase, matching TypeScript. Device strings stay extensible for YAML rules; sidecars remain in the wire contract. Inbox approvals reset whenever a new scan result replaces the previous one. The runtime-only inbox store intentionally retains `Set` values; it is not JSON-persisted. Settings retain the existing `memorial-app-settings` storage key.

## Manual desktop release gate

On macOS with copies of media (including an exFAT volume): select HDD root via dialog; scan mixed photos/videos and sidecars; check lowercase confidence and two sessions on the same day; change the scan gap; restart and verify settings. Run dry-run, copy, and move; confirm identical/different existing targets are not replaced, source files remain after failures, and progress terminates. Import valid and invalid ZIPs and inspect STAGING. Check the packaged app's console for CSP violations during IPC, dynamic imports, thumbnails and local media. Remote `TAURI_DEV_HOST` setups may need their exact HMR origin added to `devCsp`.

CI build success is not a substitute for this native smoke test. Broader follow-ups include atomic manifest/log writes, root-scoped authorization for custom Rust filesystem commands, and independent metadata/duplicate-algorithm coverage. PR #2 is intentionally left unchanged; do not merge its old backend over current `main`.
