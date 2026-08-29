---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [Manual local state](../skills/manual-workflow/SKILL.md). Accept an exact artifact chain and optional `wp-*` selector.

Invocation is read-only. Derive Manual status through the bundled builder's `status` operation only from exact Schema-6 Root/Evidence/Review bytes. Automation Run status is outside this command. Reject every unsupported artifact schema. Present the builder's localized human output once and decorate only `snapshot.next_action` with Cursor syntax. Never infer a concrete execution choice or host permission.
