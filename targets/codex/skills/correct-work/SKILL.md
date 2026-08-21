---
name: correct-work
description: Correct a proven in-scope Workflow finding under separate human authorization. Use when the user invokes $correct-work with a Root or current review chain.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [human-first output](../../references/human-output-contract.md), [correction](../../references/correction-contract.md), and [artifact protocol](../../references/artifact-protocol.md) completely.

Resolve one exact current Schema-5 Root/Evidence/Review chain. Prefer visible current-task bytes; if this task names the exact Root/Review but bytes are unavailable, use `workflow_artifact_context` once only as content-bound transport and require the unique revalidated host-built Review. Proceed only when the review tip says `next_action: correct` and names bounded Findings. Missing transport, ambiguity, changed authority, new scope, or changed acceptance requires a stop or `$plan-work replan` as appropriate.

Treat this invocation as authorization only for the named correction. Preserve unrelated work. Optional built-in subagents inherit the parent or a configured Manual Codex candidate; do not choose models. Combine correction Checks with every inherited required Root Check not effectively passed; unavailable or failed results stay explicit. Finish normally without closeout, Evidence, persistence, or a synthetic continuation. The next fresh `$review-work` creates delta Evidence against the exact current-task chain. Do not merge, push, publish, or deploy.

Run machine Checks as exact standalone planned commands in their planned directories; one leading `rtk` is allowed. These implementation observations do not replace fresh reviewer observations.

Finish with `Quick decision`, complete human `Details`, then the authoritative `Agent and machine contract` containing exact changed paths, Check observations, limitations, and the single fresh `$review-work` action. The first two layers explain the result without requiring the machine fields.
