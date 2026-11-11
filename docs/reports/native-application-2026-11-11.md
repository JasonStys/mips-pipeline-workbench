# Native application validation 11 November 2026

Author: Jason Stys. This edition adds a complete editable local application around the original
Rust engines and TypeScript trace explorer. Local Windows candidate acceptance has been observed;
new public native downloads, three-OS hosted native acceptance and current processed CodeQL results
are pending. This report does not claim a release/install transaction from a source test or a dirty
candidate launch.

## Actual engine improvement

The original pipeline reported its speculative fetch cursor as final PC after Halt. A new independent
oracle failed against that implementation: a one-word Halt ended at PC8 instead of architectural PC4.
The correction retains Halt's own next architectural PC. Three programs and retained-trace budgets
0,1,128 verify PC4/8/12 independently. Existing timing/register/memory behavior is preserved. The
checked-in hazard demo changes only `summary.finalPc`52 to48; all other parsed fields, including
18 cycles,11 retired instructions and one stall, remain identical.

The native execution protocol uses the actual original assembler, reference interpreter, pipeline
and LRU cache. It compares all32 registers, sparse memory, final PC and retirement count. A real
self-modifying example produces a reference/pipeline discrepancy and is retained as mismatch
evidence; process exit0 cannot bless it as verified. Source faults preserve physical lines when
known rather than borrowing a generated file's coordinates.

## Local evidence

| Area | Recorded result | Scope |
| --- | --- | --- |
| Rust | 28 tests passed; format and strict Clippy passed | Original suites plus actual studio and Halt-PC regressions |
| Python source | 134 parent tests and5 subtests passed;94.31% whole-package combined statement/branch coverage | Entire `mips_studio` package, statement/branch-aware90% floor; no GUI exclusions |
| Tcl/Tk notices | Mandatory13 actual isolated cases passed | Fresh bounded interpreter, stable descriptors, exact case identities and no retry/skip |
| TypeScript | Original11 tests passed | Actual trace/file/navigation model contracts retained |
| Production UI | Seven actual assets under unchanged90,000-byte cap | New native module is included in the measured required set |
| Windows local candidate | Real freeze, safe archive extraction and actual compiled Chromium journey passed | Explicit `sourceDirty:true` candidate, patched Python3.14.10; no source-server fallback |
| Native persistence | Two actual compiled launches exited0/0 and retained exactly three completed records | Fresh synthetic external workspace; old capability rejected after restart |

The first candidate archive SHA256 was
`fd99bf3359b555996b212af44c6b6b55786d0d1829cfb47c700d8de52e29b004`.
It is a private development candidate, not a public asset or clean-source release identity. Later
changes add an explicit100MiB history byte bound and policy headers for unsupported HTTP methods;
the final clean-source acceptance must include those changes before delivery. Private evidence/logs
remain outside Git; source tests and acceptance tools are reproducible in the repository.

## Real compiled user journey

1. Start the extracted executable from a temporary directory with an explicit synthetic workspace,
   its own port0 listener and no default browser launch. Verify actual source/version/nonce.
2. Edit a custom commented six-instruction program in the compiled browser UI. Independently require
   registers[64,5,5,10], memory64=5, architectural Halt PC24, six retired instructions,11 cycles and
   one load-use stall. Export the selected result and match physical listing line2/word`0x24080040`.
3. Submit an unsupported instruction at physical line3. Require the precise diagnostic and byte-for-
   byte identical prior selected export. No success history entry is created.
4. Enter the explicit cache address sequence0,4,8,0,16,8,0 with2 sets/2 ways/4-byte lines. Require
   one hit, six misses and exact per-access hit flags. Invalid line size3 preserves the accepted
   export. The UI explicitly separates this from hardware or pipeline-derived measurements.
5. Search/select history and export the exact selected earlier record. Import a record with a
   deliberately forged report; require a new run ID and actual engine output equal to the original
   independently checked report. Imported claims never become fresh evidence.
6. Check mobile overflow, normal owned Quit, reopen the same actual executable/workspace and require
   exactly three retained records plus a new instance nonce. Reject the old capability and Quit
   normally again. Actual UI screenshots are captured from this same compiled journey.

## Negative controls and original gates

The source suite uses actual Rust processes, real SQLite/HTTP and real Windows junctions/hardlinks;
POSIX uses real symlinks. It verifies fixed files/ancestors/frozen roots are refused before mutation,
opened-file replacement closes its descriptor, unknown folders remain unchanged, future schema is
not migrated, transaction failures do not prune evidence, and repeated close retains ownership
until an actual held operation completes. Exact authority/capability/Origin, duplicate/nonfinite JSON,
oversized/encoded framing, unsupported methods and malformed source/output/schema/status are tested.

The original cross-platform Rust, TypeScript/browser, dependency, non-root container and repository
gates remain. New source/native jobs add three-OS coverage and extracted application acceptance.
Separate CodeQL Rust/Python/JavaScript-TypeScript/Actions lanes preserve `security-and-quality`, wait
for actual processing, use immutable action pins and add no exclusions or suppressions. No workflow
uploads full native binaries or mutates releases; publication is a separate reviewed operation.

## Failures retained and corrected

- The first hand-entered UI example used unsupported `add`; actual engine testing rejected it at
  line5. The app and independent example fixture now use the documented `addu` instruction.
