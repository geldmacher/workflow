---
name: review-work
description: Perform a fresh read-only review of one exact portable Schema-5 Workflow delivery.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Review work

Use a fresh review context when the client supports one. Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), [review contract](../../../../references/review-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Require one exact current Schema-5 Root and Evidence chain in the conversation. `workflow_artifact_context` may recover exact cached bytes only as transport enrichment. If Evidence is absent, invalid, stale, conflicting, mixed-version, out of authority, or ambiguous, stop and route to `close-work`; review must not manufacture closeout.

Stay repository-read-only and do not trigger external effects. Inspect changed code and direct evidence independently against acceptance, authority, and every required Check. Optional auditors are advisory, inherit the primary model, and must have every claim verified by the primary reviewer.

Emit one exact Schema-5 `work-review` with a `wr-*` ID and calibrated `next_action`. An `achieved/verified/none` verdict completes Manual work; provisional delivery requires a separate `accept-work` invocation. A proven bounded gap requires separate `correct-work` authorization.

Lead with outcome, checks, and gaps. Then explain `What was achieved`, `What this means`, `Verification and limits`, and `Technical traceability`. Keep exact Root, Evidence, Review, Check, Finding, path, and symbol IDs in technical traceability.
Lead with outcome and current-delivery constraint coverage. Show human attention and Problems only when actionable; explain why and one recovery; end with one Now/How/Why action. Then explain `What was achieved`, `What this means`, `Verification and limits`, and `Technical traceability`. Keep exact Root, Evidence, Review, Check, Finding, path, and symbol IDs in technical traceability.
