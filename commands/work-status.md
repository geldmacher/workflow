---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [Manual local state](../skills/manual-workflow/SKILL.md). Accept an exact artifact chain and optional `wp-*` selector.

Invocation is read-only. Derive Manual status through the bundled builder's `status` operation only from exact Schema-6 Root/Evidence/Review bytes. Automation Run status is outside this command. Reject every unsupported artifact schema. Return the builder's state, blockers, failed Checks, evidence limitations, and one next lifecycle action unchanged. Never infer a concrete execution choice or host permission.
