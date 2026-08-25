---
name: work-automation
description: Delegate Schema-6 phases through the generic project harness boundary.
---

Read [authorization](../../references/automation-contract.md) and [state](../../references/state-contract.md). Use only an exact Schema-6 Root or Run revision and fresh idempotency.

Workflow sends lifecycle intent; the external Host Adapter binds deployment and transition provenance. The project Harness owns execution. Never interpret receipts or trace.

For Cursor gates require exact `/auto-work accept-delivery|approve-correction|stop <run-id>@<revision>`. The host injects the receipt; never request or copy it. Codex and portable remain Manual-only.

Missing protection means phase-local Shadow Mode. Supervised needs human acceptance. Autonomous needs its exact deployment-bound qualification and verified evidence.

Never push, PR, merge, deploy, integrate, publish, or auto-learn. Report evidence, limitations, and one next action.
