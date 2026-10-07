---
name: correct-work
description: "Fix requested review findings within the approved plan."
---

# correct-work

Apply the [working agreement](../../references/workflow.md); read it if missing or uncertain. A natural-language request to fix review findings suffices; an unrelated bug report does not select this review-correction phase. Read the applicable plan, latest relevant review, and human correction instruction or expressly commissioned Auto-Work assignment with remaining correction budget. Identify the commissioned findings and their expected fixes and rechecks. Compare them with the current repository; resolve stale or conflicting instructions before dependent changes. When that plan records another branch or worktree, read [concurrent work](../../references/concurrent-work.md) and correct there.

Correct named defects and pending north-star updates from explicit user decisions within the assignment. Preserve unrelated changes and resolve routine details yourself. Do not broaden the goal, modify protected work without permission, weaken tests to hide a defect, or include unrelated improvements.

Recheck affected behavior and proof invalidated by the changes. Reuse other results only after checking their origin, actual output, coverage, and applicability to current source, dependencies, configuration, and relevant environment; explain the basis briefly. Broaden checks when failures, dependencies, or uncertainty require it. A verification-only correction collects missing proof without unnecessary code changes. For setup or prerequisite gaps, follow [project readiness](../../references/project-readiness.md) within the correction scope.

Capture reusable learning candidates from correction and diagnosis; reconcile lessons affected by changes and carry the open collection forward under the working agreement. This does not authorize guidance edits or confirm new lessons without Review.

Report which findings were addressed, what changed, actual checks and results, and unresolved limitations on the current working state. Correction does not establish that a subsequent review passed. In standalone work, recommend a separately commissioned fresh Review. In Auto-Work, return the report to its fresh independent reviewer without asking for another phase assignment.
