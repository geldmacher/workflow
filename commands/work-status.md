---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional Preparation, Run, or `wp-*` selector.

Invocation is read-only. Show Intent hash, Strategy revision, requested/effective Profile, evidence grade, deviations, Dirty Baseline hash, Qualification Key, and blockers when present. A manual selector uses only the complete Schema-4 chain available in the current task and creates no controller state or evidence. Workflow-3 history remains read-only.
