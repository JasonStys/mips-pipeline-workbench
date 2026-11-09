# Explore a local pipeline trace

Generate evidence with `cargo run --locked -- pipeline examples/hazard-demo.asm trace.json`, build
the visualizer with `npm --prefix web test`, and serve `web/dist` through a local static server.
Select **Local trace JSON**. The chosen file stays in browser memory and is neither uploaded nor
executed. The file input is cleared after each attempt so a corrected file can be selected again.

The import boundary accepts nonempty UTF-8 JSON up to 8 MiB, schema version 1, at most 10,000
retained cycles, exactly 32 unsigned registers with `$zero = 0`, and labels up to 240 characters.
Unknown fields, malformed types, duplicated/reversed/out-of-summary cycle IDs and invalid UTF-8
are rejected with a useful error. An invalid import preserves the previous trace and selected cycle.
Cycle IDs may have gaps; **Go to cycle** accepts only a cycle actually retained in the file.

**Previous/Next**, the slider and cycle-row buttons inspect the same selected evidence. Arrow keys
and Home/End work outside form controls; input, select and button keyboard behavior remains native.
**Next hazard / event** finds the next retained event without inventing events in missing evidence.
**Play** advances at the selected 0.25/0.5/1-second interval and stops at completion; playing again
restarts at the first retained cycle. Pause, manual navigation, import, hidden-page and page-exit
transitions stop the owned timer. Playback is always initiated by the user.

Only 100 table rows are rendered at once. A cycle jump changes the table page, and its status
explains which retained rows are visible. An empty trace disables navigation while retaining final
summary/register evidence. Register values are **after completion**, not values at the selected
cycle. The total-cycle/CPI counters in newly generated traces include unretained execution.

The browser validates structure and resource bounds. It cannot prove that an imported file is true
or that a producer ran the independent interpreter. Keep the Rust differential tests with generated
evidence. The application does not assemble code in the browser, inspect physical hardware or
execute uploaded files.

## Changed files

| File | Responsibility |
| --- | --- |
| `web/src/import.ts` | Pre-read byte limits, exact UTF-8 and strict JSON import |
| `web/src/model.ts` | Contract, cycle ordering, register and label validation |
| `web/src/app.ts` | Import commit/race control, playback, navigation and bounded table |
| `web/public/index.html` / `web/src/styles.css` | Labeled responsive controls and model boundaries |
| `web/tests/import.test.ts` | Independent file-boundary regressions |
| `web/tests/browser/workflows.spec.ts` | Real user import/playback/recovery/mobile journeys |
| `web/playwright.config.mjs` / `web/scripts/serve.mjs` | Owned loopback test server and browser configuration |
| `src/pipeline.rs` / `src/main.rs` | Independent total-cycle/CPI accounting and CLI output |
| `tests/pipeline_tests.rs` | Known-count regression across trace retention limits |

Exact source declarations are indexed in [code-index.md](code-index.md). Observed local results
and outstanding verification boundaries are in [the workflow report](reports/practical-workflows-2026-11-09.md).
