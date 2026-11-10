# MIPS Pipeline Workbench handbook

By Jason Stys.

Import bounded traces, preserve valid state on failed import and navigate cycles/hazards with a bounded visible window. Fixed cycle/CPI counts when trace capture is capped.

Improves processor-debugging usability and keeps performance measurements independent of display limits.

## Read the documentation

| Edition | Audience and contents |
| --- | --- |
| [project-guide.docx](reports/project-guide.docx) | User and developer guide: purpose, current usage, design, boundaries and source references. |

The editable Markdown remains the maintenance source. The Word files are readable editions, and the workbook is an evidence index rather than a test runner. See [publication identities and review](reports/publications.json) and the [documentation refresh record](reports/documentation-refresh-2026-11-09.md).

## Current usage and help

[README quick start](../README.md) is the entry point. Use the project-specific guides below before changing inputs, operating modes or deployment assumptions.

### Usage and operations

- [operations](operations.md)

### Design and contracts

- [adr/0001 independent pipeline and reference core](adr/0001-independent-pipeline-and-reference-core.md)
- [architecture](architecture.md)
- [research](research.md)

### Security and validation

- [security](security.md)
- [testing](testing.md)

## Historical results and reproduction

The reviewed source is [`39e2997102cf0d40068c3d88b58178966fb52c1c`](https://github.com/JasonStys/mips-pipeline-workbench/tree/39e2997102cf0d40068c3d88b58178966fb52c1c). The observed functional workflow baseline is `39e2997102cf0d40068c3d88b58178966fb52c1c`; those observations are recorded at `2026-11-10T05:25:40.628667+00:00`. They do not certify an unrun later revision.

- [Detailed recorded validation](reports/practical-workflows-2026-11-09.md)
- [Current Actions](https://github.com/JasonStys/mips-pipeline-workbench/actions) records later integration checks separately.
- Preserve dated measurements and follow the existing testing guide to reproduce them; a test-source inventory alone does not establish execution.

## Practical boundaries

- Imported trace schema validity is not execution proof; the viewer does not rerun imported programs.
- Displayed final registers are end-state values, not selected-cycle register snapshots.
- Full-run cycle/CPI metrics do not imply every cycle was retained in a capped trace.
- Source-first project with current package/service validation; no public native desktop application release is supplied.

## Maintaining these editions

Update the editable usage/design/test documents first. Rebuild and visually review every Word page and workbook tab before replacing an edition; verify the exact binary digests and evidence source in publications.json. Keep account data, logs with secrets, installed-app state and private test stores out of documentation. Source and release assets retain their existing security and licensing boundaries.
