---
name: work-automation
description: Operate adaptive supervised and certified autonomous Workflow runs.
---

Use bundled `workflow_*` MCP tools; never hand-edit controller state, worktrees, receipts, ledgers, or locks. Load only the invoked Command's contract:

- `/auto-work`: [Preparation and Intent approval](../../references/automation-preparation-contract.md)
- `/work-status` or `/work-watch`: [derived state](../../references/state-contract.md)
- `/work-control`: [derived state](../../references/state-contract.md) and [adaptive authorization](../../references/automation-contract.md)
- `/work-models`: [model pools](../../references/model-routing-contract.md)
- `/work-verification`: [Verification Profiles](../../references/verification-profile-contract.md)

Before mutation, read fresh status and use its revision plus a unique idempotency key. `waiting-human`, incompatibility, and rejection never grant permission. Automatic adaptation may change strategy only inside the approved authority envelope. Keep delivery on the local Run branch; never push, PR, merge, deploy, integrate, or learn automatically.

For manual `/work-status wp-*`, send exact current-task artifacts. Never infer approval, execution, repository state, or evidence. Missing artifacts wait; invalid chains replan; corrections remain human-authorized. Workflow-3 documents are status-only history.
