---
name: plan-work
description: Create a human-authorized Schema-5 Workflow plan in Codex Plan mode. Use when the user invokes $plan-work or asks for a Workflow implementation plan.
---

# $plan-work

Operate only in Codex Plan mode. If Plan mode is not active, stop and ask the user to switch modes; do not draft a Root.

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [executable contract](../../references/executable-contract.md), [design contract](../../references/design-contract.md), [plan container](../../references/plan-container-contract.md), and [closeout](../../references/closeout-contract.md) completely.

Clarify only decisions that materially change outcome, scope, authority, public behavior, data/security, risk, or acceptance. Inspect read-only. Built-in subagents are optional for bounded research and must receive `[workflow-model-inherit-v1]`. Without Manual subagent policy, omit model, provider, and reasoning overrides; with a configured Codex ordered policy, allow only Workflow-selected approved candidates or parent fallback.

Create one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID and cheapest sufficient required Checks. Put its explicit `### Verification` table directly inside `## Acceptance`, before the next H2 section; a table placed after Interfaces, Boundaries, Risks, or other H2 content is not canonical Root Verification and fails preflight. Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests and scanners stay optional, never a checklist. Native Stop validation runs the same local Schema-5/preflight semantics as Cursor CreatePlan for every Manual risk level; a `wp-*` ID alone never authorizes presentation. Standalone `workflow_plan_preflight` remains optional compatibility transport. When it runs, pass the exact Root; it cannot override local validation or authorize a different Root. Handoff `workflow_artifact_record` is optional best-effort transport. Neither call grants implementation approval.

Return one native `<proposed_plan>` containing the exact Schema-5 Root text and its visible `wp-*` ID. Its `## Final implementation step` must include one unindented typed attestation fence and no free-form closeout marker prose:

```yaml workflow-attestation
schema: 1
kind: plan-closeout
action: delivery-closeout
```

Legacy `action: workflow_closeout` remains accepted. Lead with outcome, checks, and gaps before technical detail. End with `### Next step` (Now/How/Why; Off track if blocked): ready → **Implement Plan**; else `$plan-work` recovery. Do not implement. Implementation begins only through the user's separate **Implement Plan** action.
