# Rust runtime notice follow-up: 11 November 2026

Author: Jason Stys. Scope: packaging terms for the actual Rust kernel, without a runtime,
product-version or application evidence-schema change. Product1.1.0 is not yet a published release.

## Actual gap and preservation

The accepted functional source `7e0e1d07d797b1b2c6d9b85348b9704a0a7a2633` built and used the real
Rust kernel, but its portable package omitted Rust standard-library notices. Its earlier successful
Windows assembly/cache/export/import/restart acceptance remains functional evidence. It is
**incomplete distribution-notice evidence**, not a final publishable package. Earlier private
candidates, logs and hashes are preserved; this correction does not overwrite or relabel them.

## Correction

`tools/rust_notices.py` requires the actual active compiler to match the repository's exact1.98.1
pin, then reads that compiler's real sysroot copyright document and complete supplied license
directory. This includes MIT and Apache2.0 terms plus other standard-library third-party notices.
Files remain verbatim. Collection bounds each ordinary file to2MiB, all terms to4MiB and the count
to33. Aliased notice directories/files, nested or unknown members and existing evidence destinations
are refused. The `rust-docs` component is explicit rather than assumed on a minimal CI toolchain.

The separate `RUST_RUNTIME_PROVENANCE.json` records compiler version and relative notice hashes.
It neither changes `RELEASE.json` nor exposes a build-machine path. Actual extracted inventory/hashes
must equal the source-collected manifest before the executable is launched. The ordinary native
consumer independently requires all bundled notice hashes before starting the first owned process.
Missing, altered or additional terms fail; recomputing a changed local manifest cannot replace the
builder's independently retained source manifest. No query exclusion, new test retry, relaxed
coverage/size/deadline gate or release write is introduced.

## Validation checkpoint

Independent actual-file fixtures cover all retained bytes; missing copyright/MIT/Apache terms;
old evidence preservation; wrong actual compiler; changed, missing and unexpected extracted files;
extra directories; a dishonest rewritten digest; closed manifest identity; byte/count/total budgets;
and a real Windows junction (ordinary POSIX symlink in hosted source tests). Native acceptance still
executes the original custom assembly and cache numerical oracles, import-rerun, invalid inputs,
literal history, exact source/engine identity, mobile layout and two normal compiled exits.

| Local source check | Observed result |
| --- | --- |
| Python | 158 parent tests passed, including 21 new notice cases; five existing subtests retained |
| Whole application coverage | 94.55% combined statement/branch coverage; unchanged 90% floor and complete `mips_studio` scope |
| Actual Tcl/Tk notice cases | All 13 mandatory isolated cases passed inside the original source suite |
| Rust | All 28 tests, format and strict Clippy passed |
| TypeScript and browser | All 11 unit tests and four original actual browser journeys passed |
| Production UI | Unchanged seven assets, 65,496 bytes under the 90,000-byte cap |
| Repository policy | Exact index and all five original policy groups passed |

The first restricted-token notice run could not create a Windows junction; its source-identity
fixture also encountered a denied Windows platform query. The ordinary-user run passed the real
fixtures without skips or changed assertions. A sandbox DNS denial during the new rust-docs metadata
check was separately resolved by allowing the official pinned rustup component check. Neither event
is labeled an application failure or an application pass.

The required package job additionally builds a new archive, checks the extracted terms against the
actual source manifest, and runs the original compiled browser and restart consumer. Hosted
cross-platform checks and current-main CodeQL processing must independently pass before
release availability is claimed. No installer transaction, default-browser automation or legal
certification is inferred from this portable launch/unpack test.
