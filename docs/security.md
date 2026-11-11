# Security Model

## Assets and trust boundaries

The primary assets are developer workstation availability, repository integrity, and truthful trace output. Assembly source and trace JSON are untrusted inputs. GitHub Actions dependencies and npm packages are supply-chain inputs. The project holds no credentials, customer records, accounts, or personal data.

## Controls

- Reference execution defaults to 100,000 steps; pipeline execution defaults to 100,000 cycles.
- Retained pipeline evidence defaults to 2,000 cycles, independent of execution duration.
- Browser imports are size-checked before reading (8 MiB), decoded with strict UTF-8 and validated for 10,000 cycles, exactly 32 registers, unsigned values, short labels and increasing cycle IDs. Unknown schema fields are rejected. Only 100 rows are placed in the DOM.
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
| Oversized trace file | byte cap before reading; encoded byte check before parsing; field/count limits before rendering | a malicious replacement of the shipped asset still requires static-host response limits |
| HTML/script in trace labels | text-only DOM assignment | none known within the static UI |
| Mutable CI dependency | immutable full-SHA pins | compromised upstream commit before selection remains a review risk |

## Secrets policy

No secret is required to build, test, or run this repository. Do not add API tokens, private keys, credentials, proprietary programs, or private traces. GitHub-provided ephemeral tokens must retain the workflow’s declared minimum permissions.

## Reporting

Follow the private process in the root [SECURITY.md](../SECURITY.md). Do not publish exploit details before a fix is available.


## Native application boundary

The native owner verifies its packaged product/version/source, closed UI inventory and real fixed
Rust binary before private workspace mutation. Source assembly is interpreted only by the original
bounded educational engines, never by the OS CPU, a shell, plugin or user-selected executable.
Workspace aliases, installed roots and linked/nonregular fixed marker/lock/SQLite recovery members
are refused before writes. Opened member type/link count/identity is checked. These are practical
owner-local admission controls, not a race-proof filesystem namespace against a concurrent trusted
OS writer. The same OS user/admin can read plaintext profiles and inspect processes.

A prebound port 0 loopback listener, unpredictable per-instance capability, exact authority and mutation
Origin prevent unrelated browser origins from using the private API. The browser clears the fragment
and retains its capability only in tab session storage. No cookies, CORS, external assets, remote
imports, telemetry or account data exist. CSP/no-referrer/no-store/nosniff apply to fixed assets and
errors. Connection/experiment concurrency, request/engine deadlines, source/cycle/cache and retained
history budgets are enforced. The native owner retains the listener/profile until actual handlers and
children finish; repeated Quit cannot become timer-based success.

[GitHub's supported-language documentation](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning)
includes Rust, Python, JavaScript/TypeScript and Actions. Separate processed `security-and-quality`
lanes preserve the original quality suite; there are no source/query exclusions or suppression
comments. A green job alone is not a zero-findings or production-security claim. Public source and
unsigned portable launch do not provide code-signing certification or a clean-machine guarantee.
