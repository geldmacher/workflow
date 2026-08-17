# Native Plan container

Cursor and Codex own their native Plan UI. Workflow contributes one exact immutable Schema-5 `work-plan` Root with a visible `wp-*` ID; it does not create a second authoritative plan container or store an active Manual Root.

## Cursor

Emit one H1, then a `yaml artifact-envelope` containing the exact Root. Native todos describe implementation and planned Checks only. Add no closeout todo, model-inheritance marker requirement, `workflow_attestation`, Evidence step, artifact-record call, or delivery report. The validation-only CreatePlan guard checks the exposed Root but creates no receipt and does not gate later implementation.

## Codex

Return one native `<proposed_plan>` containing the exact Schema-5 Root text and visible ID. Add no `## Final implementation step` ceremony or attestation fence. Native Stop validation may reject an invalid Root but stores no active Root or cross-task authority.

For a replan, preserve decisions not reopened by the current task's exact Review. Use a fresh Root ID with exact `predecessor_plan_id` and `replan_source_review_id`, then obtain renewed human approval through native **Implement Plan**.

Put the explicit `### Verification` table directly inside `## Acceptance`, before its next H2. Columns: `Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites`.
