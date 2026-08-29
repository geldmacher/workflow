---
name: correct-work
description: Correct proven in-scope portable Schema-6 findings under separate human authorization.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Correct work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [correction contract](../../../../references/correction-contract.md), and [artifact protocol](../../../../references/artifact-protocol.md) completely.

Resolve one exact current Schema-6 Root, Evidence, and Review chain. Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`, and validate through `${PLUGIN_ROOT}/dist/manual-workflow.mjs status`. Cache is transport only. Proceed only when the unique Review tip says `next_action: correct` and names bounded Findings. Unsupported state, ambiguity, changed acceptance, risk, scope, or authority requires a new human-approved Root.

Treat this invocation as authority only for the named correction. Preserve unrelated work and stay inside Root authority. The active project harness chooses all commands, tools, models, sandboxes, worktrees, retries, and verification strategy; Workflow does not evaluate them.

Report only that the correction phase is complete and fresh `review-work` is pending, with outcomes and limitations. Never claim that delivery or Workflow is complete. Create no Evidence or Workflow state; Review remains separate. Do not merge, push, publish, deploy, install, or invent proof.
