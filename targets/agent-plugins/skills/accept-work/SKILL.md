---
name: accept-work
description: Ephemerally accept one current provisional portable Manual delivery after exact status validation.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Accept work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [state contract](../../../../references/state-contract.md) completely.

Require one exact complete current Schema-5 chain whose unique Review tip permits provisional acceptance. Call `workflow_status` with the exact artifacts, explicit Root ID, and `manual_acceptance: provisional`.

Report `accepted-provisional`, the Root ID, `acceptance_persisted: false`, and the returned basis hash only when the tool returns them. Refuse verified, blocked, failed, incomplete, stale, mixed, ambiguous, or correction-pending chains. Do not create or modify files, artifacts, guidance, Git state, persistent approval state, or external systems.
