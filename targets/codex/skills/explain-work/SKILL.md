---
name: explain-work
description: Explain a Workflow plan or delivery read-only. Use when the user invokes $explain-work or asks how a Workflow artifact chain behaves.
---

# $explain-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [human-first output](../../references/human-output-contract.md), [state contract](../../references/state-contract.md), and [explanation contract](../../references/explanation-contract.md) completely.

Resolve one exact Schema-5 chain from current-task artifact bytes only. Never restore Manual authority from hook state, cache, handoff, or another task. Stay read-only and emit no Workflow artifact. Treat `extensions` as opaque audit metadata: never interpret, quote, summarize, or use it.

Follow the shared three-layer format. Use **Final repository explanation** only for `achieved`; otherwise use **Preliminary explanation**, blockers, and the next safe action. Make `Quick decision` and human `Details` stand alone for someone who missed implementation; keep `What was achieved`, `What this means`, and `Verification and limits` in Details. Put exact Root/Evidence/Review, Check/Finding, path/symbol IDs, and continuation state in the last `Agent and machine contract`; keep unknowns explicit.
