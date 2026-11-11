# ADR: native assembly and trace studio

**Status:** Accepted for implementation; delivery requires the native acceptance gates.
**Date:** 11 November 2026
**Author:** Jason Stys

## Context

The project already has a real Rust assembler, independent sequential and five-stage
execution engines, a cache model and an accessible TypeScript trace explorer. The
browser currently accepts completed trace files; it cannot run a user's assembly.
The desktop application must retain those engines and their original tests, accept
real custom inputs, preserve useful results and work without an IDE or installed SDK.
This is an educational ISA subset, not host-code execution or hardware measurement.

## Decision

Use the existing TypeScript interface for editing assembly, configuring bounded runs,
reviewing trace/register/memory/listing results and cache experiments. An owned Python
standard-library loopback service invokes only the bundled, hash-verified Rust engine
with fixed commands, bounded source/configuration, owned temporary files and a finite
execution deadline. It never executes submitted Python, shell or arbitrary binaries.
A native Tk owner provides workspace selection, Open, Help and completion-based Exit.

An OS-user workspace outside installed files stores source-bound results and history.
Its marker, lock, database/recovery members and ancestors must be admitted before
mutation. Every private HTTP operation requires the exact bound authority and this
instance's unpredictable capability; mutations also require the exact Origin.
Browser storage may retain an ephemeral capability for this origin's tab lifetime;
it is invalid when the owned service stops. It is not an account password or a promise
of secrecy from the same OS user, administrator or trusted browser extension.

The standalone trace explorer remains useful without the native service. Imported
traces remain structurally validated evidence, not certified execution. Fresh native
runs separately report comparison of the actual independent execution engines. Cache
address experiments use the real cache model and are not mislabeled as measured CPU
cache timing or as pipeline-coupled accesses.

## Options considered

| Option | Benefits | Costs and limits |
| --- | --- | --- |
| Preserve browser UI with a small native owner and real Rust engine | Retains tested trace interaction; bundled SDK-free use; explicit local lifecycle and evidence | Requires loopback/capability and packaging tests; browser opener differs by OS |
| Rewrite the complete UI in Tk | Fewer web boundaries | Discards the accessible tested trace explorer and duplicates existing UI behavior |
| Add Electron as another bundled runtime | Integrated browser window and mature packaging | Much larger distribution and another independently patched runtime for this small educational app |

The first option keeps language responsibilities clear: Rust executes the model,
TypeScript presents it, Python owns local process/storage/lifecycle and SQLite keeps
ordered evidence. No external service, paid API or Docker dependency is introduced.

## Consequences and verification

- Native source/version, Rust binary and compiled UI identities must match before
  private state opens; a missing compiler cannot silently fall back to Python results.
- Exact independent register/memory and Halt-PC oracles cover execution; hand-counted
  address sequences cover LRU cache behavior. Malformed, unbounded or nonterminating
  inputs preserve the prior accepted result and create no success history entry.
- Actual user journeys must edit inputs, inspect hazards, export/reimport, reopen
  history and normally close the owned application. Fixture/profile paths remain
  separate from normal user data and existing services are never reused.
- The package remains an unsigned portable application unless an actual installer
  transaction is separately built and verified. Cross-platform delivery is claimed
  only for operating systems with successful native builds and acceptance evidence.
