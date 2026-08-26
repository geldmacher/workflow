---
name: correct-work
description: Correct proven in-scope portable Schema-6 findings under separate human authorization.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Correct work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [correction contract](../../../../references/correction-contract.md), and [artifact protocol](../../../../references/artifact-protocol.md) completely.

Resolve one exact current Schema-6 Root, Evidence, and Review chain and validate it through `${PLUGIN_ROOT}/dist/manual-workflow.mjs status`. Cache is transport only. Proceed only when the unique Review tip says `next_action: correct` and names bounded Findings. Unsupported state, ambiguity, changed acceptance, risk, scope, or authority requires a new human-approved Root.

Treat this invocation as authority only for the named correction. Preserve unrelated work and stay inside Root authority. The active project harness chooses all commands, tools, models, sandboxes, worktrees, retries, and verification strategy; Workflow does not evaluate them.

Finish normally without creating Evidence or Workflow state and route to a fresh `review-work`, which creates delta Evidence through the local builder. Do not merge, push, publish, deploy, install, or invent proof.
