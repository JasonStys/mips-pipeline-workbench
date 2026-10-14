# Portfolio synchronization — 2026-10-14

Created by Jason Stys.

This candidate combines the reviewed proposals below while preserving their
commit ancestry and the existing main-branch security fixes. Conflicting
version declarations are combined explicitly; affected locks are regenerated
from the reviewed manifests. No audit or coverage budget is lowered.

- [Original proposal #1](https://github.com/JasonStys/mips-pipeline-workbench/pull/1).
- [Original proposal #3](https://github.com/JasonStys/mips-pipeline-workbench/pull/3).
- [Original proposal #4](https://github.com/JasonStys/mips-pipeline-workbench/pull/4).

Coordinated CodeQL steps use the same reviewed immutable release where present.
Source and generated-symbol contracts remain enforced by the existing workflows.
The initial policy check detected a stale generated scan count after this report
was added (57 versus 58 text files). The policy evidence was regenerated; the
credential scan and exact generated-evidence drift gate remain enabled.
The complete candidate must pass its applicable native CI before promotion.
[Inspect candidate checks](https://github.com/JasonStys/mips-pipeline-workbench/actions?query=branch%3Amaintenance%2Fportfolio-sync-20261014).

This maintenance does not add production deployments, user-data access, automatic
source promotion or new guarantees of security. Existing release tags and assets
are retained. Platform and model-quality limitations remain in the project README.
