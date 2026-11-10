# MIPS Pipeline Workbench

[![CI](https://github.com/JasonStys/mips-pipeline-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/JasonStys/mips-pipeline-workbench/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JasonStys/mips-pipeline-workbench/actions/workflows/codeql.yml/badge.svg)](https://github.com/JasonStys/mips-pipeline-workbench/actions/workflows/codeql.yml)
[![Rust 1.98](https://img.shields.io/badge/Rust-1.98-000000?logo=rust)](rust-toolchain.toml)
[![Node 24 LTS](https://img.shields.io/badge/Node.js-24%20LTS-5FA04E?logo=nodedotjs)](web/package.json)

A dependency-light educational workbench that connects assembly source to machine words, architectural execution, five-stage pipeline timing, cache behavior, and an accessible browser trace. It is designed to make low-level reasoning inspectable: every accepted instruction has documented semantics, every run is bounded, and the pipelined core is differentially checked against an independent sequential interpreter.

This project models a deliberately small MIPS32-inspired subset. It is not a complete ISA implementation or a hardware-timing claim; the exact boundary is documented in [the ISA profile](docs/isa-profile.md).

## Why this project exists

Computer-architecture demonstrations often stop at assembly syntax or display an animation disconnected from executable semantics. This repository keeps the layers together:

1. A two-pass assembler resolves labels and emits fixed-width words.
2. A sequential interpreter establishes an understandable architectural baseline.
3. An independent IF/ID/EX/MEM/WB implementation models forwarding, interlocks, and flushes.
4. Differential tests require both execution engines to converge on the same registers and memory.
5. A versioned JSON trace drives a keyboard-accessible TypeScript/HTML visualizer.

## Quick start

Prerequisites: Rust 1.98 and Node.js 24 LTS.

```bash
cargo run --locked -- pipeline examples/hazard-demo.asm trace.json
npm --prefix web ci --ignore-scripts
npm --prefix web test
```

Open `web/dist/index.html` through any local static-file server, then choose `trace.json` under **Explore your own trace**. Files remain local to the browser; there is no upload or execution endpoint. The shipped demo remains available with **Reload demonstration**. Use the slider, cycle-number jump, next-event control or Play/Pause to inspect instruction labels and hazards. Final registers describe the completed simulation, even when only a bounded prefix was retained.

See the [trace explorer guide](docs/trace-explorer.md) for controls, file bounds, validation messages and changed-file responsibilities.

Run the complete local gate on Linux, macOS, or WSL:

```bash
./scripts/verify.sh
```

Equivalent individual commands are listed in [docs/testing.md](docs/testing.md).

## Major features

- **Two-pass assembler:** labels, comments, precise line diagnostics, conventional register names, decimal/hexadecimal literals, `.word`, and the single-word `li` and `move` conveniences.
- **Reference interpreter:** wrapping integer operations, signed comparison, sparse zero-filled word memory, branch/jump behavior, immutable `$zero`, alignment checks, and a caller-controlled step limit.
- **Five-stage pipeline:** bounded IF/ID, ID/EX, EX/MEM, and MEM/WB latches; EX/MEM and MEM/WB forwarding; a one-cycle load-use interlock; taken-control flushes; draining after `halt`; and a bounded trace buffer.
- **Cache model:** configurable fixed set count, associativity, power-of-two line size, deterministic LRU replacement, and hit/miss statistics.
- **Trace visualizer:** strict local JSON/UTF-8 import (8 MiB / 10,000 cycles), atomic rejection of invalid files, play/pause, cycle/hazard navigation, editable-field keyboard guards, responsive semantic tables with a 100-row DOM window, and a 90 KB production size budget.
- **Truthful timing:** total cycle count and CPI remain independent of retained trace length, including when zero cycles were retained. Imported files are schema-validated, not certified execution evidence.
- **Engineering evidence:** deterministic fixtures, property-style operand generation, negative tests, reference/pipeline differential tests, immutable CI actions, CodeQL, dependency audits, and container builds.

## Supported instructions

| Group | Instructions |
|---|---|
| Register arithmetic | `addu`, `subu`, `and`, `or`, `slt`, `sll` |
| Immediate arithmetic | `addiu` |
| Memory | `lw`, `sw` |
| Control | `beq`, `bne`, `j` |
| Workbench control | `nop`, `halt` |
| Assembler conveniences | `li`, `move`, `.word` |

All instructions occupy one 32-bit word. Arithmetic is explicit wrapping arithmetic; memory operations require four-byte alignment. Details and encoding notes are in [docs/isa-profile.md](docs/isa-profile.md).

## CLI

```text
mips-workbench assemble <input.asm> <output.bin>
mips-workbench run <input.asm> [max-steps]
mips-workbench pipeline <input.asm> [trace.json] [max-cycles]
mips-workbench benchmark <input.asm> <report.json>
```

Examples:

```bash
cargo run --locked -- run examples/fibonacci.asm 500
cargo run --locked -- assemble examples/hazard-demo.asm hazard-demo.bin
cargo run --release --locked -- benchmark examples/fibonacci.asm benchmark.json
```

## Architecture

```text
assembly source
     │
     ▼
two-pass assembler ──► machine words ──┬──► sequential reference machine
                                      │
                                      └──► IF → ID → EX → MEM → WB
                                                       │
                                                       ▼
                                              versioned JSON trace
                                                       │
                                                       ▼
                                           TypeScript/HTML visualizer
```

The two execution paths share instruction definitions and encoding but not execution logic. This preserves one source of ISA truth while allowing meaningful differential verification. See [docs/architecture.md](docs/architecture.md) and [ADR 0001](docs/adr/0001-independent-pipeline-and-reference-core.md).

## Complexity and bounds

| Operation | Time | Space | Bound or rationale |
|---|---:|---:|---|
| Assembly | `O(n log s)` | `O(n + s)` | `n` source statements and ordered `s`-label table; diagnostics favor deterministic ordering |
| Reference step | expected `O(log m)` | `O(m)` | sparse ordered memory with `m` initialized/written words |
| Pipeline cycle | `O(1)` | `O(m + t)` | four fixed latches; retained trace capped by `max_trace_cycles` |
| Cache access | `O(w)` | `O(sets × w)` | `w` ways; constant for fixed associativity |
| Trace validation | `O(c + r)` | `O(c + r)` | browser rejects over 10,000 cycles; exactly 32 registers |
| UI cycle selection | `O(c)` event availability plus `O(w)` rendering | `O(c)` data / `O(w)` DOM | `w = 100`; no full-trace DOM rendering |

Execution has a default 100,000-step/cycle safety limit. Cache dimensions, trace length, instruction operands, addresses, and external JSON are validated before use.

## Verification evidence

The current local verification result is recorded in [docs/reports/validation.md](docs/reports/validation.md):

- 23 Rust tests across assembler, ISA properties, interpreter behavior, cache replacement, hazards, bounds, differential execution and retention-independent timing.
- 11 TypeScript tests for strict trace/file validation and navigation helpers; four real-browser user journeys cover import, playback, failed-import preservation, text-only labels, mobile layout and 10,000-cycle rendering.
- 10,000 generated operand sets exercised across every encodable instruction family.
- Warning-free `rustfmt`, Clippy `all`/`pedantic`/`nursery`, locked release build, npm audit, TypeScript strict mode, production smoke test, code-index freshness, and repository-policy validation.

Automated tests demonstrate observed behavior; they do not prove absence of defects or hardware equivalence.

## Repository map

| Path | Responsibility |
|---|---|
| `src/assembler.rs` | Two-pass parsing, label resolution, operand validation, and encoding |
| `src/isa.rs` | Instruction domain model, machine-word codec, register metadata, disassembly, and dependency metadata |
| `src/machine.rs` | Sequential architectural reference execution and bounded run policy |
| `src/pipeline.rs` | Independent five-stage execution, forwarding, interlocks, flushes, and trace serialization |
| `src/cache.rs` | Bounded set-associative cache and LRU replacement |
| `src/main.rs` | CLI commands, file boundaries, trace export, and microbenchmark runner |
| `tests/` | Unit, negative, property-style, and differential integration tests |
| `examples/` | Deterministic assembly programs for hazards, loops, memory, and locality |
| `web/src/model.ts` | Versioned trace schema and trust-boundary validation |
| `web/src/app.ts` | Accessible trace interaction and DOM rendering |
| `web/src/styles.css` | Responsive visual system and reduced-motion behavior |
| `web/public/` | Semantic HTML shell and generated demonstration trace |
| `scripts/` | Repository verification and exact declaration index generation |
| `docs/` | Architecture, ISA, security, operations, testing, limitations, decisions, and reports |
| `.github/workflows/` | Cross-platform CI, policy, container, and security analysis |

Exact declaration and important state locations are generated in [docs/code-index.md](docs/code-index.md).

## Documentation

- [Architecture](docs/architecture.md)
- [ISA profile](docs/isa-profile.md)
- [Testing strategy](docs/testing.md)
- [Security model](docs/security.md)
- [Operations and release runbook](docs/operations.md)
- [Known limitations](docs/limitations.md)
- [Research notes](docs/research.md)
- [Validation report](docs/reports/validation.md)
- [Performance report](docs/reports/performance.md)

## Safety and responsible use

The browser UI only reads a static trace. The CLI does not execute host commands, and execution is bounded by default. Assembly programs can consume CPU up to the configured limit and allocate sparse memory for stores, so untrusted inputs should still be processed under operating-system resource limits. Report suspected vulnerabilities through [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)


## Documentation editions

Start with the [organized handbook](docs/handbook.md) for current usage, design, security and test guidance. Reviewed downloadable editions: [project-guide.docx](docs/reports/project-guide.docx).

[Publication identities and source scope](docs/reports/publications.json) · [Documentation validation record](docs/reports/documentation-refresh-2026-11-09.md). Historical results retain their own tested revision and date.
