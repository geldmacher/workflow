---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [work-automation](../skills/work-automation/SKILL.md). Accept an exact artifact chain and optional `wp-*` selector.

Invocation is read-only. Derive status only from exact Schema-6 Root/Evidence/Review bytes or one current Workflow-6 Run. Reject every unsupported artifact schema. Report requested versus effective profile, Shadow Mode blockers, failed Checks, evidence limitations, and one next lifecycle action. Never infer a concrete execution choice or host permission.
