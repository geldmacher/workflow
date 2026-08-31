---
name: work-automation
description: Delegate Schema-6 phases through the generic project harness boundary.
---

Read [authorization](../../references/automation-contract.md). Use only an exact Schema-6 Root or Run revision and fresh idempotency. Pass the active German or English locale to every `workflow_prepare` and `workflow_status` call.

Workflow sends lifecycle intent; the external Host Adapter binds deployment and transition provenance. The project Harness owns execution. Never interpret receipts or trace.

Long-running or coordinated work must keep a checkable exit predicate, remain inside Root budgets, and expose one auditable phase result per iteration. The harness owns decomposition and coordination; a coordinator never becomes a Workflow executor or evidence source. Multi-phase prerequisites stay intent-level and never become concrete execution recipes.

For Cursor use exact `/auto-work review <run-id>@<revision>` and `/auto-work correct <run-id>@<revision>` at their separate human gates. The host injects the receipt; never request or copy it. `/auto-work implement` authorizes only implementation. Codex and portable remain Manual-only.

Missing protection means phase-local Shadow Review. Manual, Supervised, and Autonomous expose the same Achieved, Correction needed, or Open points result. Autonomous still needs its exact deployment-bound qualification for autonomous execution.

Implementation and Correct Work always end as Review needed. They never start Review automatically. Technical recovery stays internal to the currently authorized phase.

Never push, PR, merge, deploy, integrate, publish, or auto-learn. Report evidence, limitations, and one next action.
