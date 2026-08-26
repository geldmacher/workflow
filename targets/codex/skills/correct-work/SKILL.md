---
name: correct-work
description: Correct a proven in-scope Workflow finding under separate human authorization. Use when the user invokes $correct-work with a Root or current review chain.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [correction](../../references/correction-contract.md), and [artifact protocol](../../references/artifact-protocol.md) completely.

Resolve one exact current Schema-6 Root/Evidence/Review chain from this task and validate it through `../../dist/manual-workflow.mjs status`. Proceed only when the unique review tip says `next_action: correct` and names bounded Findings. Unsupported state, ambiguity, changed authority, new scope, risk, or acceptance requires a human-approved Schema-6 replan.

This invocation authorizes only the named correction. Preserve unrelated work and Root authority. The active project harness chooses all commands, tools, models, sandboxes, worktrees, retries, and verification strategy; Workflow does not assess those choices.

Finish normally without creating Evidence or Workflow state. A fresh `$review-work` creates delta Evidence through the local builder. Do not merge, push, publish, deploy, install, or create external effects.
