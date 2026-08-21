---
name: plan-work
description: Create a human-authorized Schema-5 Workflow plan in Codex Plan mode. Use when the user invokes $plan-work or asks for a Workflow implementation plan.
---

# $plan-work

Operate only in Codex Plan mode. If Plan mode is not active, stop and ask the user to switch modes; do not draft a Root.

Read [Manual Workflow](../../references/manual-workflow-contract.md), [human-first output](../../references/human-output-contract.md), [artifact protocol](../../references/artifact-protocol.md), [executable contract](../../references/executable-contract.md), [design contract](../../references/design-contract.md), and [plan container](../../references/plan-container-contract.md) completely.

Clarify only decisions that materially change outcome, scope, authority, public behavior, data/security, risk, or acceptance. Inspect read-only. Built-in subagents are optional for bounded research and must receive `[workflow-model-inherit-v1]`. Without Manual subagent policy, omit model, provider, and reasoning overrides; with a configured Codex ordered policy, allow only Workflow-selected approved candidates or parent fallback.

Create one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID and cheapest sufficient required Checks. Inspect each shell command's complete wrapper and pre/post lifecycle-hook chain. Required Verification must not write repository content during fresh read-only Review; keep mutating commands in implementation, and do not present a ready Root without sufficient read-only proof. Put its explicit `### Verification` table directly inside `## Acceptance`, before the next H2 section; a table placed after Interfaces, Boundaries, Risks, or other H2 content is not canonical Root Verification and fails validation. Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests and scanners stay optional, never a checklist. Native Stop validation checks the exact Root for every Manual risk level; a `wp-*` ID alone never authorizes presentation. Do not call preflight or artifact-record transport on the native happy path.

Return one native `<proposed_plan>` in exactly three visible layers: `Quick decision`; complete human `Details`; then the final authoritative `Agent and machine contract` containing the exact Schema-5 Root text and visible `wp-*` ID. Put `### Next step` (Now/How/Why; Off track if blocked) in `Quick decision`: ready → **Implement Plan**; else `$plan-work` recovery. The human layers must translate every decision-relevant goal, approach, scope, non-goal, constraint, acceptance item, Check meaning, risk, trade-off, gap, and uncertainty from the same Root without adding authority.

Mark the last layer for the implementing agent: human layers are oversight projections and only the exact Root grants authority. Immediately before it add the plan-container's exact `### Completion handoff`, carrying the post-implementation three-layer reply and fresh human Review action without Evidence/Review/Learning claims. Make the Root self-contained for a weaker capable agent with compact deterministic YAML/tables, ordered dependencies, targets/symbols, probes, exact Checks with directories/expectations, boundaries, and stop/clarify/replan conditions. Never rely on "as above" or duplicate the Root as JSON. Native steps and Checks belong in that Plan; add no closeout, attestation, Evidence step, artifact-record, or independent storage. Do not implement; only the user's separate **Implement Plan** starts it.
