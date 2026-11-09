# Testing Strategy

## Objectives

Testing concentrates on semantic correctness, parser rejection paths, architectural invariants, hazard behavior, resource bounds, and trust boundaries. Framework internals and trivial accessors are not tested merely to inflate counts.

## Test pyramid

| Area | Test type | Representative evidence |
|---|---|---|
| Instruction codec | property-style unit | 10,000 deterministic operand sets across every instruction family |
| Assembler | unit/negative | forward/backward labels, aliases, raw words, duplicates, malformed operands |
| Reference machine | integration/negative | memory, loops, immutable zero, alignment faults, non-termination limit |
| Pipeline | differential/integration | all example programs match reference registers and memory |
| Hazards | exact behavioral | forwarding creates no avoidable stall; load-use inserts one bubble; control transfer flushes |
| Cache | unit | hit/miss accounting, conflict behavior, LRU replacement, invalid configuration, reset |
| Trace contract | TypeScript unit/negative | schema, length, numeric ranges, register shape, cycle navigation |
| Local browser workflows | Real browser journeys | local import, atomic failure, text-only labels, playback, editable keyboard focus, mobile viewport, 100-row rendering of 10,000 cycles |
| Production assets | smoke/budget | required artifact set, semantic markers, non-empty files, 90 KB cap |
| Repository | policy | headers, docs, immutable actions, credential patterns, code-index freshness, bounds |
| Container | build integration | locked Rust build and tested static web assets in a non-root runtime image |

## Local commands

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --all-targets --locked
cargo build --release --locked

npm --prefix web ci --ignore-scripts
npm --prefix web audit --audit-level=high
npm --prefix web test
npm --prefix web run smoke
npm --prefix web exec -- playwright install chromium
npm --prefix web run test:browser

npm run code-index:check
npm run validate
```

Regenerate and verify the checked-in trace:

```bash
cargo run --locked -- pipeline examples/hazard-demo.asm web/public/demo-trace.json
git diff --exit-code -- web/public/demo-trace.json
```

## Coverage targets

Behavioral targets replace a fragile line-percentage target:

- Every supported instruction family has encode/decode generated coverage.
- Every external input boundary has positive and negative coverage.
- Every documented pipeline hazard policy has an assertion.
- At least one looping, memory-using, branching example is differentially executed.
- Infinite execution, unaligned memory, invalid labels/registers, invalid cache shapes, bad trace schemas, and oversized traces fail safely.

## CI mapping

- `Rust (ubuntu/windows)`: format, warning-free Clippy, tests, release build, and deterministic trace regeneration.
- `Web`: locked install, high-severity dependency audit, strict compilation, Node tests, production build, size smoke and Chromium user journeys.
- `Repository policy`: generated declaration-index freshness, headers/docs/action pins/secret patterns/bounds, and clean-tree assertion.
- `Container`: reproducible multi-stage build.
- `CodeQL`: JavaScript/TypeScript security-and-quality analysis.

## Known gaps

Browser journeys do not replace native fuzzing, formal verification, screen-reader inspection or a complete ISA conformance suite. Local 2026-11-09 results are recorded in [the workflow report](reports/practical-workflows-2026-11-09.md). The browser runner uses its own loopback server and refuses occupied ports; `MIPS_BROWSER_PORT` selects an alternate. `MIPS_BROWSER_CHANNEL=msedge` can use an installed Edge browser locally; CI installs Chromium. The test server exposes only fixed built assets, not arbitrary filesystem paths.

