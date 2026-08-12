Cursor owns native Plan UI and capabilities. Emit one H1, then a fenced `yaml artifact-envelope` containing the Schema-5 `work-plan`, never a generic `text` fence. Intent, Acceptance, Boundaries, and Risks may use fitting prose, lists, or tables rather than padding fixed tables.

## Parent-model affinity

The Cursor-selected primary owns **Implement Plan**. Subagents inherit its model by default; Cursor Tasks omit overrides or use `inherit`. Observed Children must match the parent or a configured Manual approved candidate. Plugin agents use `model: inherit`. The primary integrates results and closeout.

The final closeout todo starts with `[workflow-model-inherit-v1]` and carries typed `workflow_attestation` metadata. Earlier STEP todos may omit the marker. These internal fields belong only to the Plan wrapper, never the closed Root or `extensions`.

For `replan`, preserve confirmed decisions unless reopened by the source review. Create a fresh Root ID with exact `predecessor_plan_id` and `replan_source_review_id`; the predecessor stays immutable and the replacement needs native human approval.

Ready Schema-5 Manual Roots keep the closed authority envelope. Present Verification as an explicit table with Check columns: `Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites`. Other sections stay semantic: Objectives and Acceptance evidence may be compact tables or lists; Steps may live only as native `STEP-*` todos. Compact/full nests [Design depth](design-contract.md) H3 tables when that contract applies. Unmarked closeout or missing `STEP-*` todos fail; aliases are input tolerance only. The host guard validates the exact Root locally; standalone `workflow_plan_preflight` is optional compatibility transport. End with one human-readable closeout todo such as `[workflow-model-inherit-v1] Verify checks and close out delivery.` plus exact todo metadata `workflow_attestation: { schema: 1, kind: plan-closeout, action: delivery-closeout }` before human **Implement Plan**. Legacy `action: workflow_closeout` remains accepted. Do not put free-form closeout ceremony in the visible todo text.

## Codex proposed_plan

Codex returns `<proposed_plan>` with the exact Schema-5 Root and one typed plan-closeout attestation in `## Final implementation step`; see [closeout](./closeout-contract.md).
