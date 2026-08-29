---
name: correct-work
description: Correct a proven in-scope Workflow finding under separate human authorization. Use when the user invokes $correct-work with a Root or current review chain.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [correction](../../references/correction-contract.md), and [artifact protocol](../../references/artifact-protocol.md) completely.

Resolve one exact current Schema-6 Root/Evidence/Review chain from this task. Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`, and validate through `../../dist/manual-workflow.mjs status`. Proceed only when the unique Review tip says `next_action: correct` and names bounded Findings. Unsupported state, ambiguity, changed authority, new scope, risk, or acceptance requires a human-approved Schema-6 replan.

This invocation authorizes only the named correction. Preserve unrelated work and Root authority. The active project harness chooses all commands, tools, models, sandboxes, worktrees, retries, and verification strategy; Workflow does not assess those choices.

Report only that the correction phase is complete and fresh `$review-work` is pending, with outcomes and limitations. Never claim that delivery or Workflow is complete. Create no Evidence or Workflow state; Review remains a separate action. Do not merge, push, publish, deploy, install, or create external effects.
