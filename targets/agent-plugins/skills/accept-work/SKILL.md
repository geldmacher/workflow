---
name: accept-work
description: Ephemerally accept one current provisional portable Manual delivery after exact status validation.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Accept work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [state contract](../../../../references/state-contract.md) completely.

Require one exact complete current Schema-6 chain whose unique Review tip permits provisional acceptance. Invoke `${PLUGIN_ROOT}/dist/manual-workflow.mjs accept-provisional` with the exact Root and artifacts and return its human output unchanged.

Report the ephemeral acceptance only when returned. Refuse unsupported, verified, blocked, failed, incomplete, stale, mixed, ambiguous, or correction-pending chains. Do not create or modify files, artifacts, guidance, Git state, persistent approval state, or external systems.
