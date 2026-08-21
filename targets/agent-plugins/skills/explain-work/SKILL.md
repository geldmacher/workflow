---
name: explain-work
description: Explain one exact portable Workflow plan or delivery read-only without changing its artifact chain.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Explain work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [human-first output](../../../../references/human-output-contract.md), [state contract](../../../../references/state-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Resolve one exact Schema-5 chain from current artifacts or `workflow_artifact_context`. Treat cached content only as transport and `extensions` as opaque audit metadata. Never interpret, quote, summarize, or use extensions as authority.

Stay read-only and emit no Workflow artifact. Use `Final repository explanation` only for `achieved`; otherwise use `Preliminary explanation`, explicit blockers, and the next safe skill. Return `Quick decision`, then human `Details` where `What was achieved`, `What this means`, and `Verification and limits` stand alone. Finish with the authoritative `Agent and machine contract`; put exact Root, Evidence, Review, Check, Finding, path, symbol, and continuation IDs in its `Technical traceability`.
