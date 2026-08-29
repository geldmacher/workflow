---
name: implement-work
description: Implement one approved portable Schema-6 Root under separate human authorization.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Implement work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [executable contract](../../../../references/executable-contract.md) completely.

Treat this invocation as implementation authority only for one exact Schema-6 Root in the current conversation. Require an unambiguous workspace. Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`, and validate through `${PLUGIN_ROOT}/dist/manual-workflow.mjs validate-plan`. Proceed only when feasible with the same Root ID.

Preserve unrelated changes and remain inside Root authority. New scope, protected paths, dependencies, external effects, risk, or acceptance requires a new human-approved Root.

Implement the approved outcomes. The active project harness chooses all commands, tools, models, working directories, sandboxes, worktrees, retries, and verification strategy. Workflow does not assess or prescribe those choices.

Report only that the implementation phase is complete and fresh `review-work` is pending, with outcomes and limitations. Never claim that delivery or Workflow is complete. Create no Evidence or Workflow state; Review remains separate. Repository observations become only unprotected local Review input unless optional protected sealing later appends a separate result. Do not merge, push, publish, deploy, install, or create external effects.
