---
name: work-automation
description: Operate controlled Workflow Preparations and Runs.
---

Use only bundled `workflow_*` MCP tools; never hand-edit controller state, worktrees, receipts, stores, events, or locks. Load only the invoked Command's contract:

- `/auto-work`: [Auto-Planning and Root approval](../../references/automation-preparation-contract.md)
- `/work-status` or `/work-watch`: [derived state](../../references/state-contract.md)
- `/work-control`: [derived state](../../references/state-contract.md) and [Run authorization](../../references/automation-contract.md)
- `/work-models`: [model routing](../../references/model-routing-contract.md)

Before mutation, read fresh status and use its revision plus a unique idempotency key. `waiting-human`, incompatibility, and rejection never grant permission. Keep delivery on the local Run branch; never push, PR, merge, deploy, delete its worktree, or learn automatically.

For manual `/work-status wp-*`, send exact current-task artifacts; never infer text, approval, execution, or repository state. It is stateless, read-only, and model/controller-independent. Missing artifacts wait; invalid chains replan; corrections remain human-authorized.
