# Security Model

## Assets and trust boundaries

The primary assets are developer workstation availability, repository integrity, and truthful trace output. Assembly source and trace JSON are untrusted inputs. GitHub Actions dependencies and npm packages are supply-chain inputs. The project holds no credentials, customer records, accounts, or personal data.

## Controls

- Reference execution defaults to 100,000 steps; pipeline execution defaults to 100,000 cycles.
- Retained pipeline evidence defaults to 2,000 cycles, independent of execution duration.
- Browser traces are limited to 10,000 cycles, exactly 32 registers, unsigned 32-bit numeric fields, and short labels.
- Loads, stores, and instruction fetches enforce four-byte alignment.
- Unknown opcodes and malformed source fail closed with typed diagnostics.
- Browser values use `textContent`, never `innerHTML`.
- The static UI exposes no command-execution or upload service.
- Rust forbids unsafe code, and Clippy warnings fail CI.
- npm installation uses the lockfile; audits fail on high-severity findings.
- GitHub workflows declare least permissions and pin third-party actions to full commit SHAs.
- The container runtime uses an unprivileged user and contains no build toolchain.
- Repository policy scans for common committed credential formats.

## Abuse cases

| Case | Mitigation | Residual risk |
|---|---|---|
| Infinite jump loop | caller-controlled step/cycle limit | work is consumed up to the limit |
| Many distinct store addresses | run in an OS/container memory limit | sparse memory can grow once per store before execution stops |
| Malformed/unknown word | decoder rejection | raw `.word` may intentionally create a later decode failure |
| Oversized trace file | pre-render count and field limits | JSON parsing itself occurs before validation; host response size should also be limited if remotely served |
| HTML/script in trace labels | text-only DOM assignment | none known within the static UI |
| Mutable CI dependency | immutable full-SHA pins | compromised upstream commit before selection remains a review risk |

## Secrets policy

No secret is required to build, test, or run this repository. Do not add API tokens, private keys, credentials, proprietary programs, or private traces. GitHub-provided ephemeral tokens must retain the workflow’s declared minimum permissions.

## Reporting

Follow the private process in the root [SECURITY.md](../SECURITY.md). Do not publish exploit details before a fix is available.

