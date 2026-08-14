---
name: review-work
description: Perform a fresh read-only Workflow delivery review. Use when the user invokes $review-work or requests review against a Schema-5 Root.
---

# $review-work

Use a fresh Review phase in this Codex task; another task is optional. Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely; that contract links the closed host-owned input.

Resolve one exact Schema-5 Root/Evidence chain from task artifacts first. `workflow_artifact_context` may enrich transport when the chain is missing but never grants authority. No Root means request context. With a Root but no Evidence, gather observations once and return one strict `closeout-input` with phase `review-recovery`; the hook hydrates or builds Evidence and continues this same read-only review once. Invalid, conflicting, mixed-version, stale, ambiguous, out-of-authority, or second-recovery chains block review. `$close-work` and `workflow_closeout` remain optional recovery compatibility.

Only a fresh protected root-boundary receipt from the lifecycle hook may produce that Review. Supply no reviewer envelope; the host fixes `insufficient-evidence/blocked/replan`. Never invent or repair proof. Missing trust, stale/rootless proof, or a transport gap grants no Review.

Stay read-only. Do not edit files or run mutating tools. Optional built-in delivery, risk, or design auditors receive a bounded role prompt plus `[workflow-model-inherit-v1]` and no model/provider override. Verify their claims yourself; unattested output is not evidence.

Lead with outcome, Checks, and gaps, then emit one closed `json workflow-review-input`, never Schema-5 Review bytes or IDs. The hook resolves the exact task-local chain and deterministically builds, validates, and retains the authoritative Review. For `correct`, provide complete local-key Findings and correction parts; never upgrade Evidence. Manual `achieved/verified/none` completes; only provisional needs `$accept-work provisional`.

Use the current-delivery `constraint_summary`, `human_attention`, and `problem_details`. State what happened; show attention and Problems only when actionable; explain why and how to recover; end with one Now/How/Why action.

The current reviewer—not another subagent or model call—must then give **Final repository explanation** only for `achieved`, otherwise **Preliminary explanation** with blockers and next safe action. Order `What was achieved`, `What this means`, `Verification and limits`, and `Technical traceability`; make the first three understandable without implementation history and put exact Root/Evidence/Review, Check/Finding, and path/symbol IDs last.

Malformed input gets one named-field repair in this task; Root, Evidence, and work remain intact. A second failure blocks only Review. Optional persistence cannot invalidate the task-local Review. New full model-authored Reviews are rejected; immutable history stays readable. End actionable output with `### Next step` using `$command`; achieved uses `### Done`. Correction stays separately human-authorized.
