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

Never add or judge commands, working directories, tools, models, sandboxes, worktrees, routes, retries, or task recipes. The project harness owns them.

For multi-phase outcomes, encode prerequisites and falsifiable phase outcomes as verification intent, never implementation steps or harness sequences.

Before presenting the Root, run local `validate-plan` on its exact bytes and require a feasible result with the same Root ID. Validation creates no artifact, makes no MCP call, and grants no approval. Replan needs a fresh `wp-*`, exact predecessor/review binding, and renewed approval. Cache and handoff grant no authority; `extensions` is opaque.

Use the native Plan as container. Implementation still requires explicit human selection. Do not add closeout or Evidence execution steps. End with `### Next step`.
