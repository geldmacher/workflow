---
name: review-work
description: Perform a fresh read-only review of one exact portable Schema-5 Workflow delivery.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Review work

Use a fresh read-only phase in the current task; another task is optional. Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), [review contract](../../../../references/review-contract.md), [host-owned input](../../../../references/work-review-input-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Require one exact current Schema-5 Root and normally an Evidence chain in the conversation. `workflow_artifact_context` may recover exact cached bytes only as transport enrichment. If Evidence is absent, attempt one explicit read-only `close-work` recovery. Invalid, stale, conflicting, or mixed-version context stops without a Review.

Portable Agent Plugins have `enforcement_level: explicit` and cannot mint a protected native receipt themselves. A root-boundary Review exists only when the client supplies a fresh protected host receipt and validation confirms its Root/current snapshot binding. Pass no reviewer input for that variant; never invent or repair proof. Without that host proof, fail closed with no replan. Transient MCP failure or incomplete proof does not qualify.

Stay repository-read-only and do not trigger external effects. Inspect changed code and direct evidence independently against acceptance, authority, and every required Check. Optional auditors are advisory, inherit the primary model, and must have every claim verified by the primary reviewer.

Return one closed Schema-1 `review_input`, never artifact bytes, IDs, bindings, status, route, hashes, receipts, or lineage. Call `workflow_closeout` with `artifact_kind: work-review`; the host resolves the exact chain, derives and validates the authoritative Review, and returns its exact bytes. Omission keeps `delivery-evidence` as the default; the Manual surface remains five tools. An `achieved/verified/none` verdict completes Manual work; provisional delivery and bounded correction remain separately authorized.

Malformed input gets one named-field repair in this task; Root, Evidence, and repository work remain intact. A second failure blocks Review only. Optional persistence failure cannot invalidate the exact task-local Review. New full model-authored Reviews are rejected; immutable history remains readable.

Lead with the journey state, jargon-light outcome, Check summary, at most one blocker, and one Now/How/Why action. Then explain `What was achieved`, `What this means`, and `Verification and limits`. Keep exact Root, Evidence, Review, Check, Finding, path, symbol, receipt, and `enforcement_level: explicit` only in Technical traceability.
