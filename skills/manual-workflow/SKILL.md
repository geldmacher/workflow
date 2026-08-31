---
name: manual-workflow
description: Build plans, reviews, and human-relevant Manual status locally.
---

Run `dist/manual-workflow.mjs` locally; no MCP/state. German request→`de`; else `en`.

`build-plan` binds free-form Markdown to one generated Authority Core. `build-review` creates an atomic Evidence/Review pair or returns an internal retry/Shadow result. `status` derives only Root ready, Review needed, Correction needed, Achieved, Open points, or Shadow review from exact bytes.

Render `human_output` once. Closed Cursor map: `implement-plan`→**Implement Plan**; `review-work`→`/review-work`; `correct`→`/correct-work`; `human-assessment`→ask the named natural-language question; `none`→no action. `internal-retry` is handled inside Review while progress is measurable and never shown as a human gate. No fallback; token stays in trace. Never reassess or mutate evidence/state.
