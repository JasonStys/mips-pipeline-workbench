# Operations and Release Runbook

## Build prerequisites

- Rust 1.98 through `rustup`.
- Node.js 24 LTS with the npm version bundled by that release.
- Git.
- Docker with BuildKit only for the optional image check.

## Routine development

1. Make a focused change and update relevant tests.
2. Run `cargo fmt --all`.
3. Run `./scripts/verify.sh` or each command from [testing.md](testing.md).
4. If pipeline output intentionally changed, regenerate `web/public/demo-trace.json` and explain the behavior change.
5. Run `npm run code-index` after declarations move.
6. Update architecture, ISA, security, operations, limitations, and reports when their claims change.

## Release checklist

### Pre-release

- [ ] Rust and TypeScript tests pass from locked dependencies.
- [ ] Clippy and TypeScript report zero warnings/errors.
- [ ] The checked-in trace regenerates byte-for-byte.
- [ ] Repository validation and code-index freshness pass.
- [ ] npm audit has no high-severity finding.
- [ ] CI, container build, and CodeQL are green on `main`.
- [ ] Changelog and version fields agree.
- [ ] Documentation states current limits and does not overclaim hardware fidelity.
- [ ] `git status --short` is empty.

### Release

1. Build with `cargo build --release --locked`.
2. Build and smoke the visualizer with `npm --prefix web test && npm --prefix web run smoke`.
3. Exercise `run`, `pipeline`, and `assemble` against `examples/hazard-demo.asm`.
4. Build the container: `docker build --tag mips-pipeline-workbench:1.1.0 .`.
5. Create an immutable version tag only after the default-branch workflows pass; describe signing status accurately.

### Post-release

- Confirm release artifacts start and display help.
- Confirm the published source matches the tagged commit.
- Monitor dependency and security update pull requests.
- Record any exception or failed drill in `docs/reports/`.

## Rollback

The original CLI/container uses files; the native application additionally retains an external SQLite workspace. Stop the app and back up that workspace before changing versions. Preserve old software folders and do not pair an older unsupported schema with newer data. There is no remote state migration. Trace schema compatibility applies only to documented schema versions.

## Rollback triggers

- Reference and pipeline state disagree on a supported fixture.
- A supported input produces nondeterministic output.
- A high-severity dependency or workflow vulnerability affects the released path.
- The visualizer accepts an invalid or unbounded trace.
- The container runs as root or includes build credentials.

## Troubleshooting

- `code index is stale`: run `npm run code-index`, review every line change, and commit the regenerated file.
- Rust toolchain mismatch: run `rustup show`; `rust-toolchain.toml` should select 1.98.1.
- npm engine mismatch: use Node 24 LTS; the project intentionally rejects Current/EOL lines.
- Trace diff after an unrelated change: verify deterministic stage labels and counters before updating the fixture.
- Execution limit failure: inspect the program for a missing `halt` or loop termination; raise the limit only for a reviewed finite program.


## Native application delivery

See [the native application guide](native-application.md) for actual owner/workspace controls,
record/byte limits and clean-source build commands. Packaging tests the archive after bounded safe
extraction, drives real custom assembly/cache/history/export/import-rerun in Chromium, normally exits
and launches the same actual executable again to verify persistence. It emits a checksum only after
acceptance. The Windows package is a portable ZIP, not an installed MSI/NSIS transaction. Do not
claim a platform/download is available until that platform's actual native checks and root-reviewed
release proof pass. Existing published editions and user profiles are preserved.
