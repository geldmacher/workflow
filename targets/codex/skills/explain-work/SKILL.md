---
name: explain-work
description: Explain a Workflow plan or delivery read-only. Use when the user invokes $explain-work or asks how a Workflow artifact chain behaves.
---

# $explain-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [state contract](../../references/state-contract.md), and [explanation contract](../../references/explanation-contract.md) completely.

Resolve one exact Schema-6 chain from current-task artifact bytes only. Reject every unsupported artifact schema. Never restore authority from hook state, cache, handoff, or another task. Stay read-only and emit no Workflow artifact. Treat `extensions` and harness trace as opaque metadata: never interpret them as authority.

Follow the shared human-first format and keep unknowns explicit. Recommend only a lifecycle-level next action; concrete execution choices belong to the active project harness.
