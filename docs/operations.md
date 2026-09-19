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
4. Build the container: `docker build --tag mips-pipeline-workbench:1.0.0 .`.
5. Create a signed version tag only after the default-branch workflows pass.

### Post-release

- Confirm release artifacts start and display help.
- Confirm the published source matches the tagged commit.
- Monitor dependency and security update pull requests.
- Record any exception or failed drill in `docs/reports/`.

## Rollback

No database or remote state is mutated. Roll back by returning consumers to the preceding signed tag or container digest. Regenerate traces with that version because trace schema compatibility is guaranteed only for explicitly documented schema versions.

## Rollback triggers

- Reference and pipeline state disagree on a supported fixture.
- A supported input produces nondeterministic output.
- A high-severity dependency or workflow vulnerability affects the released path.
- The visualizer accepts an invalid or unbounded trace.
- The container runs as root or includes build credentials.

## Troubleshooting

- `code index is stale`: run `npm run code-index`, review every line change, and commit the regenerated file.
- Rust toolchain mismatch: run `rustup show`; `rust-toolchain.toml` should select 1.98.0.
- npm engine mismatch: use Node 24 LTS; the project intentionally rejects Current/EOL lines.
- Trace diff after an unrelated change: verify deterministic stage labels and counters before updating the fixture.
- Execution limit failure: inspect the program for a missing `halt` or loop termination; raise the limit only for a reviewed finite program.

