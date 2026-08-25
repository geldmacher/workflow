---
name: explain-work
description: Explain one exact portable Workflow plan or delivery read-only without changing its artifact chain.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Explain work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [state contract](../../../../references/state-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Resolve one exact Schema-6 chain from current artifacts. Reject every unsupported artifact schema. Treat cached content as transport and `extensions` or harness trace as opaque metadata; never use them as authority.

Stay read-only and emit no Workflow artifact. Separate limitations from blockers, keep exact IDs in technical traceability, and give one lifecycle-level next action. Concrete execution choices belong to the project harness.
