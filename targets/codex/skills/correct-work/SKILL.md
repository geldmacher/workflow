---
name: correct-work
description: Correct a proven in-scope Workflow finding under separate human authorization. Use when the user invokes $correct-work with a Root or current review chain.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [correction](../../references/correction-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [closeout](../../references/closeout-contract.md) completely.

Resolve one exact current Schema-5 Root/Evidence/Review chain from task artifacts, using `workflow_artifact_context` only as non-authoritative transport enrichment. Proceed only when the unique current review tip says `next_action: correct` and names bounded Findings. Ambiguity, changed authority, new scope, or changed acceptance requires `$plan-work replan` instead.

Treat this invocation as authorization only for the named correction. Preserve unrelated work. Optional built-in subagents inherit the parent model; never set a model or provider. After the bounded edit and required Checks, call `workflow_closeout`, record any required artifacts, and report the exact returned `de-*` artifact. Do not merge, push, publish, or deploy.
