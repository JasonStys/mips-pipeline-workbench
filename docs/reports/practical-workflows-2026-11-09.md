# Local trace exploration verification — 2026-11-09

The visualizer now accepts local version-one JSON traces without uploading or executing them. Imports check advertised/actual byte lengths, strict UTF-8, supported fields, ordered unique cycle IDs, register invariants and bounded labels before replacing the current workspace. A malformed file leaves the previously selected trace and cycle intact. A generation guard prevents a slow demo request overwriting a later local choice.

Students can play/pause, step, jump to a retained cycle, inspect the next hazard/event and select table rows. Editable controls retain their normal arrow-key behavior. Playback stops at completion, manual navigation, import and hidden-page transitions. Empty traces show final evidence with navigation disabled. The table renders only 100 rows even for 10,000-cycle imports.

## Correctness fix

An existing Rust bug counted retained trace rows as total cycles and CPI. The simulator now records total executed cycles independently of retained evidence, so metrics remain correct when the trace cap is 0, 1 or 3. A regression checks the known 18-cycle / 11-retired hazard fixture and unchanged final registers/memory against uncapped execution. The shipped full trace remains byte-for-byte unchanged.

## Observed local validation

On Windows with Rust 1.98 and Node 24: 23 Rust tests, 11 TypeScript tests and four real Microsoft Edge/Playwright browser journeys passed. Rust formatting, warning-free source Clippy, locked Release build, strict TypeScript compilation, distribution size smoke, code-index and repository policy passed. The pinned dependency install reported zero vulnerabilities. The initial sandboxed browser process was stopped through its owned session and rerun successfully with scoped process permissions; no unrelated service or browser was terminated.

Browser journeys cover local import, instruction/event inspection, jump/slider keyboard focus, invalid-jump recovery, finite playback/pause, asynchronous load races, malformed-file preservation/recovery, text-only malicious labels, absence of upload requests, mobile width, 10,000-cycle bounded rendering, empty evidence and demo reload. Tested viewports were 1280×900 and 390×844. These are real DOM/browser interactions; they do not certify screen-reader behavior.

CI now installs Chromium and runs the same journey suite after the existing locked compile/unit/smoke gates. No GitHub Actions were triggered by this subtask, and the local Docker installation was left unchanged. Imported evidence remains producer-supplied: schema validity does not establish execution correctness, and final registers are not per-cycle snapshots.

Machine-readable evidence: [practical-workflows-2026-11-09.json](practical-workflows-2026-11-09.json).
