---
name: work-review
description: Review delivery against one Workflow root.
---

Use fresh Cursor Ask, not Writer. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), and [review](../../references/review-contract.md); inspect read-only via MCP.

Resolve explicit `wp-*`, active Schema-5 Plan chain, else unique Run. Validate task artifacts first; `workflow_artifact_context` is transport enrichment. Missing workspace binding or `roots-request-failed|roots-empty` cannot discard the task Root/Evidence chain. Other errors, ambiguity, Workflow-3/4 mix, or invalid chain blocks. Manual needs no Preparation/Run; ignore unscoped `workflow_status`. Reuse only equal-strength Evidence.

Run inline first; fixed `replan|clarify` stops; otherwise smallest route. Use no built-in or general-purpose subagent. Named read-only design/delivery/risk auditors inherit the Cursor-selected model with `[workflow-readonly-review-v1]`; Workflow chooses no model. Clarify decisions, replan boundaries, retry proof gaps, correct in-Root gaps.

No Root: request context, no Review. Root without Evidence: observe once, return `closeout-input` phase `review-recovery`; the hook may build Evidence and continue once. `/close-work [wp-id]` is optional.

Root-boundary needs a fresh protected native-host receipt after typed irrecoverable post-mutation recovery. Copy exact ID/time/error/reason, Root/snapshot hashes, paths; never invent/repair. Emit `review_basis: root-boundary`, `latest_evidence_id: null`, `insufficient-evidence/blocked/replan`, no Finding; only approved linear replan. Missing trust, portable/rootless validation, transport/roots-empty/incomplete proof, or stale receipt blocks.

Emit a schema-valid Schema-5 Review. `achieved/verified/none` completes; provisional offers only `/accept-work provisional`. Never raise grades or infer production success. For `correct`, load [correction](../../references/correction-contract.md), include non-passed inherited Checks and one Findings-backed correction. Attach unpersisted Review once. Two no-progress corrections require clarify/replan.

Primary: journey/result, Checks, at most one blocker, one Now/How/Why action. Trace IDs, paths, receipts, enforcement. Use `constraint_summary`, `human_attention`, and `problem_details`.
