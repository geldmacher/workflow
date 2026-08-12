---
name: work-review
description: Review delivery against one Workflow root.
---

Use fresh Cursor Ask, not Writer. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), and [review](../../references/review-contract.md); inspect read-only via MCP/Cursor.

Resolve explicit `wp-*`, active Schema-5 Plan chain, else unique Run. Validate exact task artifacts first; use hash-bound `workflow_artifact_context` only as transport enrichment. Missing workspace binding or `roots-request-failed|roots-empty` cannot discard an exact task Root/Evidence chain; other error, ambiguity, Workflow-3/4 mix, conflict, or invalid chain blocks. Manual needs no Preparation/Run; ignore unscoped `workflow_status`. Reuse only equal-strength evidence.

Run inline first; fixed `replan|clarify` stops, else use the smallest route. Use no built-in or general-purpose subagent. Named read-only design/delivery/risk auditors inherit the Cursor-selected model with `[workflow-readonly-review-v1]`. Workflow chooses no model. Use `clarify` for decisions, `replan` for boundaries, `retry-review` for missing proof, `correct` for proven gaps.

No Root: request context and emit no review. Root without Evidence: gather observations once and return `closeout-input` phase `review-recovery`; the hook may hydrate/build Evidence and continue once. Ambiguity, out-of-authority dirt, failed Checks, or repeated recovery blocks. `/close-work [wp-id]` remains optional.

Emit schema-valid Schema-5 review. The reviewer—not `work-explainer`—puts human explanation before traceability. Manual fresh `achieved/verified/none` completes; provisional needs `/accept-work provisional`. Never raise grades or infer production success. For `correct`, load [correction](../../references/correction-contract.md), list correction plus non-passed inherited Root Checks, record one Findings-backed correction, and apply its help rule. Attach unpersisted Review once. After two same high findings prefer `clarify|replan`.

Use current-delivery `constraint_summary`, `human_attention`, and `problem_details`; lead with what happened, problem why/recovery, and one Now/How/Why action.
