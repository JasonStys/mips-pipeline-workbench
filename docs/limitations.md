# Limitations and Roadmap

## Current limitations

- The ISA is a documented educational subset, not a complete MIPS revision.
- `halt` is workbench-specific, and the model has no delay slots, exceptions, interrupts, floating point, HI/LO, syscalls, linker, or relocations.
- Instructions and data share a sparse map; there is no page protection or separate instruction/data address space.
- Cache access statistics are available as a standalone model but cache latency is not yet coupled to pipeline timing.
- Branches resolve in EX without prediction. There is no superscalar issue, speculation, out-of-order execution, or precise exception machinery.
- The pipeline trace captures at most the configured number of cycles. Summary `cycles` currently reflects retained cycles when the cap is reached; workloads used in the UI stay below that cap.
- JSON serialization is local and schema-specific rather than powered by a general serialization library.
- The visualizer consumes a checked-in trace and does not assemble user input in the browser.
- Browser automation, automated accessibility scanning, screen-reader testing, visual regression, native fuzzing, mutation testing, and formal verification are not included in version 1.0.
- Performance results characterize the simulator on one documented environment and must not be interpreted as processor performance.

## Prioritized roadmap

1. Add a cycle-count field independent of retained trace length and a streaming trace writer.
2. Connect instruction/data cache misses to configurable pipeline wait states.
3. Add a WebAssembly build so local assembly can be simulated without a server.
4. Add browser-level keyboard and accessibility automation while keeping a manual screen-reader checklist.
5. Add a maintained fuzz harness for assembler and decoder inputs.
6. Expand the ISA only alongside encoding vectors, reference semantics, pipeline tests, and documentation.

## Non-goals

- Binary compatibility with every MIPS toolchain or processor.
- Cycle accuracy for a commercial core.
- Executing arbitrary host commands or accepting public uploads.
- Replacing a hardware description language, silicon simulator, debugger, or production emulator.

