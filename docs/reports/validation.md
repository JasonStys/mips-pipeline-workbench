# Validation Report

**Validated:** 2026-09-18  
**Environment:** Windows x86-64, Rust 1.98.0, Cargo 1.98.0, Node.js 24.18.1, npm 11.16.0

## Result

All implemented local gates passed.

| Gate | Result | Evidence |
|---|---|---|
| Rust formatting | Pass | `cargo fmt --all -- --check` produced no diff |
| Rust static analysis | Pass | Clippy `all`, `pedantic`, and `nursery`; warnings denied; unsafe code forbidden |
| Rust tests | Pass | 22 passed, 0 failed |
| Generated codec cases | Pass | 10,000 deterministic operand sets across 12 instruction forms |
| Differential execution | Pass | hazard, Fibonacci, cache-walk, and 128 generated straight-line programs matched reference state |
| Release build | Pass | locked optimized build completed |
| TypeScript strict build | Pass | TypeScript 7 strict configuration produced no diagnostics |
| Browser-model tests | Pass | 4 passed, 0 failed |
| npm dependency audit | Pass | 0 vulnerabilities reported |
| Production smoke | Pass | 5 required files; 27,553 bytes against 90,000-byte budget |
| Trace generation | Pass | 18 cycles, 11 retired instructions, CPI 1.636, 1 load-use stall, 4 flushed slots |
| Repository policy | Pass | required docs, headers, immutable workflow pins, credential patterns, and execution bounds checked |

## Behavioral observations

The hazard fixture finished with `$t2 = 13`, `$t3 = 13`, `$t4 = 26`, `$t5 = 21`, `$sp = 256`, and memory word 256 equal to 13. The pipeline result matched the reference interpreter. The Fibonacci fixture stored 55 at address 512.

## Manual interface checks

- Cycle selection works through the range input and Previous/Next buttons.
- Left and right arrow keys update the selected cycle.
- Native focus indicators remain visible.
- The trace table has named columns and a keyboard-focusable scroll region.
- Reduced-motion preferences disable smooth scrolling behavior.
- The rendered application was visually inspected at a 765 × 945 browser viewport with no horizontal page overflow; wide/narrow breakpoint rules were also reviewed in source.

Automated browser accessibility and cross-browser tests are not included in version 1.0; this gap is stated in [limitations](../limitations.md).

## Hosted verification

The published code commit `e325b51` passed every hosted gate:

- [CI run 35413132729](https://github.com/JasonStys/mips-pipeline-workbench/actions/runs/35413132729): success.
  - Rust 1.98 formatting, warning-free Clippy, 22 tests, locked release build, and trace reproducibility passed on Ubuntu 24.04 and Windows 2025.
  - The TypeScript visualizer's locked install, dependency audit, 4 tests, production build, smoke check, and artifact upload passed.
  - Repository policy and generated-evidence freshness passed.
  - The multi-stage, non-root container image built successfully on the hosted BuildKit runner. The local Docker daemon was unavailable, so this hosted build is the container evidence.
- [CodeQL run 35413132819](https://github.com/JasonStys/mips-pipeline-workbench/actions/runs/35413132819): success for the JavaScript/TypeScript security-and-quality query suite.
- Initial Cargo, npm, GitHub Actions, and Docker Dependabot update jobs all completed successfully and opened no update pull requests.

The follow-up commit changes this report only; it does not alter the validated implementation.
