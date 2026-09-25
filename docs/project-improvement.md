# Make future tasks easier

A task can leave more than working code: knowledge the next agent can reuse, a repeatable way to check behavior, or a better method for approaching the problem. Workflow offers these when they help. You choose which additions to make.

| Need | What helps | Example for CSV export |
|---|---|---|
| Avoid rediscovering project conventions | Saved project lessons | Which download helper to use and why |
| Check real behavior consistently | A verifier: reusable checking instructions | How to apply filters, download a CSV, and check its rows |
| Give the agent an appropriate approach | A playbook: a focused working method | How to reproduce and fix an export defect |

## Save project knowledge

During implementation and correction, Workflow records useful discoveries as **learning candidates**: proposed lessons with evidence, a future benefit, where they apply, and where they could be saved. Collection happens as part of the work; it does not silently change project instructions.

Every review checks earlier and new candidates against the current work. If any lessons are confirmed and useful, it offers `learn-from-work`. A lesson can be sound even when an unrelated code correction remains; the learning offer does not change the review judgment. If there is nothing useful to save, there is no offer.

For example, review might establish that the existing download helper correctly handles CSV filenames. A fictional offer could say:

> Save the verified download-helper convention in the project guide so future export tasks can reuse it. The report links the implementation and the checks supporting this lesson.

To accept, ask:

> $learn-from-work Save the confirmed CSV export lessons from this task.

Use `/learn-from-work` in Cursor Agent Mode. In other compatible clients, use `learn-from-work`.

The skill rechecks current evidence, later changes, existing guidance, duplicates, and conflicts before saving. Unless you narrow the request, it considers the complete available open collection. Its report names saved files and lessons, merged or retired candidates, and anything still unresolved. It reads back the saved guidance before reporting successful integration; a repeated or interrupted request checks the destination first to avoid duplicates.

Future planning reads relevant saved guidance and checks that it still applies. This improves project instructions and skills; it does not train the model. Saving personal memory needs its own explicit request. Broader code, tooling, verifier, or plugin changes become separate development assignments.

### Example: lessons through corrections

This is a fictional sequence:

1. Review confirms two lessons: run the export check from the backend directory, and use isolated temporary orders as test data. You choose to fix a code finding first; both lessons remain in the reports.
2. Correction introduces a verified root-level command. The next review replaces the backend-directory recipe with the new command, records why, and keeps the test-data lesson. It also confirms how to wait for export readiness.
3. You request learning later. The agent checks all three current lessons together. It saves those still supported and retires the old command recipe, rather than saving conflicting instructions.

If one lesson lacks evidence, it stays open while independent confirmed lessons can be saved. Conflicts are resolved from evidence and scope, not merely by choosing the newest statement. If saved guidance has become wrong, review can propose its later update or removal.

One complete collection stays in the task. Later reports carry changes and a reference to that collection, and include each candidate's content, evidence, benefit, scope, and proposed destination when the receiver cannot open the reference. Missing earlier reports remain a visible gap. You can defer saving without discarding the collection; learning is never a required completion step. Status and explanation can describe it without repeating the offer.

See the [executor learning guidance](../references/learning-work.md) for reconciliation details.

## Keep checks useful

A **verifier** is a reusable skill describing how to check real product behavior. It records prerequisites, how to start the relevant UI, CLI, or service, actions to take, expected results, evidence to retain, and cleanup.

For CSV export, this could explain how to create temporary orders, set a filter, download the file, compare columns and rows, and remove the temporary data. Existing tests and suitable verifiers are reused first.

The two related skills have different jobs:

- `workflow-doctor` inspects whether verification is ready without starting the product.
- `verification-work` inspects, creates, or maintains a concrete verifier. Inspection is read-only; creating or changing it needs an implementation or correction assignment covering that work.

You can ask “Do our checks cover the CSV export?” to inspect readiness. During planning, Workflow also looks for concrete gaps or stale instructions and offers creation or maintenance when useful.

A fictional proposal might say:

> Add an export-checking recipe to the project's verifier. Cover filters, visible columns, and empty exports. At implementation close, run that recipe against the finished feature and retain the downloaded examples as evidence.

Once you accept the proposal and commission implementation, the verifier changes and their first end-to-end trial are part of the work. Review checks the accepted scope and actual evidence. You do not need to remember a separate maintenance request for that already accepted work.

Maintenance normally covers affected features. Explicitly requesting `maintain full` covers the agreed full feature map. If a later task changes the download flow, planning can offer an update to the recipe. A product regression remains a finding: changing the expected result just to make a check pass is not maintenance.

If a necessary trial fails or cannot run, the report names the missing proof. Accepting documentation work alone does not establish that the product passed its checks. See the executor instructions for [creation](../skills/verification-work/references/create.md) and [maintenance](../skills/verification-work/references/maintain.md).

## Choose a working method

An engineering **playbook** gives the agent a focused approach for the current task. It does not add a permanent project mode or authorize extra phases.

| Your task | Example method | What it helps establish |
|---|---|---|
| Add CSV export | `feature` | Agreed behavior and checks for the new capability |
| Fix ignored export filters | `bug-fix` | A reproduced defect and a checked correction |
| Understand an unexplained live failure | `runtime-forensics` | A diagnosis based on fresh runtime evidence |
| Speed up a large export | `performance` | A measured improvement against a baseline |
| Restructure export code | `refactoring` | Preserved behavior while changing structure |

Planning offers relevant options with a benefit, intended phase, one recommendation, and a choice to use none. You do not need to memorize method names. To ask directly, use `engineering-work suggest`; to select a known method, use `engineering-work use <playbook-id>`, with your host's usual skill prefix.

Only selected methods are loaded and included in the plan. The [full catalog](../skills/engineering-work/references/catalog.md) covers additional methods, including prototypes, visual comparisons, evaluations, and task resumption.

## What you choose

Playbook and verifier offers are independent. You may choose either, both, or neither. Each proposal explains its benefit and scope; a verifier proposal also names its destination, affected features, and closing trial. You can ask for a revised proposal.

A recommendation or silence does not count as acceptance. Declined or unanswered offers are left out of the plan, do not block planning, and are not repeated for that scope. Existing approval remains valid. Suitable existing checks can be reused without a new offer.

Declining additional verifier work does not remove the need to prove the agreed result. Remaining gaps, alternatives, and limits stay visible. Learning is a separate choice after review, even in Auto-Work.

Return to the [working guide](manual-workflow.md) or [Auto-Work walkthrough](auto-work.md).
