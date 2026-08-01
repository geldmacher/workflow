---
name: work-automation
description: Operate adaptive supervised and certified autonomous Workflow runs.
---

Use bundled `workflow_*` MCP tools; do not hand-edit state, worktrees, receipts, ledgers, or locks. Load only the invoked Command's contract:

- `/auto-work`: [Preparation and Intent approval](../../references/automation-preparation-contract.md)
- `/work-status` or `/work-watch`: [derived state](../../references/state-contract.md)
- `/accept-work`: [derived state](../../references/state-contract.md)
- `/work-control`: [derived state](../../references/state-contract.md) and [adaptive authorization](../../references/automation-contract.md)
- `/work-models`: [model pools](../../references/model-routing-contract.md)
- `/work-verification`: [Verification Profiles](../../references/verification-profile-contract.md)

Before mutation, read fresh status; use its revision and a unique idempotency key. Waiting, incompatibility, or rejection grants nothing. Adapt Strategy only inside approved authority. Keep delivery local; never push, PR, merge, deploy, integrate, or learn automatically.

For an `/auto-work` replan, pass its exact predecessor/review chain as `root_artifacts`; invalid lineage stops.

For Manual status or provisional acceptance, send exact current-task artifacts; omit `root_plan_id` only to resolve their unique active lineage tip. Never infer approval, state, or evidence. Missing or ambiguous artifacts wait; invalid chains replan; corrections stay human-authorized. Pass `manual_acceptance: provisional` only for explicit `/accept-work`; never persist it. Workflow-3/4 is status-only history.
