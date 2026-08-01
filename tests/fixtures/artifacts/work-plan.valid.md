---
artifact: work-plan
schema: 5
id: wp-adaptive-retry
status: ready
intent_ready: true
profile_max: supervised
contract_level: controlled
risk: medium
hard_triggers: []
goal: Make retry handling deterministic without changing the public contract.
acceptance:
  - Retry handling passes its repository verification path twice.
non_goals:
  - No deployment or external service change.
constraints:
  - Preserve the public API.
authority:
  allowed_roots:
    - src
    - tests
  protected_paths:
    - .git
    - .cursor/workflow-policy.yaml
  approval_required_paths: []
  dependencies: deny
  external_effects: none
  delivery: repository-only
  max_active_minutes: 30
  max_total_tokens: 50000
  max_cost_usd: 5
---

## Intent

Make retry handling deterministic on the current repository surface.

## Acceptance

The retry verification path passes twice and the public API remains stable.

### Verification

| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|---|
| CHECK-1 | OBJ-1 | repository root | npm test | Retry verification passes twice | yes | machine-verifiable | standard | src, tests |

## Boundaries

Only repository delivery under `src` and `tests` is authorized. External effects are forbidden.

## Risks

The main risk is an accidental public-contract regression; preserve and verify that contract.
