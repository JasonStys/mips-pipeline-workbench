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
- `CodeQL`: separate Rust/Python/JavaScript-TypeScript/Actions security-and-quality source analyses, explicit processed results and immutable action pins.

## Known gaps

Browser journeys do not replace native fuzzing, formal verification, screen-reader inspection or a complete ISA conformance suite. Local 2026-11-09 results are recorded in [the workflow report](reports/practical-workflows-2026-11-09.md). The browser runner uses its own loopback server and refuses occupied ports; `MIPS_BROWSER_PORT` selects an alternate. `MIPS_BROWSER_CHANNEL=msedge` can use an installed Edge browser locally; CI installs Chromium. The test server exposes only fixed built assets, not arbitrary filesystem paths.


## Native source and extracted application gates

The original behavioral Rust/TypeScript gates remain. The new `mips_studio` Python package has an
additional whole-package statement/branch-aware 90% minimum with owner code included; tools/tests
are outside that package denominator and have their own actual contracts. `pytest` includes real
Rust process output, SQLite/HTTP sockets, actual alias/hardlink/frozen-tree refusal, malformed
protocols, rollback/explicit deletion, source/runtime metadata and real Tk owner controls. The
mandatory 13 native Tcl notice fixtures run in one fresh bounded interpreter with stable descriptors;
report them separately from the parent pytest count. There are no retries or silent skips.

Native source CI runs on Windows/macOS/Ubuntu; Linux GUI tests run under Xvfb. The portable build job
separately compiles the actual Rust engine with a full source identity, freezes patched Python,
inspects/extracts the exact archive and drives its real compiled UI. An independent six-instruction
oracle requires registers[64,5,5,10], memory 64=5, HaltPC 24, six retired instructions,11 cycles and one
load-use stall. LRU[0,4,8,0,16,8,0] at 2sets/2ways/4bytes has 1hit/6misses. Physical line 3 diagnostics,
failed-input evidence retention, forged-report rerun, selected-record export, literal history and a
second normal executable launch are mandatory. Source tests also retain discrepancy cases rather
than blessing process exit 0.

```bash
python -m pip install --require-hashes -r requirements-dev.lock -r requirements-package.lock
cargo build --locked
python -m ruff check mips_studio tests tools launcher.py
python -m ruff format --check mips_studio tests tools launcher.py
python -m pytest --cov --cov-report=term-missing
python -m tools.package_app --output-root .runtime/native-new
```

Use the isolated environment, compiled UI and exact locked Chromium first; Linux prefixes GUI commands
with `xvfb-run -a`. The native workflow has no release writes or full-binary artifact uploads. Hosted
results and PR/main scan state remain pending until actually observed; workflow configuration tests
or successful local builds do not substitute for processed CodeQL/native results.
