---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional Preparation, Run, or `wp-*` selector.

Invocation is read-only. Without a selector, use the active native Cursor Plan and current-task chain before a unique active controller subject. Show Intent hash, Strategy revision, evidence, deviations, Dirty Baseline, Qualification Key, and blockers.

Explain `requested_profile` as the user's choice and `effective_profile` as what may actually run: `manual` is human-driven, `supervised` needs final human acceptance, and exact-qualified `autonomous` may finish only with complete verified evidence. Name every downgrade reason. Manual status creates no state or evidence. Provisional Manual work stays `delivery-ready-provisional` without explicit ephemeral `/accept-work`. Workflow-3/4 stays read-only.
