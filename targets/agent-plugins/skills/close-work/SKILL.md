---
name: close-work
description: Recover deterministic portable Schema-5 delivery closeout without editing the repository.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Close work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), and [closeout](../../../../references/closeout-contract.md) completely.

Resolve one exact Root or correction chain from current artifacts. Use `workflow_artifact_context` only as non-authoritative transport enrichment. Capture current repository identity and a complete stable baseline before running any check.

Do not edit repository files or trigger external effects. Run only missing Checks that are read-only and already authorized; mark mutating, unsafe, or unavailable Checks honestly. Preserve known failures. Without a trustworthy pre-mutation baseline, cap observations at `supported` and state the limitation.

Recompute the state and stop on drift. Call `workflow_closeout` with the exact Root, lineage artifacts when applicable, changed paths, direct Check observations, and repository snapshot. Report completion only from the returned exact Evidence. This skill grants no implementation, correction, acceptance, learning, merge, push, publication, deployment, or installation authority.

Run machine Checks only as exact standalone planned commands in their planned directories. When the client has no protected receipt hook, accept the honest MCP downgrade, explain why it matters and how a compatible host can recover, then route to fresh review; never fabricate or repeatedly request unattainable proof.
