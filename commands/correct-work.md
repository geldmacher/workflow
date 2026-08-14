---
name: correct-work
description: Apply the current approved Workflow correction.
---

# /correct-work

Designed for Cursor Agent Mode. This command accepts no arguments. Read [work-execution](../skills/work-execution/SKILL.md) completely.

`[workflow-model-inherit-v1]`

Approve only the newest unique correction in the active native Cursor Plan chain; stale, missing, or multiple tips stop before mutation. Closeout adds correction Checks plus failed, missing, affected, stale, or ambiguous Root Checks and reuses unaffected proof at the same grade. Equivalent Checks run once on a stable state, with honest Evidence per ID. Close out internally, then Ask `/review-work`.
