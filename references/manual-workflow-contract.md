# Manual Workflow Contract

This contract is host-neutral. A host facade may translate command syntax and native plan containers, but it must preserve the same Schema-5 artifact text, IDs, hashes, chain rules, status derivation, and closeout semantics.

## Authority

- The human authorizes planning, implementation, correction, review, acceptance, and learning as separate actions.
- Manual Workflow never starts controller automation, merges, pushes, publishes, deploys, or selects a concrete child model.
- Subagents are optional role helpers. They inherit the parent model and their output is advisory until the primary agent verifies and records it.
- Review is read-only. A proven gap requires a separate correction or implementation action.

## Artifact flow

1. Planning creates one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID.
2. The exact Root passes `workflow_plan_preflight` and is recorded with `workflow_artifact_record` before presentation.
3. The host presents its native plan container. Its final implementation step calls `workflow_closeout`.
4. Implementation observes every required Check and creates one `delivery-evidence` artifact with a `de-*` ID.
5. A fresh review task validates the exact Root/Evidence chain and records one `work-review` artifact with a `wr-*` ID.
6. Status is derived from the exact current-task artifact chain. The shared handoff cache is transport only and never grants authority.

Artifact text remains host-neutral and immutable. Host provenance belongs only in store or migration metadata.

## Roles

- Planner: read-only discovery, intent interview, Schema-5 Root construction, preflight, and native plan presentation.
- Primary implementer: executes only the approved Root, collects direct Check observations, and performs closeout.
- Delivery auditor: read-only comparison of changed code and evidence against acceptance and required Checks.
- Risk auditor: read-only inspection of material safety, security, data, and irreversible-operation risks.
- Design auditor: read-only inspection of architecture and public-contract fit.
- Explainer: read-only explanation of behavior and boundaries.

Role helpers receive the exact Root/chain, a bounded question, the marker `[workflow-model-inherit-v1]`, and no concrete model or provider override.

## Failure boundary

- Invalid, ambiguous, conflicting, Schema-3/4, or incomplete chains stop the action.
- Unavailable cache transport does not invalidate exact artifacts already present in the task; they must be attached explicitly.
- Unattested or model-divergent subagent output is not evidence.
- Missing preflight blocks plan completion. Missing closeout blocks implementation completion.
