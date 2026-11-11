# Native application guide

Created by Jason Stys. This application connects the original Rust assembler, independent sequential
and pipeline engines, LRU cache and TypeScript trace explorer to real editable inputs and durable
evidence. It is an offline educational architecture model, not a commercial processor, host-code
executor, network service for other people or hardware controller.

## Use the complete application

1. Extract a matching accepted portable archive into a fresh software folder. Start
   `MipsPipelineWorkbench.exe` on Windows, or `MipsPipelineWorkbench` on a verified POSIX package.
   Native release/platform acceptance must precede any availability claim; see the dated report.
2. Choose an empty external workspace or this app's saved workspace. Unknown nonempty directories,
   symlink/junction ancestors, hardlinked fixed files and program-tree workspaces are refused before
   mutation. **Open application** starts its own ephemeral loopback listener and browser tab.
3. Give an experiment a title. Edit or import supported UTF-8 assembly, choose independent total-cycle
   and retained-cycle budgets, then **Run assembly**. Inspect the exact physical source listing,
   reference state, pipeline memory, final registers, hazards and timing in the existing explorer.
4. Run a separate LRU experiment with explicit decimal/hexadecimal byte addresses and set/way/line
   dimensions. Empty input means zero observed accesses. These are neither pipeline-derived addresses
   nor real CPU performance measurements.
5. Search history by literal title and kind; select a result to restore its inputs and evidence.
   Export the selected record. Importing an exported record reruns its input with the current engine,
   including when its supplied report has been forged. Invalid inputs retain prior accepted evidence.
6. Explicitly confirm deletion of a selected record when no longer needed. History retains at most
   1000 records without silent eviction. **Quit owned application** or the owner's **Exit** waits for
   active work and releases its workspace lock only after real completion.

The shipped six-instruction load-use example produces registers `$t0..$t3 = [64,5,5,10]`, word 64=5,
architectural Halt PC 24, six retired instructions and 11 modeled cycles with one interlock. The two
younger modeled slots flushed at Halt contribute two flushes. The seven-address sequence
`0,4,8,0,16,8,0` in a two-set/two-way/four-byte-line LRU cache has one hit and six misses.

## Missingness and discrepancy handling

Zero retained cycles keeps final state/total timing without inventing cycle-level evidence.
Self-modifying code can expose independent-model disagreement; its result is labeled **MODEL MISMATCH**
and retained for investigation. A zero child exit code alone never becomes verified evidence.
Assembler/reference faults report their physical source line when known. Other failures explicitly
leave the line unknown. No reported file/line is inferred from an unrelated generated file.

Imported standalone traces are shape-validated, not certified executions. Native exported evidence
contains its exact input hash, compiled engine hash, product/version and full source commit. A local
dirty package is explicitly marked `sourceDirty:true`; CI forbids such candidates. JSON schema 1 is
independent of product 1.1.0. The original CLI and container retain their distinct entrypoints.

## Private workspace and lifetime

Default data belongs under the OS user's application-data directory, outside extracted program
files. The trusted local OS owner can choose another admitted path. SQLite records are plaintext;
there are no accounts, cloud services, telemetry, ads, uploaded host programs or hidden network AI.
The source/configuration sent by the browser goes only to the owned loopback app. The native owner
passes a random capability in a fragment, immediately removed from the address bar and retained in
this origin's tab storage. It is invalid after the server stops and is not an account credential.

Every API read requires that capability and exact authority. Mutations additionally require the exact
Origin. The app uses no cookies, CORS, external assets or remote URL imports. Static responses apply
CSP, `nosniff`, same-origin resource policy and no-referrer/no-store headers. Eight connection threads,
four concurrent experiment slots, five-second body deadlines,256KiB JSON bodies and 15-second Rust
execution deadlines bound the local workflow. No arbitrary executable, source plugin or shell is
accepted. These controls do not provide secrecy against the same OS user/admin or a race-proof
namespace against a concurrent trusted OS writer.

Back up the stopped external workspace, not the software directory. Reopen the matching app to view
history. Preserve old versions and separate profile backups; never silently roll a newer database
back to an older unsupported schema. A close failure remains visible and does not report success.

## Build and validate from source

Use final patched Python 3.14.10+, the repository's pinned Rust 1.98.1 and Node 24. The installed native
application itself needs no Python, Rust, IDE or Docker setup. Development-only and packaging tools
have separate exact hash locks; the application Python code uses the standard library.

The pinned toolchain includes `rust-docs` because the native kernel statically includes Rust's
standard library. The builder reads the actual active1.98.1 sysroot's `COPYRIGHT-library.html` and
every file supplied in its `licenses` directory, preserving MIT, Apache and third-party terms
verbatim under `_internal/licenses/rust`. `RUST_RUNTIME_PROVENANCE.json` records only the compiler
version and relative notice SHA256 inventory; it contains no local toolchain paths and does not
modify the application `RELEASE.json` schema. Before running the extracted binary, packaging compares
that inventory to the source-collected manifest. The standalone native consumer also requires the
complete manifest and hashes. Missing terms are a packaging failure, not an optional warning.

This retains vendor notices; it is not a legal-compliance certification. The Rust compiler itself
is not redistributed. This project's Cargo lock has no external application crates. Tcl/Tk, Python,
PyInstaller and authored MIT notices retain their separate existing collection and validation.

