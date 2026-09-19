# ADR 0001: Independent Pipeline and Reference Execution

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

A pipeline animation can look plausible while computing incorrect architectural state. A single execution engine with timing annotations is easier to maintain, but comparing it with itself provides weak evidence. Fully duplicating parsing, encoding, and instruction definitions would create a different inconsistency risk.

## Decision

Share the immutable `Instruction` model, codec, and dependency metadata. Implement architectural execution twice:

- `Machine` performs direct sequential state transitions.
- `PipelineSimulator` owns independent stage latches, forwarding, interlocks, memory-stage behavior, control recovery, and write-back.

Integration tests execute the same assembled programs through both implementations and compare all registers and sparse memory. Pipeline-specific tests independently assert stalls and flushes.

## Consequences

Positive:

- Meaningful differential evidence catches execution/timing implementation errors.
- One instruction definition prevents parser/decoder drift.
- The sequential path remains a readable oracle for new instruction work.

Negative:

- Each new instruction requires two execution implementations.
- A defect in the shared decoder can affect both paths, so codec property tests and known encodings remain necessary.
- More tests are required to distinguish architectural parity from timing correctness.

## Revisit when

The ISA becomes large enough that generated semantic definitions or an external conformance suite produces stronger evidence with lower maintenance cost.

