---
name: explain-work
description: Explain one exact portable Workflow plan or delivery read-only without changing its artifact chain.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Explain work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [state contract](../../../../references/state-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Resolve one exact Schema-6 chain from current artifacts and validate it through `${PLUGIN_ROOT}/dist/manual-workflow.mjs status`. Reject every unsupported artifact schema. Treat cached content as transport and `extensions` or harness trace as opaque metadata; never use them as authority.

Stay read-only and emit no Workflow artifact. Separate limitations from blockers, keep exact IDs in technical traceability, and give one lifecycle-level next action. Concrete execution choices belong to the project harness.
