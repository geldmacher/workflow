---
name: correct-work
description: Apply the latest approved Workflow correction.
---

# /correct-work

Designed for Cursor Agent Mode. This command accepts no arguments. Read [work-execution](../skills/work-execution/SKILL.md) completely.

`[workflow-model-inherit-v1]`

Invocation approves only the newest unique actionable correction in the active native Cursor Plan's Root chain. Multiple active Roots, a stale review tip, or no current correction stops before mutation. Return evidence, then hand control back to Ask `/review-work`.
