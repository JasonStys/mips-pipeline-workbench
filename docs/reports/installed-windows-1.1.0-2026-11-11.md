# Installed Windows 1.1.0 validation - 11 November 2026

By Jason Stys. Observations below refer to the independently downloaded, published **1.1.0** application built from `22e30eb044dd2654242cd7ce3965dd783452078d`. Historical Office editions and published assets remain unchanged.

## Observed validation

**Actual installed workflows: Passed.** Two actual installed launches passed custom assembly, cache/import/export/refusal/mobile workflows and reopened three retained records. An invalid instruction was reported on physical line 3; both processes exited normally.

**Original core and source gates: Passed.** 158 Python tests plus five subtests, 13 isolated GUI-notice cases, 28 Rust tests, 11 TypeScript tests and four original browsers passed; source coverage 94.55% at unchanged 90% floor. All 13 actual Rust runtime notice files were verified.

**Assets and current security: Passed.** Provider/download hashes, complete installed-byte identity, current exact-main workflows and processed raw CodeQL results passed with zero open main alerts.

**Launch and data boundary: Passed.** Individual Desktop and Start-menu targets verified. Only synthetic profiles were exercised; installed EXE tests are distinct from ordinary default-profile shortcut activation.

## Illustrated workflow and implementation

The [four-page application guide](windows-application-guide-1.1.0.docx) contains two actual installed-app screenshots, a worked user journey, an immutable-source excerpt and observed results/limits. Every final page was peer-reviewed and OOXML schema validation passed. The [manifest](windows-application-guide-1.1.0.json) binds the document, figures, source and reviewed pages. Prepared examples are inputs inside the actual application.

## Installation, data and limits

Download the Windows ZIP and checksum, verify SHA-256 and extract the complete bundle. Open MipsPipelineWorkbench.exe inside its named folder; keep the _internal directory and notices. Retain old versions and stopped-profile backups.

Use the individual Desktop icon and the app's Help. Quit through its owner controls. No Python setup or Docker change is required; examples are input data inside the full application.

Educational instruction/cache subset only. User assembly is interpreted by the bounded simulator, never compiled into host code. Cycle counts are model observations, not measured processor timing or hardware validation.

Unsigned Windows portable bundle with Python 3.14.10 and Tcl/Tk 9.0.4 and original Rust terms. History is owner-local plaintext; default-browser opening and ordinary default-profile shortcut activation remain separate from automated installed-executable tests.

Individual Desktop and Start-menu targets were read-back verified. Actual installed-executable testing is distinct from ordinary default-profile shortcut activation, which was not independently exercised. Normal profiles and Docker were unchanged. This documentation revision requires its own fresh hosted workflows and processed security analysis; earlier runtime observations do not certify future source.
