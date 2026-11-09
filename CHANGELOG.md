# Changelog

All notable changes follow semantic versioning and are recorded here.

## Unreleased - 2026-11-09

- Strict bounded local trace import, useful playback/cycle/hazard controls, safe error recovery and a 100-row table window.
- File/UTF-8/schema regressions and real-browser desktop/mobile import/navigation journeys in CI.
- Correct total cycles and CPI independently of retained evidence length, verified at trace caps 0, 1 and 3.

## [1.0.0] - 2026-09-18

### Added

- Two-pass MIPS-like assembler with labels, aliases, diagnostics, `.word`, `li`, and `move`.
- Independent sequential interpreter and five-stage pipeline implementation.
- Forwarding, load-use interlock, control-hazard flush, alignment checks, and bounded execution.
- Configurable set-associative LRU cache model.
- Versioned trace JSON and accessible TypeScript/HTML visualizer.
- Deterministic examples, 22 Rust tests, 4 TypeScript tests, repository policy, CI, CodeQL, Dependabot, and container build.
- Architecture, ISA, testing, security, operations, limitations, research, decision, code-index, and validation documentation.

