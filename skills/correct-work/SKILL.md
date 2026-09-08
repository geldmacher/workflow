---
name: correct-work
description: Fix commissioned review findings within the approved scope.
---

# correct-work

Read the [working agreement](../../references/workflow.md). Read the approved plan, latest relevant review, and human correction instruction. Identify the commissioned findings and their expected fixes and rechecks. Compare them with the current repository; resolve stale or conflicting instructions before dependent changes.

Correct the named defects within the approved scope and preserve unrelated changes. Investigate routine technical details yourself. Do not broaden the goal, modify protected work without permission, weaken tests to hide a defect, or treat an unrelated improvement as part of the assignment.

Recheck affected behavior and proof invalidated by the changes. Reuse other results only after checking their origin, actual output, coverage, and applicability to current source, dependencies, configuration, and relevant environment; explain the basis briefly. Broaden checks when failures, dependencies, or uncertainty require it. A verification-only correction collects the missing proof without an unnecessary code change.

Report which findings were addressed, what changed, actual checks and results, and unresolved limitations on the current working state. Correction does not establish that a subsequent review passed. Explain that the human next commissions a fresh Review to assess the corrections against the plan.
