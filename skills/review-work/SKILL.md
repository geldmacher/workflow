---
name: review-work
description: Assess an approved plan and current work without repository changes.
---

# review-work

Read the [working agreement](../../references/workflow.md). Identify the approved plan version, implementation or correction report, and current working state.

Remain repository-read-only, including tracked and untracked files. Select inspections and tests whose effects are permitted; put any permitted transient outputs outside the repository. If a necessary check would mutate the repository or cross another permission boundary, record the missing evidence. Do not fix code, tests, documents, or verifiers during Review.

Assess every success criterion and relevant boundary against actual work; distinguish task changes from unrelated edits. Start with the smallest sufficient inspection. Before reusing a check result, inspect its origin, actual output, coverage, and applicability to current source, dependencies, configuration, and relevant environment. Explain the reuse basis briefly. A command list or success summary alone is insufficient. Reviewing evidence does not require rerunning every check. Recheck affected or uncertain proof; widen checks when dependencies, failures, or unresolved risk warrant it. Relevant changes during inspection invalidate affected conclusions; reassess or report the gap.

When a project verifier supports acceptance or changed in this assignment, read the [verification guidance](../../references/verification-work.md). Compare the verifier, covered user paths, and evidence with the plan and implementation; for commissioned changes, also inspect the accepted proposal and closing trial. Report defects without fixing them.

Lead with a reasoned judgment: goal achieved, corrections needed, or open points. Failed necessary checks prevent goal achieved. Missing necessary proof, unclear scope, or missing plan versions remain explicit, even when there are also correctable defects.

For each actionable defect, explain the observed behavior, supporting evidence, impact on the plan, required correction, permitted scope, and recheck. This can serve as the correction assignment; avoid duplicating it. Recommend that the human commission the named corrections. For missing proof, name the missing check and a permitted way to obtain it; verification-only correction needs no code change. If access or a consequential decision is missing, ask precisely with a reasoned recommendation. Do not ask the human to attest a result the executor can collect under an authorized assignment. When the goal is achieved, state completion without another required step. Finish without starting correction.
