# Create a project verifier

Use this reference for an explicitly accepted creation assignment or to prepare that proposal during read-only planning. The [shared verification guidance](../../../references/verification-work.md) governs authority, trial timing, and evidence boundaries.

## Ground the verifier in the repository

Identify the agreed user-facing surface and features, local setup and launch commands, readiness signals, ports, environment, seed data, and authentication. Find existing ways to drive it: browser tests, CLI or PTY helpers, HTTP endpoints, or another maintained harness. Reuse those before adding helpers. Choose stable selectors, commands, and routes from actual source and docs. Ask only for consequential facts the repository cannot establish.

Determine what can show actions, outcomes, and side effects: screenshots, terminal transcripts, responses, logs, exit codes, files, or data state. Identify isolation through ports, data directories, profiles, and owned processes. If safe isolation is unavailable, report the constraint rather than driving a shared instance concurrently. Do not invent setup against a broken base; resolve startup problems only within the product assignment or report the blocker. Product changes planned in the same assignment can finish before the closing trial.

## Write for an executor arriving without prior context

Create the agreed directory with `SKILL.md`, including the host-required `name` and a description identifying the surface and when to use it. Link `features/README.md` from the skill and create one indexed file per agreed feature. Each feature explains its purpose, relevant sub-features, user entry points, concrete driving recipe, observable expected outcome, prerequisites, and gotchas. Cover the agreed meaningful features and name what remains uncovered; do not invent an exhaustive map. Headings can follow the product's conventions.

The skill must make these operations actionable:

- **Launch:** setup, exact start or build commands, readiness signals, and teardown. For short-lived CLIs, build once and use an isolated session per drive instead of assuming a persistent server.
- **Doctor:** read-only checks of instance health, expected build, ownership, and access before driving. Check again after a failure or surprise; reset an unhealthy UI state even when the process still looks healthy.
- **Drive:** use the actual user path and stable repository-derived handles. Internal setters or test-only shortcuts do not establish the user journey.
- **Evidence:** capture the action and resulting state, plus relevant side effects. Name the evidence location. Use safe external boundaries and observe their effects; a mode called dry-run may still touch the network or files.
- **Isolation and cleanup:** track resources created by this exercise; remove only those, including residue after failed attempts. Never kill by process name. Preserve evidence and check its existence after cleanup.
- **Helpers, when needed:** keep them within the authorized verifier directory, executable, and document their invocation. Do not add a generic verification framework.

Existing suitable verifiers should be reused or proposed for maintenance rather than duplicated to obtain this structure.

## Prove the combined result at implementation close

Once the planned product and verifier changes are ready, follow the generated instructions end to end: launch, doctor, drive at least one acceptance-relevant mapped feature, capture observations, and clean up. Other necessary plan acceptance checks still apply. Confirm the saved evidence survives cleanup. A failed attempt also requires cleanup of its owned residue; fix only within the authorized assignment and re-drive affected behavior after corrections.

Report created paths, mapped and exercised features, observed outcomes, retained evidence, and uncovered or blocked behavior on the resulting working state. An unexecuted verifier is an untested result, not successful verification. Hand over for standalone or delegated Auto-Work Review of its fit to the plan and implementation.
