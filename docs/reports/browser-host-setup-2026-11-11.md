# Real browser host setup correction

By Jason Stys. Guide-PR job 130615791890 failed during redundant Chromium OS/font package installation, before the visualizer assertions. The actual installed runtime libraries were already present, but Ubuntu package DNS failed. No trace-engine or native application result is inferred from that setup failure.

The Ubuntu 24.04 visualizer job now downloads the exact browser from its existing locked web graph to a checkout-owned cache, with the normal Playwright host validator active. A mandatory actual launch proves the locked version, its own browser PID/executable, real ELF library closure, a real installed font, actual text widths/focus and 390/1400 responsive bounds. It does not claim extra multilingual font coverage, alter browser launch defaults or bypass a missing dependency.

A small genuinely compiled ELF fixture independently requires a local shared library: removing that owned library must fail linkage inspection; restoring it must pass. Another child imports the real copied helper in a directory without installed dependencies, preserving the existing dependency-free repository job. Actual-workflow mutation fixtures reject missing/ignored host proof or removed original tests. The original web compilation, trace import/playback browser tests, distribution smoke, audit and ten-minute job bound remain unchanged. Native owner/engine/SQLite and original Rust gates remain separate and mandatory.

Local Windows checks do not execute the Linux fault control; fresh actual hosted proof remains required. No installed app, user profile, published package, local Docker or global OS package was changed. The guide's reviewed bytes and historical source identities remain unchanged. See [Playwright browser setup](https://playwright.dev/docs/browsers) and [CI requirements](https://playwright.dev/docs/ci).

## Separate native Linux setup

At source `fa30c3b6f72fd6c0394bcf64bce25c69867c2fa2`, the original CI web/trace/browser jobs and Windows/macOS full native packages passed. The separate native Linux job 130636892329 failed before its archive journey while its own remaining APT step attempted the same extra font downloads. That setup is corrected separately: exact locked browser download and actual Linux host proof now precede the unchanged Xvfb/full extracted native application consumer. No native assertion, three-platform matrix or 25-minute job bound is removed; Linux native completion remains a fresh hosted requirement.
