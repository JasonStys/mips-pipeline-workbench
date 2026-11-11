# Limitations and Roadmap

## Current limitations

- The ISA is a documented educational subset, not a complete MIPS revision.
- `halt` is workbench-specific, and the model has no delay slots, exceptions, interrupts, floating point, HI/LO, syscalls, linker, or relocations.
- Instructions and data share a sparse map; there is no page protection or separate instruction/data address space.
- Cache access statistics are available as a standalone model but cache latency is not yet coupled to pipeline timing.
- Branches resolve in EX without prediction. There is no superscalar issue, speculation, out-of-order execution, or precise exception machinery.
- The pipeline trace captures at most the configured number of cycles. Summary cycles/CPI count the complete execution independently; final registers are not per-cycle snapshots.
- JSON serialization is local and schema-specific rather than powered by a general serialization library.
- The visualizer imports bounded local version-one JSON traces but does not assemble or execute user input, and cannot certify that imported results came from the reference-checked Rust engine.
- Four browser journeys exercise core import/navigation behavior. Automated accessibility scanning, screen-reader certification, screenshot regression, native fuzzing, mutation testing and formal verification remain outside the current evidence.
- Performance results characterize the simulator on one documented environment and must not be interpreted as processor performance.

## Prioritized roadmap

1. Add a streaming trace writer without changing independent total-cycle accounting.
2. Connect instruction/data cache misses to configurable pipeline wait states.
3. Add a WebAssembly build so local assembly can be simulated without a server.
4. Expand browser journeys with accessibility scanning while retaining manual screen-reader checks.
5. Add a maintained fuzz harness for assembler and decoder inputs.
6. Expand the ISA only alongside encoding vectors, reference semantics, pipeline tests, and documentation.

## Non-goals

- Binary compatibility with every MIPS toolchain or processor.
- Cycle accuracy for a commercial core.
- Executing arbitrary host commands or accepting public uploads.
- Replacing a hardware description language, silicon simulator, debugger, or production emulator.


## Native studio scope

- The real Rust engine implements the documented educational ISA subset. Self-modifying programs can
  expose a reference/pipeline mismatch, which is retained as discrepancy evidence. No commercial ISA,
  timing, compiler, hardware execution or formal correctness certification is claimed.
- Cache inputs are independent byte-address experiments; they are not inferred from pipeline accesses
  and do not measure real processor caches. Zero accesses/retained cycles remain explicit missingness.
- Workspaces are plaintext for one trusted OS owner, with no multiuser identity or remote service.
  Back up the stopped external workspace. Admission checks refuse ordinary aliases/program paths;
  they do not resist a concurrent namespace attacker with the same OS authority.
- Native candidates are unsigned portable archives. Actual extracted launch/browser/persistence checks
  do not prove an OS installer transaction, clean-machine availability or manual browser-opener behavior.
  Platform/release availability requires its own accepted checks. WebAssembly is a future browser-only
  option, not an implemented fallback; missing native resources fail closed.
