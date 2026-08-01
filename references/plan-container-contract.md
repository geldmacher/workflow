Cursor owns native Plan UI and capabilities. Emit one H1, then a fenced `yaml artifact-envelope` containing the Schema-5 `work-plan`, never a generic `text` fence. Intent, Acceptance, Boundaries, and Risks may use fitting prose, lists, or tables.

## Parent-model affinity

The Cursor-selected primary owns **Implement Plan**. Subagents inherit its model; omit Task overrides. Plugin agents use `model: inherit`. The primary integrates results and closeout. Workflow selects no model.

Every native todo, including each `STEP-*` and closeout, starts with `[workflow-model-inherit-v1]`. This internal marker belongs only to the Plan wrapper, never the closed Root or `extensions`.

For `replan`, preserve confirmed decisions unless reopened by the source review. Create a fresh Root ID with exact `predecessor_plan_id` and `replan_source_review_id`; the predecessor stays immutable and the replacement needs native human approval.

Ready plans use these table columns:

- Intent: `Readiness item | Resolution | Evidence`, plus `Decision ID | Choice | Rationale | Rejected alternative | Source` or `None.`
- Objectives: `Objective ID | Observable outcome | Acceptance evidence`.
- Baseline: `Evidence ID | Kind | Observation | Source`, including `repository`.
- Scope: `Category | Targets | Boundary`, with lower-case `required`, `permitted`, `prohibited`.
- Steps: `Step ID | Objectives | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action`.
- Verification: `Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites`; Checks only, with PROBEs in Steps. Every Check requires an Evidence Class.
- Operations: `Concern | Requirement | Repository proof`; non-runtime uses one `Not applicable` row.
- Risk: `Factor | Score | Evidence`; controls may be `None.` when optional.

Compact/full output adds [Design depth](design-contract.md) H3 tables inside the existing eight H2s. Numbered H2s, bullets, shortened tables, unmarked todos, or missing `STEP-*` todos fail the pre-`CreatePlan` check. Aliases are input tolerance only. Finish with one marked closeout todo that collects observations, calls `workflow_closeout`, and prints its artifact unchanged. Closeout belongs to **Implement Plan**, not another command or repository artifact.
