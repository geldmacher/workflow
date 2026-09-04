# Project verifier template

Use this template only after the Project verification contract authorizes Create or Maintenance. Replace every marker with a repository-grounded value; a materialized verifier must contain no `{{...}}` marker.

```markdown
---
name: verify-{{SURFACE_SLUG}}
description: Verify the local {{SURFACE_NAME}} behavior when work changes {{DISCOVERY_SCOPE}}.
---

# Verify {{SURFACE_NAME}}

Operate only on the local or explicitly authorized test surface. Read `features/README.md` and select the smallest feature set that covers the current task.

## Launch

Launch command: `{{LAUNCH_COMMAND}}`

Record every resource identifier created by this run. Reuse an already healthy developer-owned instance only when the project harness documents that behavior.

## Doctor

Doctor command: `{{DOCTOR_COMMAND}}`

Confirm prerequisites and the exact target without mutating product state. A broken baseline stops the verifier unless the active task separately authorizes the product repair.

## Drive

Drive command: `{{DRIVE_COMMAND}}`

Drive the selected feature through its user-observable path and compare the result with its oracle. Do not weaken the oracle to accept a product regression.

## Evidence

Evidence root: `{{EVIDENCE_ROOT}}`

Store current-run observations outside the repository or in this project's established ignored evidence location. Include the surface, feature ID, repository snapshot, observed result, and limitations. Raw output is not a Workflow evidence grade.

## Cleanup

Cleanup command: `{{CLEANUP_COMMAND}}`

Stop or remove only resources whose identifiers were captured by this run. Preserve evidence and developer-owned resources.

## Isolation

Use `{{ISOLATION_BOUNDARY}}`. Never target production or perform an irreversible external effect without separate authority.

## Helpers

Use only these project-owned helpers: {{HELPERS}}.
```

Materialize `features/README.md` with this shape:

```markdown
# {{SURFACE_NAME}} feature map

Coverage boundary: {{COVERAGE_BOUNDARY}}

| Feature ID | User-observable goal | Setup | Drive | Oracle | Evidence | Cleanup |
|---|---|---|---|---|---|---|
| {{FEATURE_ID}} | {{USER_GOAL}} | {{SETUP}} | {{DRIVE_PATH}} | {{ORACLE}} | {{FEATURE_EVIDENCE}} | {{FEATURE_CLEANUP}} |
```

Initial Create must contain one to five concrete feature rows. Default Maintenance touches only rows affected by the current Root or repository delta; `maintain full` evaluates every row.
