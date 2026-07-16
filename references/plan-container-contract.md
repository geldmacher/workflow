Cursor owns native Plan UI and capabilities. Generate canonical form: one H1, then a fenced `yaml artifact-envelope` containing the schema-2 `work-plan`; never use a generic `text` fence. Use the eight exact, unnumbered H2 names from the Planning skill.

Ready plans use these table columns:

- Intent: `Readiness item | Resolution | Evidence`, plus `Decision ID | Choice | Rationale | Rejected alternative | Source` or `None.`
- Objectives: `Objective ID | Observable outcome | Acceptance evidence`.
- Baseline: `Evidence ID | Kind | Observation | Source`, including `repository`.
- Scope: `Category | Targets | Boundary`, with lower-case `required`, `permitted`, `prohibited`.
- Steps: `Step ID | Objectives | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action`.
- Verification: `Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Cost Class | Prerequisites`; Checks only, with PROBEs in Steps.
- Operations: `Concern | Requirement | Repository proof`; non-runtime uses one `Not applicable` row.
- Risk: `Factor | Score | Evidence`; controls may be `None.` when optional.

Numbered H2s, bullets, shortened tables, Verification PROBEs, or native todos without every `STEP-*` fail the pre-`CreatePlan` self-check. Aliases are input tolerance only. Finish todos with verification/evidence; after implementation return full `delivery-evidence` for every root Objective and required Check. No extra execution command or repository artifact file.
