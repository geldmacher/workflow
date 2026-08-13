---
name: review-work
description: Perform a fresh read-only Workflow delivery review. Use when the user invokes $review-work or requests review against a Schema-5 Root.
---

# $review-work

Use a fresh Codex task. Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely.

Resolve one exact Schema-5 Root/Evidence chain from task artifacts first. `workflow_artifact_context` may enrich transport when the chain is missing but never grants authority. No Root means request context. With a Root but no Evidence, gather observations once and return one strict `closeout-input` with phase `review-recovery`; the hook hydrates or builds Evidence and continues this same read-only review once. Invalid, conflicting, mixed-version, stale, ambiguous, out-of-authority, or second-recovery chains block review. `$close-work` and `workflow_closeout` remain optional recovery compatibility.

Only when the Codex lifecycle hook returns a fresh protected root-boundary receipt after a typed irrecoverable post-mutation recovery error may you copy its exact `receipt_id`, `observed_at`, `recovery_error_code`, reason, Root/snapshot hashes, and observed paths into an `insufficient-evidence/blocked/replan` root-boundary Review. Never invent or repair it. Missing host trust, stale receipt, rootless/portable validation, or a temporary transport gap grants no Review and no replan.

Stay read-only. Do not edit files or run mutating tools. Optional built-in delivery, risk, or design auditors receive a bounded role prompt plus `[workflow-model-inherit-v1]` and no model/provider override. Verify their claims yourself; unattested output is not evidence.

Lead with outcome, checks, and gaps, then emit one exact Schema-5 `work-review`; the lifecycle hook captures those exact bytes task-locally under the Root-content hash for a later authorized correction. `workflow_artifact_record` is optional transport, not required reconstruction. Attach full `wr-*` only when unpersisted; never dump retained YAML. Calibrate `next_action` (`clarify`, `replan`, `retry-review`, `correct`, or achieved). A correction's verification lists its Checks plus inherited required Root Checks not effectively passed. Manual `achieved/verified/none` completes after this human-started review; only provisional needs `$accept-work provisional`.

Use the current-delivery `constraint_summary`, `human_attention`, and `problem_details`. State what happened; show attention and Problems only when actionable; explain why and how to recover; end with one Now/How/Why action.

The current reviewer—not another subagent or model call—must then give **Final repository explanation** only for `achieved`, otherwise **Preliminary explanation** with blockers and next safe action. Order `What was achieved`, `What this means`, `Verification and limits`, and `Technical traceability`; make the first three understandable without implementation history and put exact Root/Evidence/Review, Check/Finding, and path/symbol IDs last.

End actionable output with `### Next step` using `$command` tokens; achieved uses compact `### Done`. After two correction rounds with the same high Finding prefer `clarify` or `replan`. Never raise grades. `workflow_artifact_record` is best-effort transport; correction remains separately human-authorized.
