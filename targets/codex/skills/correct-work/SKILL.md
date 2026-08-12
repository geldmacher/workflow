---
name: correct-work
description: Correct a proven in-scope Workflow finding under separate human authorization. Use when the user invokes $correct-work with a Root or current review chain.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [correction](../../references/correction-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [closeout](../../references/closeout-contract.md) completely.

Resolve one exact current Schema-5 Root/Evidence/Review chain from task artifacts, using `workflow_artifact_context` only as non-authoritative transport enrichment. Proceed only when the unique current review tip says `next_action: correct` and names bounded Findings. Ambiguity, changed authority, new scope, or changed acceptance requires `$plan-work replan` instead.

Treat this invocation as authorization only for the named correction. Preserve unrelated work. Optional built-in subagents inherit the parent or a configured Manual Codex candidate; do not choose models. Combine correction Checks with every inherited required Root Check not effectively `passed`; reuse only passed proof. Equivalent Checks run once on one stable closeout state while each ID keeps honest Evidence; unavailable or failed proof stays explicit. Return one strict `closeout-input` with phase `correction`, Checks, and summary; omit path fields. The hook binds the exact task-local Root, predecessor Evidence, and Source Review, derives the complete authoritative paths/snapshot, and persists builder-owned delta Evidence. `workflow_artifact_record` and `workflow_closeout` remain optional. Do not invent derived Evidence fields or merge, push, publish, or deploy.

Run machine Checks as exact standalone planned commands in their planned directories; one leading `rtk` is allowed. Host receipts are automatic, and absent or invalid proof downgrades with one exact recovery action.
