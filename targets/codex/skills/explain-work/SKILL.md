---
name: explain-work
description: Explain a Workflow plan or delivery read-only. Use when the user invokes $explain-work or asks how a Workflow artifact chain behaves.
---

# $explain-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [state contract](../../references/state-contract.md), and [explanation contract](../../references/explanation-contract.md) completely.

Resolve one exact Schema-5 chain from task artifacts or `workflow_artifact_context`. Stay read-only and emit no Workflow artifact. Treat `extensions` as opaque audit metadata: do not interpret, quote, summarize, or use it as authority.

Ground the explanation in Root, slice, Check, Finding, and path or symbol identifiers. Before an achieved review, label it **Preliminary** and name blockers plus the next safe action; afterward label it **Final repository explanation**. Keep unknowns explicit.
