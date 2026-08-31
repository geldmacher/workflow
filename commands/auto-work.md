---
name: auto-work
description: Advance one protected Schema-6 Harness Run to its next human gate.
---

# /auto-work

Read [work-automation](../skills/work-automation/SKILL.md). Start from an exact Schema-6 Root with `supervised|autonomous`. Safe technical recovery stays inside the selected phase. Cursor human actions are exactly:

- `/auto-work implement`
- `/auto-work review <run-id>@<revision>`
- `/auto-work correct <run-id>@<revision>`

Call revision-bound `workflow_prepare` with fresh idempotency and the active `de|en` presentation locale. `implement` completes only implementation; `review` is a separate repository-read-only human action; `correct` completes only the current Correction and returns Fresh Review pending. The host injects Review and Correction decision receipts; never supply one. Missing external Host Adapter protection becomes a concrete Open Point or Shadow Review, never loss of ordinary host use. Profile differences affect Harness proof, not Review outcomes or human phase gates.
