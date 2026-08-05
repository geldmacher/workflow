---
name: work-review
description: Review delivery against one Workflow root.
---

Use a fresh Cursor Ask context without Writer assumptions. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), and [review](../../references/review-contract.md); inspect read-only via MCP/Cursor.

Resolve explicit `wp-*`, else the active Plan's Schema-5 chain, else the unique active Run. Validate exact task artifacts first; use hash-bound `workflow_artifact_context` only as transport enrichment. `roots-request-failed|roots-empty` cannot discard an exact task Root/Evidence chain; every other Root error, ambiguity, Workflow-3/4 mix, conflict, or invalid chain blocks. Manual needs no Preparation/Run; ignore unscoped `workflow_status` for Manual resolution. Reuse only equal-strength evidence.

Run inline first; fixed `replan|clarify` stops, else use the smallest route. Use no built-in or general-purpose subagent. Only named read-only design/delivery/risk auditors may run; they inherit the selected model and receive `[workflow-readonly-review-v1]`. Record the primary as `inline`; Workflow chooses no model.

Use `clarify` for decisions, `replan` for changed boundaries, `retry-review` for missing evidence, and `correct` for a proven in-scope gap.

No Root: request context and emit no review. Root without Evidence: prescribe `/close-work [wp-id]`; roots transport failure permits pure exact-chain closeout. Else emit and validate one Schema-5 review for acceptance and required Checks. Never raise grades: unavailable may be provisional; failure is blocked. For `correct`, read [correction](../../references/correction-contract.md) and record one Findings-backed correction. Attach unpersisted artifacts; never infer production success.
