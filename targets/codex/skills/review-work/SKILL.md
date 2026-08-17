---
name: review-work
description: Perform a fresh read-only Workflow delivery review. Use when the user invokes $review-work or requests review against a Schema-5 Root.
---

# $review-work

Use a fresh Review phase in this Codex task; another task is optional. Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely; that contract links the closed host-owned input.

Resolve one exact Schema-5 Root only from the current Codex Plan-mode `<proposed_plan>` and current task context. Current-task predecessor Evidence/Review bytes may extend it. Never restore authority from hook state, handoff/cache, `workflow_artifact_context`, or another task. If no exact Root is available, stop before substantive review: list the native sources inspected and give one remedy—restore the Plan in this task or create and approve a new native Plan. Ambiguous native candidates block Review the same way.

Stay read-only. Do not edit files or run mutating tools. Optional built-in delivery, risk, or design auditors receive a bounded role prompt plus `[workflow-model-inherit-v1]` and no model/provider override. Verify their claims yourself; unattested output is not evidence.

Run or directly inspect the planned Checks fresh in their planned directories. A Manual Check is `verified` only when this reviewer directly observed the matching method, expectation, result, and repetition. High-risk or Hard-Trigger Roots require delivery- and risk-auditor reports, plus design review when material. Unresolved uncertainty stays visible.

Call `workflow_closeout` exactly once with `artifact_kind: work-review`, exact native `root_plan`, current-task predecessor artifacts, fresh `check_evidence`, and one closed `review_input`. It returns Delivery Evidence and Work Review atomically or neither. Never author IDs, grades, snapshots, changed paths, or artifact bytes. A failed required Check produces a completed blocked Review instead of aborting Review.

Use the current-delivery `constraint_summary`, `human_attention`, and `problem_details`. State what happened; show attention and Problems only when actionable; explain why and how to recover; end with one Now/How/Why action.

The current reviewer—not another subagent or model call—must then give **Final repository explanation** only for `achieved`, otherwise **Preliminary explanation** with blockers and next safe action. Order `What was achieved`, `What this means`, `Verification and limits`, and `Technical traceability`; make the first three understandable without implementation history and put exact Root/Evidence/Review, Check/Finding, and path/symbol IDs last.

Malformed input gets one named-field repair in this task; Root and repository work remain intact. A second failure blocks only Review. Returned exact Evidence/Review bytes remain authoritative in this task even when persistence is unavailable. End actionable output with `### Next step` using `$command`; achieved uses `### Done`. Correction stays separately human-authorized.
