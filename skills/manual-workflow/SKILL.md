---
name: manual-workflow
description: Validate Manual state and acceptance locally.
---

Run `dist/manual-workflow.mjs` read-only; no MCP/state. German request→`de`; else `en`.

Status: exact Root/artifacts. Acceptance: unique current provisional nonfailed/noncorrection tip.

Render `human_output` once. Closed Cursor map, `snapshot.next_action`: `implement-plan`→**Implement Plan**; `correct-plan`→Plan revision; `review-root|retry-review`→`/review-work`; `correct`→`/correct-work`; `accept-provisional`→`/accept-work provisional`; `replan`→`/plan-work replan`; `create-schema-6-root|create-root-plan`→`/plan-work`; `clarify`→answer; `provide-artifacts`→exact chain; `none`→no action. No fallback; token stays in trace. Never reassess/mutate evidence/state.
