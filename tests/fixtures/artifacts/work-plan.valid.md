---
name: Configurable retry multiplier
overview: Add a bounded retry multiplier while preserving existing retry behavior and repository-only delivery.
todos:
  - id: refresh-state
    content: "STEP-1: Refresh HEAD, dirty files, known failures, targets, prerequisites, and baseline; classify completion before editing."
    status: pending
  - id: implement-multiplier
    content: "STEP-2: Implement and verify the bounded retry multiplier within the approved targets."
    status: pending
  - id: closeout-evidence
    content: "After the final change verify every required root Check, capture the final repository snapshot, and emit one schema-3 delivery-evidence artifact; perform no later repository write and require no further Workflow command."
    status: pending
isProject: true
---
# Configurable retry multiplier
```yaml artifact-envelope
artifact: work-plan
schema: 3
id: wp-20260712T150503Z-configurable-retry-multiplier
status: ready
intent_ready: true
decision_boundary: repository-delivery
design_depth: oneshot
automation_profile_max: manual
writer_tier_required: economy
runtime_relevant: true
risk: medium
assurance_score: 4
assurance_profile: standard
assurance_override: none
assurance_override_decision_id: null
hard_triggers: []
```
## Intent and decisions
| Readiness item | Resolution | Evidence |
|---|---|---|
| Goal | Add a bounded configurable retry multiplier. | User request and repository behavior. |
| Actor | Application operators configuring retry behavior. | Environment-based configuration API. |
| Outcome | Valid values are honored and invalid values use the default without regressions. | Root objectives and required Checks. |
| Non-goals | No retry subsystem redesign, deployment, or production access. | Scope and repository boundary. |
| Constraints | Preserve defaults, accept only 1 through 10, and retain user changes. | User intent and repository baseline. |
| Repository boundary | Delivery ends with repository code, tests, and evidence. | decision_boundary and closeout. |
| Acceptance evidence | Required automated tests and diff inspection pass. | CHECK-1 and CHECK-2. |
| Critical assumptions | Existing environment parsing pattern remains authoritative. | Repository inspection. |
| Operational impact | Runtime configuration parsing changes locally and remains reversible. | Operational readiness rows. |
| Review risk | Medium because exported runtime behavior changes compatibly. | Risk classification. |
| Material open decisions | None. | Intent Readiness completed. |

| Decision ID | Choice | Rationale | Rejected alternative | Source |
|---|---|---|---|---|
| DEC-1 | Add one bounded environment-controlled multiplier. | It satisfies the requested behavior without changing unrelated retry defaults. | Redesign the retry subsystem. | Repository inspection and user intent. |
| DEC-2 | End delivery at repository evidence. | Deployment and production observation are outside the approved boundary. | Claim production readiness from local tests. | Workflow constraint. |
## Objectives
| Objective ID | Observable outcome | Acceptance evidence |
|---|---|---|
| OBJ-1 | Valid APP_RETRY_MULTIPLIER values from 1 through 10 are returned and invalid values fall back to 2. | Focused automated tests pass. |
| OBJ-2 | Existing retry limit and delay behavior remains unchanged and operational limits are documented by code and tests. | Full retry test suite passes and diff stays in scope. |
## Evidence and baseline
| Evidence ID | Kind | Observation | Source |
|---|---|---|---|
| EVID-1 | repository | Node ESM module with node:test coverage. | package.json and test directory. |
| EVID-2 | head | main at the captured planning commit. | git rev-parse HEAD. |
| EVID-3 | dirty-files | retry policy and its test may contain user changes that must be preserved. | git status --short. |
| EVID-4 | known-failures | No failing baseline tests observed. | npm test. |
| EVID-5 | targets-and-prerequisites | The retry module and focused test are sufficient; Node is available. | Repository inspection. |
## Scope and targets
Keep changes inside src/retry-policy.js and test/retry-policy.test.js.

| Category | Targets | Boundary |
|---|---|---|
| required | `src/retry-policy.js`, `test/retry-policy.test.js` | Implement behavior and focused tests. |
| permitted | `src/retry-policy.js`, `test/retry-policy.test.js` | Preserve existing user edits while completing the objective. |
| incidental | No incidental targets. | Formatting only inside required targets. |
| prohibited | all other files | No unrelated edits, publishing, deployment, or production access. |
## Execution steps
| Step ID | Objectives | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action |
|---|---|---|---|---|---|---|---|
| STEP-1 | OBJ-1, OBJ-2 | `src/retry-policy.js`, `test/retry-policy.test.js` | Refresh and classify the repository state before edits. | Use read-only Git and focused test inspection. | PROBE-1: baseline, dirty files, and focused test status are recorded. | CHECK-1 | Stop on conflicting user changes or stale assumptions. |
| STEP-2 | OBJ-1, OBJ-2 | `src/retry-policy.js`, `test/retry-policy.test.js` | Implement bounded parsing and complete focused coverage without regressions. | Choose concise code consistent with existing parsing helpers. | PROBE-2: exported behavior and boundary tests exist and pass. | CHECK-1, CHECK-2 | Stop if public API or additional targets are required. |
## Verification
Run the retry policy test suite from the repository root.

| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|---|
| CHECK-2 | OBJ-2 | repository root | npm run test:retry-regression | Existing retry limit and delay tests pass. | yes | machine-verifiable | cheap | `src/retry-policy.js`, `package.json` |
| CHECK-1 | OBJ-1 | repository root | npm test | All retry multiplier tests pass. | yes | machine-verifiable | standard | `src/retry-policy.js`, `test/retry-policy.test.js`, `package.json` |
## Operational readiness
| Concern | Requirement | Repository proof |
|---|---|---|
| Observable signal | Invalid values deterministically use the documented default. | Boundary tests inspect returned values. |
| Failure condition | Values outside 1 through 10 or malformed input are rejected. | Negative test matrix. |
| Recovery or rollback | Remove the multiplier helper and its focused tests without data migration. | Localized diff in two targets. |
## Risk and closeout
Stop when runtime behavior or public API scope expands beyond the root plan.

Stop when required repository evidence is unavailable.

### Classification
Medium because a compatible exported runtime helper is added.

| Factor | Score | Evidence |
|---|---|---|
| Failure impact | 2 | Incorrect retry parsing can alter bounded runtime behavior. |
| Irreversibility | 0 | The localized code and tests are directly reversible. |
| Uncertainty | 1 | One environment boundary remains implementation-sensitive. |
| Evidence weakness | 0 | Focused and full automated checks are available. |
| Change surface | 1 | Runtime source and its test change together. |

| Control ID | Control | Objective or failure mode | Expected benefit | Cost class | Decision | Rationale |
|---|---|---|---|---|---|---|
| CTRL-1 | Run diff inspection and the complete retry test suite. | OBJ-1, OBJ-2 regression or scope error | High-confidence repository proof at moderate cost. | standard | include | It directly decides both root outcomes. |
| CTRL-2 | Independent delivery audit on every clean review. | Residual low-probability interpretation error | Small additional confidence after complete Checks. | expensive | defer | Progressive review will invoke it only on a concrete trigger. |
### Approval gates
Native Implement Plan approves only this immutable wp-* root plan.
### Deviation policy
Record in-scope deviations; stop before scope or risk expansion.
### Stop conditions
Stop on conflict, unavailable required checks, new public behavior, or production access.
### Closeout
Return schema-3 delivery evidence; no merge, push, PR, deployment, production access, or correction command is part of initial implementation.
