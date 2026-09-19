#!/usr/bin/env bash
# File: Runs the same deterministic Rust, web, and repository gates used in continuous integration.
# Major function: main command sequence. State: strict shell flags and workspace-relative paths only.
set -euo pipefail

cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --all-targets --locked
cargo build --release --locked
npm --prefix web ci --ignore-scripts
npm --prefix web audit --audit-level=high
npm --prefix web test
npm --prefix web run smoke
npm run code-index:check
npm run validate
git diff --exit-code

