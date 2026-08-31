---
name: plan-work
description: Create a human-authorized free-form Schema-6 plan with a generated Authority Core.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Plan work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [executable contract](../../../../references/executable-contract.md), [design contract](../../../../references/design-contract.md), and [plan container](../../../../references/plan-container-contract.md) completely.

Clarify only material outcome, scope, authority, risk, behavior, or acceptance decisions. Once stable, recommend exactly one closest playbook with ID, fit, intended phase, and authority need, then ask and wait for one explicit inline confirm or decline. Decline continues without a playbook. Keep the choice as human trace outside authority; a material intent change requires a fresh suggestion.

Write a complete free-form Markdown implementation prompt. Formatting is not authority. Supply its structured goal, acceptance, boundaries, risk, authority, and verification intents to `${PLUGIN_ROOT}/dist/manual-workflow.mjs build-plan`. Never author hashes or the generated `yaml workflow-authority` block manually. A deliberately new plan from Open Points may include exact predecessor bindings without a separate replan action.

Set locale from the active request. State readiness, one concrete reason, and exactly one next action: invoke `implement-work` after approval. Return exactly the generated `root_plan`. Never implement or add a Review action.