- A test initially expected CPI's unrounded fraction and no Halt flushes. The original public trace
  contract renders four decimals, and Halt flushes two younger modeled slots. Tests now assert the
  explicit1.8333/two-flush contract without changing the engine's timing behavior.
- Windows can reset a connection when a rejected request still sends an unread body. Denied Origin/
  capability/framing tests now send real headers only and require the actual403/400 response before
  transmitting a body; no accepted status or timeout is relaxed.
- One oversized-child-output parameter initially generated an enormous pytest display ID. Explicit
  bounded case IDs fix the harness; its >8MiB refusal oracle remains intact.
- The first original-browser run could not load the new module because its closed test-server route
  map still listed only the original three scripts. The fixed explicit `studio.js` route restores all
  four original journeys unchanged; no arbitrary filesystem serving or wait changes were added.
- Authenticated busy responses initially closed with an unread body on Windows. The API now consumes
  only the already-authorized bounded JSON body before HTTP429; wrong capability/Origin still refuses
  before body reads. The actual full-body capacity regression now passes without retry.
- Source metadata initially relied on Windows' CP1252 default when reading UTF-8 HTML. Metadata and
  source reads are now explicitly strict UTF-8. The failed build log is retained privately.
- The minimum-window test initially asserted mapping before processing real window events. It now
  processes normal Tk mapping and verifies Open/Exit remain visible at560×350; no runtime clipping
  fix or smaller-window success is invented.

## Limits

This remains an educational subset, not commercial CPU timing, arbitrary-language compilation,
hardware control or a formal proof. Self-modifying discrepancies remain visible. Local profiles are
plaintext for the trusted OS owner; there is no multiuser account claim. Admission checks do not
secure the filesystem against concurrent same-owner namespace attacks. Portable unpack/launch proof
is not an installer transaction, clean-machine test or manual default-browser-opener certification.
No current platform/release is declared green before its actual checks and findings are reviewed.

## Current local acceptance status

The final local source round passed134 parent Python tests plus5 subtests at94.31% whole-package
combined statement/branch coverage (90% minimum), and its mandatory13 isolated notice cases passed.
The original four browser journeys passed unchanged after the fixed route integration, all11 TS
model tests passed,28 Rust tests and strict fmt/Clippy passed, and both exact-lock dependency audits
reported zero known findings. The rebuilt production UI measures65,496 bytes under the original
90,000-byte cap. These observations remain local; exact clean native/source and hosted scan/release
acceptance are recorded separately when actually completed.

## Clean Windows packaged checkpoint

A fresh clean-source build at `8fd247f19b4e696c25543a1fd63ba344105b3a4a` passed the complete extracted
native Chromium/input/export/import/history/second-launch journey described above. Metadata explicitly
records `sourceDirty:false`, final Python3.14.10 and the matching source-bound Rust kernel. The actual
collected Python DLL matched the patched SDK digest before archiving. Both native launches exited0/0
and the second retained exactly three completed experiments with a fresh nonce/invalid old capability.
The portable ZIP SHA256 is `792713d3c0d42b308214ae1f690a8860707c2d439eef6c0b967260eff68a2b74`.
This remains a local candidate checkpoint; its source and bytes are not a published download, a
clean-machine test or an OS installer transaction. The following documentation-only update records
that observation, and hosted exact-current-source builds still run independently.

## Processed quality findings follow-up

The first actual PR scan reported two `py/empty-except` maintainability findings even though all16
workflow checks were green. Normal Ctrl+C already entered final cleanup, but its intent was implicit;
the native entrypoint now sets its actual stop-request event before normal drain. The real entrypoint
regression verifies that event and actual listener/profile release. Tk fixture cleanup now verifies
only the expected already-destroyed-application error rather than discarding any Tcl error. No query,
exclusion or suppression was added. The follow-up local round passed135 parent tests and5 subtests at
94.55% whole-package combined statement/branch coverage plus the mandatory13 isolated notice cases.
A fresh processed scan/native build must confirm this exact follow-up source before acceptance.

## Quit acknowledgment ordering correction

The next exact-source macOS run exposed an acknowledgment race: HTTP200 could be observed before
`stop_requested` was set because the handler wrote its response first. The operation now records
its accepted stop request before emitting any acknowledgment bytes; normal server close still joins
that actual handler before releasing the workspace. A deterministic actual-response-writer oracle
requires the event already set at acknowledgment and keeps the original immediate client assertion.
The full local round passed136 parent tests and5 subtests at94.55%, plus13 mandatory isolated notice
cases. The failed hosted log is retained; no wait, retry, deadline or accepted status was relaxed.

## Independent editorial and malformed-header review

An independent source review found double-decoded punctuation in several Python owner/title/error
literals. They are now plain ASCII, and the actual Tk owner title is asserted. The same review found
that compare_digest rejects non-ASCII strings by raising TypeError; the API now refuses that malformed
capability explicitly before comparison. A real Latin1 wire-header regression requires HTTP403 JSON.
The full local round passed137 parent tests and5 subtests at94.55%, plus13 isolated notice cases.
Existing ownership, alias admission, fixed engine invocation and no-false-success history boundaries
were independently reviewed without another material blocker; current hosted checks remain mandatory.
