---
artifact: work-plan
schema: 6
id: wp-adaptive-retry
status: ready
intent_ready: true
profile_max: manual
contract_level: lean
risk: medium
hard_triggers: []
goal: Make transient retry behavior deterministic and observable.
acceptance:
  - Retry behavior is deterministic and repository validation remains consistent.
non_goals:
  - No deployment or external publication.
constraints:
  - Preserve the public API.
authority:
  allowed_roots:
    - src
    - tests
  protected_paths:
    - .git
  approval_required_paths: []
  dependencies: deny
  external_effects: none
  delivery: repository-only
---

## Intent

Make transient retry behavior deterministic and observable without expanding repository authority.

## Acceptance

Retry behavior is deterministic and repository validation remains consistent.

### Verification

| Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|
| CHECK-1 | OBJ-1 | Prove retry behavior and repository consistency with project-appropriate verification. | Protected evidence showing the acceptance outcome on the current repository snapshot. | yes | harness-verifiable | standard | Relevant implementation and test surfaces are available. |

## Boundaries

Only the declared repository roots may change. Deployment, publication, and external effects are excluded.

## Risks

Incorrect retry boundaries could mask a transient failure; fresh bound evidence must keep that uncertainty visible.
