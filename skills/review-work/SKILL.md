---
name: review-work
description: Assess the applicable plan and current work without repository changes.
---

# review-work

Read the [working agreement](../../references/workflow.md). Identify the applicable plan, implementation or correction report, and current working state. A delegated Auto-Work review follows the same rubric; return its result to the executor without requiring the human to change host modes.

Remain repository-read-only, including tracked and untracked files. Select inspections and tests whose effects are permitted; put any permitted transient outputs outside the repository. If a necessary check would mutate the repository or cross another permission boundary, record the missing evidence. Do not fix code, tests, documents, or verifiers during Review.

Assess every success criterion and relevant boundary against actual work; distinguish task changes from unrelated edits. Start with the smallest sufficient inspection. Before reusing a check result, inspect its origin, actual output, coverage, and applicability to current source, dependencies, configuration, and relevant environment. Explain the reuse basis briefly. A command list or success summary alone is insufficient. Reviewing evidence does not require rerunning every check. Recheck affected or uncertain proof; widen checks when dependencies, failures, or unresolved risk warrant it. Relevant changes during inspection invalidate affected conclusions; reassess or report the gap.

Match optional methods and verifier edits to active selections. When a project verifier supports acceptance or changed in this assignment, read the [verification guidance](../../references/verification-work.md). Compare the verifier, covered user paths, and evidence with the plan and implementation; for commissioned changes, also inspect the accepted proposal and closing trial. Report defects without fixing them.

Lead with a reasoned judgment: goal achieved, corrections needed, or open points. Failed necessary checks prevent goal achieved. Missing necessary proof, unclear scope, or missing plan versions remain explicit, even when there are also correctable defects.

Assess inherited and new learning candidates from the reviewed work. When any exist, follow the learning guidance linked by the working agreement: reconcile the whole collection and offer eligible lessons after every Review, independently of required corrections. Keep Review read-only.

For each actionable defect, explain observed behavior, evidence, impact on the plan, required correction, permitted scope, and recheck. This can serve as the correction assignment. In standalone work, recommend that the human commission the corrections. In Auto-Work, return findings to the commissioned loop. For missing proof, name the check and a permitted way to obtain it; verification-only correction needs no code change. Consequential decisions or missing access remain explicit. Do not ask the human to attest evidence the executor can collect under its assignment. A positive Review establishes repository acceptance criteria, not Auto-Work's remaining human acceptance or delivery. Finish without starting correction or delivery.
