# Performance Characterization

## Purpose

This report characterizes simulator work and algorithmic bounds. It does not estimate physical processor speed.

## Deterministic model metrics

| Fixture | Retired instructions | Pipeline cycles | CPI | Load stalls | Flushed slots |
|---|---:|---:|---:|---:|---:|
| `hazard-demo.asm` | 11 | 18 | 1.636 | 1 | 4 |

The result includes initial fill, pipeline drain, a load-use interlock, a jump redirect, and younger work discarded around `halt`.

## Microbenchmark method

The CLI benchmark command runs the already assembled program through a new `PipelineSimulator` 200 times using an optimized build and reports mean wall-clock microseconds. Use it for regression detection on the same hardware and power state:

```bash
cargo run --release --locked -- benchmark examples/fibonacci.asm benchmark.json
```

Control background load, retain the raw JSON, repeat the run, and compare distributions before drawing a conclusion. The command intentionally avoids claiming cross-machine comparability.

## Complexity

- Two-pass assembly visits each source line twice; symbol operations are `O(log s)` with deterministic ordered storage.
- A pipeline cycle performs constant latch and register work plus sparse-memory `O(log m)` access for loads/stores.
- Cache lookup is `O(w)` for associativity `w`; typical fixed associativity makes this constant per access.
- Trace memory is `O(min(c, trace_limit))` and therefore bounded independently of the cycle limit.

## Budget

The static visualizer’s required output is capped at 90,000 bytes before transport compression. The validated build used 27,553 bytes across HTML, JSON, JavaScript, and CSS.

