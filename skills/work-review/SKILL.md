---
name: work-review
description: Review delivery against one Workflow root.
---

Use a fresh Cursor Ask context; do not inherit Writer assumptions. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), and [review](../../references/review-contract.md) completely. Inspect read-only via search, MCP, or docs.

After implementation, use no built-in or general-purpose subagent. Only `work-plan-auditor`, `work-design-auditor`, `risk-auditor`, or `delivery-auditor` may receive a `[workflow-readonly-review-v1]` task. They inherit the Cursor-selected model without a Task override, stay read-only, and never write. Workflow chooses no model.

Resolve explicit `wp-*`, else the Schema-5 Root/current chain from the active native Cursor Plan. Load its `workflow_artifact_context`, hash-bound to exact Plan text, and merge the revalidated chain with task artifacts. Hash conflicts block; cache absence does not discard exact task artifacts. Only if no Plan resolves use the unique active controller Run. Manual activity needs no Preparation/Run; ignore unscoped `workflow_status` for Manual resolution. Resolve Strategy, evidence tip, reuse, and deviations. Workflow-3/4 is read-only history; mixed, ambiguous, or invalid chains fail. Compare evidence to current sources without reruns; preserve Check outcomes and accept only equal-strength equivalents.

Choose `clarify` only for a human decision, `replan` for changed intent/scope/acceptance/risk, `retry-review` only for evidence needed to decide, and `correct` for a proven in-scope Agent-Mode gap, including verification-only work.

Without a unique Root, request the missing selector/artifacts and emit no `work-review`. If Root resolution succeeds but Evidence is still absent, prescribe `/close-work [wp-id]` and emit no review. Otherwise return one compact schema-valid Schema-5 review covering every acceptance outcome and required Check; validate when available and never artifact-label diagnostics. Never raise evidence grades: missing evidence may be provisional, known failure is blocked. Only for `correct`, read [embedded correction](../../references/correction-contract.md) completely and author one Findings-backed correction. Record the exact review through `workflow_artifact_record`; on persistence failure return it unchanged with an attach instruction. Do not load Learning closeout or infer production success.
