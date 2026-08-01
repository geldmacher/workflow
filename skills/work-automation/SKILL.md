---
name: work-automation
description: Operate adaptive supervised and certified autonomous Workflow runs.
---

Use bundled `workflow_*` MCP tools; never hand-edit controller state, worktrees, receipts, ledgers, or locks. Load only the invoked Command's contract:

- `/auto-work`: [Preparation and Intent approval](../../references/automation-preparation-contract.md)
- `/work-status` or `/work-watch`: [derived state](../../references/state-contract.md)
- `/accept-work`: [derived state](../../references/state-contract.md)
- `/work-control`: [derived state](../../references/state-contract.md) and [adaptive authorization](../../references/automation-contract.md)
- `/work-models`: [model pools](../../references/model-routing-contract.md)
- `/work-verification`: [Verification Profiles](../../references/verification-profile-contract.md)

Before mutation, read fresh status and use its revision plus a unique idempotency key. `waiting-human`, incompatibility, and rejection never grant permission. Automatic adaptation may change strategy only inside the approved authority envelope. Keep delivery on the local Run branch; never push, PR, merge, deploy, integrate, or learn automatically.

When `/auto-work` supplies a replan Root, pass its exact current predecessor/review chain as `root_artifacts`; missing, stale, foreign, branched, or ambiguous lineage stops Preparation.

For Manual `/work-status [wp-*]` and `/accept-work [wp-*] provisional`, send exact current-task artifacts; omit `root_plan_id` only to resolve their unique active lineage tip. Never infer approval, execution, repository state, or evidence. Missing/ambiguous artifacts wait; invalid chains replan; corrections remain human-authorized. `/accept-work` passes `manual_acceptance: provisional` only for that explicit command and never persists the snapshot. Workflow-3/4 documents are status-only history.
