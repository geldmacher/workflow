---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Omit model overrides; Children match the parent or a Manual approved candidate. `replan [wp-*]` needs an active Schema-5 Root and unique `next_action: replan`; otherwise require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only about material outcome, scope, behavior, security, risk, or acceptance. Replan reopens only review findings.

Before answers load no contracts; do only decision-independent research. Without the question tool ask one blocker. Emit no plan or draft before the answer; skip when intent is clear.

## Root Planning

Once ready, read [runtime output](../../references/human-output-runtime-contract.md), [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), and [adaptive design](../../references/design-contract.md) completely. Preserve material answers in one immutable Schema-5 Intent Root; Workflow-3/4 remains read-only.

Check goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Give each objective its cheapest sufficient falsifiable Check. Shell Checks inspect wrappers and pre/post hooks; Review must not write repository content. Mutations stay in implementation; insufficient read-only proof makes the Root infeasible. Merge duplicates; use `expensive` only without a cheaper equivalent; backtick path targets.

Put `### Verification` directly inside `## Acceptance`, before its next H2; else preflight fails.

Consider correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests/scanners stay optional, never a six-item checklist.

The host guard validates the exact Root but grants no approval. `workflow_plan_preflight` is optional transport; MCP preferences claim no approval.

A replan creates a fresh `wp-*`, exact predecessor/review bindings, and renewed human **Implement Plan** approval. Never reconstruct authority from host state, caches, or another task. Do not invent `extensions`; they are opaque audit metadata, never model context or authority. Keep Strategy outcome-oriented and budgets proportional.

Use native Plan as the sole plan container; follow runtime order. Put sole `### Next step` in `Quick decision`, exact `### Completion handoff` before Root. Root supplies targets/dependencies/probes, Check context, boundaries, stop/replan; no JSON copy. Todos only implementation/Checks—no closeout, attestation, Evidence, artifact-record. For blocked Roots put `Meaning:` and the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#intent-root-and-plan) before final layer.
