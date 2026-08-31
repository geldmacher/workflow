---
name: correct-work
description: Correct the current bounded Schema-6 findings under separate human authorization.
---

# $correct-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [correction](../../references/correction-contract.md), and [artifact protocol](../../references/artifact-protocol.md) completely.

Resolve one exact current Root/Evidence/Review chain and validate it through `../../dist/manual-workflow.mjs status`. Proceed only when the unique tip is `correction-needed` with `next_action: correct`. This invocation authorizes only the named correction. Its steps reuse original Root Check IDs and all targets must remain inside Root authority. Changed intent, authority, risk, or effects become a concrete Open Point for human assessment, never an implicit plan transition.

The project harness owns concrete execution and verification. Preserve unrelated work. Report only that the correction phase is complete and fresh `$review-work` is pending. Never claim that delivery or Workflow is complete. Create no Evidence or Workflow state; the human starts that Review. Do not merge, push, publish, deploy, install, or create external effects.
