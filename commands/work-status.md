---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional Preparation, Run, or `wp-*` selector.

Invocation is read-only. Manual status uses exact Root/Evidence/Review bytes visible in this task; it never restores host state or cache artifacts. Only when no native Manual Plan exists may an explicitly selected controller subject use its own Run storage. Prefer MCP presentation and keep the final action exact.

Explain `requested_profile` as the user's choice and `effective_profile` as what may actually run: `manual` is human-driven, `supervised` needs final human acceptance, and exact-qualified `autonomous` may finish only with complete verified evidence. Name every downgrade reason. Manual status creates no state or evidence. When present, report non-authoritative `host_tool_approval` without claiming it granted host MCP approval. Provisional Manual work stays `delivery-ready-provisional` unless this exact response was produced by the explicit ephemeral `/accept-work`; the acknowledgement is not persisted and grants no Qualification or Learning authority. Workflow-3/4 stays read-only.
