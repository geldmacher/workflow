---
name: correct-work
description: Correct a proven in-scope Workflow finding under separate human authorization. Use when the user invokes $correct-work with a Root or current review chain.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [correction](../../references/correction-contract.md), and [artifact protocol](../../references/artifact-protocol.md) completely.

Resolve one exact current Schema-5 Root/Evidence/Review chain from this task only. Proceed only when the unique current review tip says `next_action: correct` and names bounded Findings. Ambiguity, changed authority, new scope, or changed acceptance requires `$plan-work replan` instead.

Treat this invocation as authorization only for the named correction. Preserve unrelated work. Optional built-in subagents inherit the parent or a configured Manual Codex candidate; do not choose models. Combine correction Checks with every inherited required Root Check not effectively passed; unavailable or failed results stay explicit. Finish normally without closeout, Evidence, persistence, or a synthetic continuation. The next fresh `$review-work` creates delta Evidence against the exact current-task chain. Do not merge, push, publish, or deploy.

Run machine Checks as exact standalone planned commands in their planned directories; one leading `rtk` is allowed. These implementation observations do not replace fresh reviewer observations.
