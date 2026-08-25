---
name: work-planning
description: Create an intent-ready Schema-6 Workflow root.
---

Plan in the host's native planning mode. `replan [wp-*]` requires an exact current Schema-6 Root and unique `next_action: replan` review tip. Reject every unsupported artifact schema.

## Intent interview

Optimize for Intent Readiness. Ask only about material outcomes, scope, behavior, authority, risk, or acceptance. Emit no Root while a decision that changes the authorization envelope remains open.

## Root planning

Read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), and [design](../../references/design-contract.md) completely. Preserve decisions in one immutable Schema-6 Intent Root.

Render `Quick decision` → `Details` → `Agent and machine contract (authoritative)`. The authoritative Root is one closed `yaml artifact-envelope` followed by required Markdown sections.

Define goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Each objective needs a falsifiable verification intent. The Verification table contains only `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`.

Never add a command, working directory, tool, model, sandbox, worktree, route, retry, or task recipe. The project harness owns every concrete execution choice. Do not evaluate whether any program or wrapper is appropriate.

The host guard validates the exact Root but grants no approval. `workflow_plan_preflight` is optional transport. A replan creates a fresh `wp-*` with exact predecessor and review binding plus renewed human approval. Caches and handoff never grant authority. `extensions` is opaque trace only.

Use the native Plan as container. Implementation still requires explicit human selection. Do not add closeout or Evidence execution steps. End with `### Next step`.
