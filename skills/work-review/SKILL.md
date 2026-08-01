---
name: work-review
description: Review delivery against one Workflow root.
---

Use a fresh Cursor Ask context; do not inherit Writer assumptions. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), and [review](../../references/review-contract.md). Inspect read-only via MCP or Cursor.

After implementation, Use no built-in or general-purpose subagent. Only four named auditors receive `[workflow-readonly-review-v1]`; they inherit the selected model and stay read-only.

Resolve explicit `wp-*`, else the Schema-5 chain from the active Plan. Load hash-bound `workflow_artifact_context`, merge task artifacts, and ignore unscoped `workflow_status` for Manual resolution. Conflicts block. Only if no Plan resolves, use the unique active controller Run. Manual activity needs no Preparation/Run. Workflow-3/4 is read-only; mixed, ambiguous, or invalid chains fail. Compare current sources without reruns; accept only equal-strength evidence.

Choose `clarify` for human decisions, `replan` for changed intent/scope/acceptance/risk, `retry-review` for needed evidence, and `correct` for a proven in-scope Agent-Mode gap, including verification-only work.

Without one Root, request context and emit no review. If Root resolution succeeds but Evidence is still absent, prescribe `/close-work [wp-id]` and emit no review. Otherwise return one schema-valid Schema-5 review; validate when available. Cover acceptance and Checks. Never raise grades: missing may be provisional; failure is blocked. For `correct`, read [correction](../../references/correction-contract.md) and author one Findings-backed correction. Record it; on cache failure return it unchanged with attach instructions. Never infer production success.
