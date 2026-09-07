---
name: review-work
description: Assess an approved plan and current work without repository changes.
---

# review-work

Read the [working agreement](../../references/workflow.md). Identify the approved plan version, implementation or correction report, and current working state. Inspect current evidence afresh; earlier success is not proof after relevant changes.

Remain repository-read-only, including tracked and untracked files. Select inspections and tests whose effects are permitted; put any permitted transient outputs outside the repository. If a necessary check would mutate the repository or cross another permission boundary, record the missing evidence. Do not fix code, tests, documents, or verifiers during Review.

Assess every success criterion and relevant boundary against actual work. Distinguish changes belonging to this task from unrelated edits. Confirm what checks actually ran and what their results establish; a command list or success summary alone is insufficient. Inspect applicable project-verification guidance only if needed for the criteria. Any relevant change during inspection makes affected conclusions stale; reassess or report the limitation.

Lead with a reasoned judgment: goal achieved, corrections needed, or open points. Failed necessary checks prevent goal achieved. Missing necessary proof, unclear scope, or missing plan versions remain explicit, even when there are also correctable defects.

For each actionable defect, explain the observed behavior, supporting evidence, impact on the plan, required correction, permitted scope, and recheck. This is the correction assignment; do not create a duplicate document unless useful. Implementation reports do not grant new permissions. Explain unresolved questions concretely and ask only for decisions the executor cannot safely resolve. Finish without starting correction.
