# Contributing

## Development contract

Changes must preserve the explicit ISA boundary, deterministic fixtures, bounded execution, independent execution cores, source headers, exact code index, and documentation accuracy. New instructions require assembler, codec, reference, pipeline, property, differential, and documentation updates in the same change.

## Workflow

1. Create a focused branch.
2. Add or update tests before changing behavior.
3. Run `cargo fmt --all` and the complete `scripts/verify.sh` gate.
4. Regenerate `docs/code-index.md` with `npm run code-index`.
5. Update the trace fixture only when pipeline output intentionally changes.
6. Update `CHANGELOG.md` and relevant documents for user-visible behavior.
7. Open a pull request explaining the problem, design, tests, performance impact, and limitations.

## Code style

- Prefer semantic types, explicit bounds, typed failures, and small pure helpers.
- Avoid unsafe Rust; the crate forbids it.
- Treat external JSON and assembly source as untrusted.
- State complexity when adding non-trivial algorithms or structures.
- Keep comments focused on invariants and decisions rather than restating syntax.
- Every authored source file begins with a file-purpose header; declarations and major state are indexed exactly in `docs/code-index.md`.

## Commit hygiene

Do not commit generated build directories, credentials, private data, proprietary assembly, large opaque binaries, or unrelated formatting changes. Keep commits reviewable and use imperative summaries.

