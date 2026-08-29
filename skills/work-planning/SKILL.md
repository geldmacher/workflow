---
name: work-planning
description: Create an intent-ready Schema-6 Workflow root.
---

Plan in the native mode. `replan [wp-*]` requires the exact current Schema-6 Root and unique `next_action: replan` tip. Reject unsupported schemas.

## Intent interview

Ask only about material outcome, scope, behavior, authority, risk, or acceptance. Emit no Root while its authority envelope remains open.

## Root planning

Read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), and [design](../../references/design-contract.md). Preserve decisions in one immutable Schema-6 Intent Root.

Render `Quick decision` → `Details` → `Agent and machine contract (authoritative)`: one closed `yaml artifact-envelope` plus required Markdown sections.

Define goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Give each objective falsifiable verification intent. Verification columns are only `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`.

Never add or judge commands, directories, tools, models, sandboxes, worktrees, routes, retries, or recipes; the harness owns them.

Pass `presentation_locale: de` only for an active German request, otherwise `en`, and run local `validate-plan` on the exact Root. Require feasible output with the same ID. Decorate only its derived `implement-plan` as **Implement Plan** or `correct-plan` as Plan revision. Validation creates no artifact, MCP call, or approval. Replan needs a fresh `wp-*`, exact predecessor/review binding, and renewed approval; cache and handoff grant none.

Use the native Plan container. Add no closeout or Evidence steps. End with `### Next step`: state Root readiness, one concrete reason, and exactly one action: **Implement Plan**. Never claim phase, delivery, or Workflow completion or add a Review action.
