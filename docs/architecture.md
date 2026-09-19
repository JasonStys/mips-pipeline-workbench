# Architecture

## Context and goals

The workbench must connect source code, encoding, architectural correctness, pipeline timing, and a usable explanation layer without turning into a complete processor emulator. The primary quality attributes are deterministic behavior, diagnosability, bounded resource use, portability, and separation between correctness and timing models.

## Components and data flow

```text
           pass 1: symbols           pass 2: encoding
source ─────────────────────► assembler ─────────────────► Program
                                                            │
                              ┌─────────────────────────────┴─────────────────────────┐
                              │                                                       │
                              ▼                                                       ▼
                   sequential interpreter                                  pipeline simulator
                   one instruction/step                                    IF/ID/EX/MEM/WB
                              │                                                       │
                              └──────── registers + memory differential check ───────┘
                                                                                     │
                                                                                     ▼
                                                                            bounded trace JSON
                                                                                     │
                                                                                     ▼
                                                                            browser visualizer
```

### Assembler

Pass one strips comments, validates labels, and assigns each non-empty statement a four-byte address. Pass two parses operands and emits one word per statement. Keeping pseudo-instructions to one word makes symbol addresses stable across both passes. A `BTreeMap` provides deterministic symbol ordering and `O(log s)` operations.

### ISA domain model

`Instruction` is the shared semantic vocabulary for parsing, encoding, dependency metadata, decoding, and disassembly. Both execution engines use the same decoded values but implement execution independently. Unknown words fail closed.

### Sequential reference machine

The reference machine makes one state transition per instruction. It is intentionally simple enough to review: fetch, decode, execute, update `$zero`, increment the retired count. Sparse `BTreeMap` memory is deterministic, zero-filled on absent reads, and aligned at the API boundary.

### Pipeline simulator

The pipeline owns four bounded latches:

- IF/ID: fetched instruction and its program counter.
- ID/EX: decoded instruction awaiting execution.
- EX/MEM: ALU/address/store-data output.
- MEM/WB: final value and optional register destination.

Write-back occurs before execute reads the current register file. EX/MEM forwarding has priority over MEM/WB forwarding, except loads whose values do not exist until MEM. A load followed by a dependent instruction freezes IF/ID and fetch for one cycle and inserts a bubble into ID/EX. Taken branches and jumps resolve in EX, discard younger work, and redirect the program counter. `halt` stops new fetches and drains older pipeline work.

### Cache model

Each address maps to a block, set, and tag. A hit updates a monotonic logical clock. A miss chooses the first invalid line or the least-recently-used valid line. Scanning a set is `O(w)` for `w` ways and storage is exactly `sets × ways` lines.

### Trace boundary and visualizer

The Rust core writes schema version 1 JSON. TypeScript treats loaded JSON as `unknown`, validates every field, limits traces to 10,000 cycles, requires 32 unsigned registers, and caps labels at 240 characters. DOM text is assigned with `textContent`; no trace value is interpreted as markup.

## Failure modes

| Failure | Detection | Behavior |
|---|---|---|
| Unknown mnemonic or operand | assembler pass two | line-numbered error; no output program |
| Duplicate/invalid label | assembler pass one | line-numbered error |
| Unknown machine word | decoder | execution stops with the original word |
| Unaligned fetch/load/store | execution boundary | typed error; no partial operation |
| Non-terminating program | step/cycle counter | bounded failure at caller limit |
| Excessive trace | retained-trace cap / browser validator | simulation continues with bounded evidence; browser rejects oversized input |
| Stale checked-in trace | CI regenerates and diffs | pull request fails |
| Divergent execution cores | differential integration tests | CI fails with state difference |

## Trade-offs

- Ordered sparse memory is slower than a contiguous vector but provides deterministic iteration, zero-fill semantics, and safe high-address examples without reserving a large address space.
- Branches resolve in EX with no speculative recovery machinery. The resulting model is easier to explain but intentionally less advanced than modern processors.
- Trace JSON is serialized without a runtime dependency. The schema is small and fixed; if it grows, a maintained serialization crate should replace the local encoder.
- The web layer renders a checked-in trace rather than executing Rust in WebAssembly. This keeps the first release small and auditable; direct interactive assembly is a possible later extension.

## Scale triggers

Revisit the design if the supported program size, trace volume, or ISA expands materially. Likely changes would be paged memory, streaming trace export, a generated decoder table, worker-based visualization parsing, and more formal specification tests. These should be driven by measured need rather than added preemptively.

