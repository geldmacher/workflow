---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional Preparation, Run, or `wp-*` selector.

Invocation is read-only. Without a selector, use the active native Cursor Plan and current-task chain before a unique active controller subject. Show Intent hash, Strategy revision, requested/effective Profile, evidence grade, deviations, Dirty Baseline hash, Qualification Key, and blockers when present. Manual status creates no controller state or evidence. A provisional chain returns `delivery-ready-provisional` unless `/accept-work` explicitly requests its ephemeral acceptance. Workflow-3/4 history remains read-only.
