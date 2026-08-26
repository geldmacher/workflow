---
name: work-status
description: Derive portable Manual Workflow status from one exact current artifact chain.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Work status

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [state contract](../../../../references/state-contract.md) completely.

Collect the exact current Schema-6 artifacts for one `wp-*` Root. Reject every unsupported artifact schema. Use cache only for non-authoritative transport enrichment. Invoke `${PLUGIN_ROOT}/dist/manual-workflow.mjs status` with the exact Root and complete chain.

Report lifecycle state, Evidence and Review tips, limitations, blockers, required human decision, and one next phase. Missing Evidence routes to fresh Review, not invented status. Do not infer commands, tools, models, harness strategy, Controller execution, or native host enforcement.

Stay read-only. Do not mutate repository files, artifacts, acceptance, operational state, host settings, or external systems.
