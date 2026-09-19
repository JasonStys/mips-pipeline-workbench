# Security Policy

## Supported version

Security fixes are applied to the latest release on `main`. This educational project does not claim suitability for processing hostile inputs without additional operating-system resource controls.

## Reporting a vulnerability

Use GitHub’s private vulnerability-reporting feature for this repository. Include the affected commit, reproduction input, impact, and a suggested mitigation if known. Do not include real credentials or private data.

Please allow reasonable time for acknowledgement, reproduction, remediation, and coordinated disclosure. Public issues are appropriate for ordinary correctness defects that do not expose a security weakness.

## Scope reminders

The static visualizer executes no uploaded assembly and holds no accounts. The CLI bounds steps/cycles but sparse memory may still grow within that bound. Review [docs/security.md](docs/security.md) before embedding the library in a service.

