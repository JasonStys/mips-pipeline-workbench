# Research Notes

The implementation was informed by primary or official sources and then narrowed to an explicit educational profile.

## Instruction architecture

- MIPS training material describes fixed 32-bit instructions, 32 general-purpose registers, special behavior for GPR 0, register-register operations, and 16-bit immediate forms. The workbench preserves those recognizable fundamentals while documenting every omission and its custom `halt` encoding. [MIPS instruction-set overview](https://training.mips.com/basic_mips/PDF/Instruction_Set.pdf)

## Rust engineering

- Cargo treats files in `tests/` as integration-test targets and runs unit, integration, and documentation tests through `cargo test`. This repository separates black-box subsystem behavior into focused integration files. [Cargo targets and tests](https://doc.rust-lang.org/cargo/reference/cargo-targets.html#tests)
- `cargo test --locked` requires the committed lockfile to remain unchanged, supporting deterministic dependency resolution. [Cargo test reference](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- Cargo’s continuous-integration guidance recommends warning-clean official branches; this repository elevates Clippy warnings to errors. [Cargo CI guide](https://doc.rust-lang.org/cargo/guide/continuous-integration.html)

## TypeScript and Node.js

- TypeScript’s purpose is static checking before JavaScript runs. Strict compiler options complement—not replace—the explicit runtime validation applied to unknown JSON. [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- Node.js recommends supported LTS releases for production applications. Node 24 is pinned because it remains an LTS line and is supported through April 2028. [Node.js release schedule](https://nodejs.org/en/about/previous-releases) and [Node 24 migration note](https://nodejs.org/en/blog/migrations/v22-to-v24)

## CI supply-chain controls

- GitHub documents a full-length action commit SHA as the immutable reference and recommends explicit minimum token permissions. All third-party actions in this repository follow that policy. [GitHub Actions secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use)

## Applied conclusions

- ISA behavior is kept narrow and testable rather than presented as broad compatibility.
- Rust has no runtime crate dependencies in version 1.0; this is a maintenance choice, not a rejection of ecosystem libraries.
- Compile-time TypeScript types are paired with bounded runtime parsing at the JSON boundary.
- CI actions use immutable commits, and dependency managers use committed lockfiles.

