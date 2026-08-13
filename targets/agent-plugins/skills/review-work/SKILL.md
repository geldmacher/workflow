---
name: review-work
description: Perform a fresh read-only review of one exact portable Schema-5 Workflow delivery.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Review work

Use a fresh review context when the client supports one. Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), [review contract](../../../../references/review-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Require one exact current Schema-5 Root and normally an Evidence chain in the conversation. `workflow_artifact_context` may recover exact cached bytes only as transport enrichment. If Evidence is absent, attempt one explicit read-only `close-work` recovery. Invalid, stale, conflicting, or mixed-version context stops without a Review.

Portable Agent Plugins have `enforcement_level: explicit` and cannot mint a protected native receipt themselves. Emit a root-boundary Review only if the client explicitly supplies a fresh protected host receipt containing `receipt_id`, `observed_at`, typed `recovery_error_code`, exact Root/snapshot hashes, reason, and observed paths, and validation confirms the current workspace snapshot. Copy it exactly; never invent or repair it. Without that host proof, fail closed with no replan. If trusted, the strict result is only `latest_evidence_id: null`, `insufficient-evidence/blocked/replan`, inline empty coverage, and no Findings, correction, acceptance, achievement, or Learning. Transient MCP failure or merely incomplete proof does not qualify.

Stay repository-read-only and do not trigger external effects. Inspect changed code and direct evidence independently against acceptance, authority, and every required Check. Optional auditors are advisory, inherit the primary model, and must have every claim verified by the primary reviewer.

Emit one exact Schema-5 `work-review` with a `wr-*` ID and calibrated `next_action`. An `achieved/verified/none` verdict completes Manual work; provisional delivery requires a separate `accept-work` invocation. A proven bounded gap requires separate `correct-work` authorization.

Lead with the journey state, jargon-light outcome, Check summary, at most one blocker, and one Now/How/Why action. Then explain `What was achieved`, `What this means`, and `Verification and limits`. Keep exact Root, Evidence, Review, Check, Finding, path, symbol, receipt, and `enforcement_level: explicit` only in Technical traceability.
