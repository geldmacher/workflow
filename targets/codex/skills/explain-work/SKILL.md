---
name: explain-work
description: Explain a Workflow plan or delivery read-only. Use when the user invokes $explain-work or asks how a Workflow artifact chain behaves.
---

# $explain-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [state contract](../../references/state-contract.md), and [explanation contract](../../references/explanation-contract.md) completely.

Resolve one exact Schema-5 chain from task artifacts or `workflow_artifact_context`. Stay read-only and emit no Workflow artifact. Treat `extensions` as opaque audit metadata: never interpret, quote, summarize, or use it.

Follow the shared two-layer format. Use **Final repository explanation** only for `achieved`; otherwise use **Preliminary explanation**, blockers, and the next safe action. Make `What was achieved`, `What this means`, and `Verification and limits` stand alone for someone who missed implementation. Put exact Root/Evidence/Review, Check/Finding, and path/symbol IDs in `Technical traceability`; keep unknowns explicit.
