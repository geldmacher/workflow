---
name: correct-work
description: Correct the current bounded Schema-6 findings under separate human authorization.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Correct work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [correction contract](../../../../references/correction-contract.md), and [artifact protocol](../../../../references/artifact-protocol.md) completely.

Resolve one exact current Root/Evidence/Review chain and validate through `${PLUGIN_ROOT}/dist/manual-workflow.mjs status`. Proceed only for `correction-needed` with `next_action: correct`. This invocation authorizes only the named correction. Reuse original Root Check IDs and remain inside Root authority. Changed intent, risk, scope, authority, or effects becomes a concrete Open Point for human assessment.

The project harness owns concrete execution and verification. Preserve unrelated work. Report only that the correction phase is complete and fresh `review-work` is pending. Never claim that delivery or Workflow is complete. Create no Evidence or Workflow state; the human starts that Review. Do not merge, push, publish, deploy, install, or invent proof.
