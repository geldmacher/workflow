---
name: correct-work
description: Apply the current approved Workflow correction.
---

# /correct-work

Designed for Cursor Agent Mode. This command accepts no arguments. Read [work-execution](../skills/work-execution/SKILL.md) completely.

`[workflow-model-inherit-v1]`

Approve only the newest unique correction in the exact current-task native Plan chain; stale, missing, or multiple tips stop before mutation. Run correction Checks plus failed, missing, affected, stale, or ambiguous Root Checks. Finish normally without Evidence, then Ask `/review-work` to create delta Evidence and Review atomically.
