---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Omit model overrides or use `inherit`; Children match the parent or a Manual approved candidate. `replan [wp-*]` requires an active Schema-5 Root and unique `next_action: replan` review tip; otherwise no Root—require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only about material outcome, scope, behavior, security, risk, or acceptance. Replan reopens only review findings.

Before answers, load no contracts and do only decision-independent research. Without the question tool ask one blocker. Emit no plan or draft before the answer; skip the interview when intent is clear.

## Root Planning

Once ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), and [adaptive design](../../references/design-contract.md) completely. Preserve material answers in one immutable Schema-5 Intent Root; Workflow-3/4 remains read-only.

Render once as `Quick decision` → `Details` → `Agent and machine contract (authoritative)`. Summarize approach, rationale, scope, Verification, limits, and one host-native **Implement Plan** action; put the sole exact Root last and resolve conflicts first.

Check goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Each objective needs its cheapest sufficient falsifiable required Check. For shell Checks inspect wrappers and pre/post hooks; allow one classifiable command in its canonical repository directory, optionally wrapped once by `rtk`. Reject mutation, shell composition or environment prefixes, output-writing Git/search options, altered test targets, and absent npm scripts. Review must not write repository content. Keep mutations in implementation; insufficient read-only proof makes the Root infeasible. Merge duplicates, use `expensive` only when essential, and backtick path targets.

Put every new Root's explicit `### Verification` table directly inside `## Acceptance`, before its next H2; any later placement fails preflight.

Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests/scanners stay optional, never a six-item checklist.

The host guard validates the exact Root but grants no approval. `workflow_plan_preflight` is optional transport. MCP: `strict` expects prompts; `allowlisted` expects a host allowlist and claims no approval.

A replan creates a fresh `wp-*` with exact current-task predecessor/review bindings and renewed host-native **Implement Plan** approval, which Workflow does not attest. Never reconstruct authority from host state, caches, or another task. Do not invent `extensions`; they are opaque audit metadata, never model context or authority. Keep Strategy outcome-oriented, repository-only, and proportional.

Use Cursor's native Plan as the sole plan container. Native todos describe implementation and planned checks only; add no closeout todo, `workflow_attestation`, Evidence step, or artifact-record step. Unresolved Intent or infeasible Roots add `Meaning:` plus the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#intent-root-and-plan) before `### Next step`.
