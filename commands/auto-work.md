---
name: auto-work
description: Advance one protected Schema-6 Harness Run to its next human gate.
---

# /auto-work

Read [work-automation](../skills/work-automation/SKILL.md). Start from an exact Schema-6 Root with `supervised|autonomous`, or resume an exact Run revision. Cursor human decisions are exactly:

- `/auto-work accept-delivery <run-id>@<revision>`
- `/auto-work approve-correction <run-id>@<revision>`
- `/auto-work stop <run-id>@<revision>`

Call revision-bound `workflow_prepare` with fresh idempotency. The host injects decision receipts; never supply one. Missing external Host Adapter protection means Shadow Mode, not loss of ordinary host use. Autonomous gaps downgrade only to fully protected Supervised.