```bash
python -m venv .venv
python -m pip install --require-hashes -r requirements-dev.lock -r requirements-package.lock
cargo build --locked
npm --prefix web ci --ignore-scripts
npm --prefix web test
npm --prefix web run smoke
python -m pytest --cov --cov-report=term-missing
python -m tools.package_app --output-root .runtime/native-new
```

Activate the chosen isolated environment first. Linux GUI tests/builds run under `xvfb-run -a`.
Install the exact locked Chromium beforehand with
`npm --prefix web exec -- playwright install chromium`; Linux also needs its documented browser
system dependencies. Use a new output directory. Clean Git source is mandatory; `--allow-dirty`
exists only for explicitly labeled local candidate development and is forbidden in CI. Archive
creation, bounded inspection, fresh extraction, actual compiled-executable browser editing/import/
export and a second native launch are mandatory before the checksum is emitted. Windows uses ZIP;
POSIX uses tar.gz to preserve internal PyInstaller links and executable modes.

## New and changed file responsibilities

| File | Purpose |
| --- | --- |
| `src/studio.rs` | Actual bounded assembly/reference/pipeline comparison, listing, diagnostics and LRU results |
| `src/studio_cli.rs` | Closed machine-readable command protocol, bounded UTF-8 inputs and compiled identity |
| `src/pipeline.rs` | Original model with corrected architectural Halt PC rather than speculative fetch cursor |
| `mips_studio/__init__.py` | Native product version |
| `mips_studio/engine.py` | Fixed hash/source-bound Rust executable, strict input schemas and finite actual process work |
| `mips_studio/profile_paths.py` | Pre-mutation alias/program-root/fixed-member admission and opened-descriptor identity |
| `mips_studio/store.py` | Exclusive workspace ownership, exact marker/schema and transactional searchable history |
| `mips_studio/resources.py` | Closed static inventory, byte/digest checks and frozen source/version/runtime boundary |
| `mips_studio/server.py` | Prebound bounded loopback service, authority/capability/Origin/JSON and completion-based drain |
| `mips_studio/desktop.py`, `launcher.py` | Genuine Tk owner, workspace/Open/Help/Exit and explicit isolated acceptance mode |
| `web/src/studio.ts` | Native editor/cache/history/results/export/import UI with stale-response and busy guards |
| `web/src/app.ts` | Original trace explorer connected to accepted native traces; standalone mode retained |
| `web/public/index.html`, `web/src/styles.css` | Accessible labeled controls, limits/help and responsive layout |
| `web/scripts/build.mjs`, `smoke.mjs` | Compile all seven required assets and retain the original 90KB total budget |
| `tools/package_app.py` | Coherent clean-source build, actual Rust provenance, PyInstaller and extracted acceptance |
| `tools/portable_archive.py` | Bounded ZIP/tar member/link validation, fresh extraction and source manifest checks |
| `tools/runtime_notices.py` | Actual loaded Tcl/Tk notices, exact reviewed Mac source terms and Python/build notices |
| `tools/rust_notices.py` | Pinned actual Rust sysroot copyright/license collection, bounded reads and extracted inventory/hash validation |
| `tools/smoke_app.py`, `native_feature_smoke.mjs` | Actual compiled browser journey, exports/refusals and second-launch persistence |
| `tools/python_index.py` | Parse exact Python declaration/parameter/variable locations without executing source |
| `tests/studio_tests.rs`, `pipeline_tests.rs` | Independent numerical/model-mismatch/physical-line/Halt-PC regression oracles |
| `tests/test_native_cli.py` | Actual Rust-process JSON, exact state, diagnostics, bounds and cache contracts |
| `tests/conftest.py`, `test_studio_service.py` | Actual engine, SQLite and HTTP positive/negative/lifetime fixtures and journeys |
| `tests/test_studio_boundaries.py` | Output/source/manifest/status/malformed-body/no-success-on-failure regressions |
| `tests/test_profile_paths.py` | Actual junction/symlink/hardlink/program-tree/opened-identity refusal before mutation |
| `tests/test_owner_window.py` | Real Tk controls, retryable setup, owned close, visible failure and no-default-profile checks |
| `tests/test_native_packaging.py`, `test_portable_archive.py` | Source/version/security-floor/dirty-CI and real archive safety controls |
| `tests/test_runtime_notices.py`, `runtime_notice_cases.py` | Mandatory 13 real Tcl notice cases in one fresh bounded interpreter |
| `tests/test_rust_notices.py` | Independent real notice-file, compiler-identity, alias, missing/tampered/inventory and byte/member-bound negatives |
| `requirements.lock` | Explicit empty third-party application runtime graph |
| `requirements-dev.in`, `.lock` | Exact hash-locked source/test/audit tools, including safe private JUnit parsing |
| `requirements-package.in`, `.lock` | Exact hash-locked PyInstaller build tools, separate from app runtime |
| `pyproject.toml` | Product metadata, strict lint and whole-package 90% branch-aware coverage gate |
| `licenses/PYTHON.txt`, `TCL-9.0.4.txt`, `TK-9.0.4.txt`, `TK-9.0.5-pre-33904f039f48ed64.txt` | Verbatim upstream terms tied to actual supported runtime notice provenance |
| `.github/workflows/desktop.yml` | Three-OS extracted full application validation without release writes/binary uploads |

Exact declarations and important state locations appear in [code-index.md](code-index.md). The
source-index extension uses Python's AST rather than importing/executing an indexed file. The native
architecture choice and alternatives are recorded in [the ADR](adr-native-studio.md).
