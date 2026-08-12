---
name: work-status
description: Show current Workflow state, blockers, and next action.
---

# /work-status

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional Preparation, Run, or `wp-*` selector.

Invocation is read-only. Without a selector, use the active native Cursor Plan and current-task chain before a unique active controller subject. Prefer MCP presentation; show requested/effective Profile, required actor, downgrade reason, Intent hash, Strategy revision, evidence, deviations, Dirty Baseline, Qualification Key, blockers, and `learning` eligibility/workspace match/candidate count. Render `presentation.help` once before the final action block when present. Use `### Next step` while action remains, compact `### Done` for achieved, and the explicit non-persistent provisional block for `accepted-provisional`.

Explain `requested_profile` as the user's choice and `effective_profile` as what may actually run: `manual` is human-driven, `supervised` needs final human acceptance, and exact-qualified `autonomous` may finish only with complete verified evidence. Name every downgrade reason. Manual status creates no state or evidence. When present, report non-authoritative `host_tool_approval` without claiming it granted host MCP approval. Provisional Manual work stays `delivery-ready-provisional` without explicit ephemeral `/accept-work`. Workflow-3/4 stays read-only.
