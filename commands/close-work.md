---
name: close-work
description: Recover a missing deterministic delivery closeout without editing repository files.
---

# /close-work

Designed for Cursor Agent Mode. Accept `/close-work [wp-id]` and read [work-closeout](../skills/work-closeout/SKILL.md) completely.

Invocation authorizes local, non-interactive verification reads/Checks; it does not authorize repository mutation, network, external effects, production access, acceptance, or a Run. Return one strict native `closeout-input` for `review-recovery`; the hook derives/persists Evidence and resumes read-only review once. `workflow_closeout` remains optional compatibility: return `structuredContent.artifact` unchanged. Lead with outcome, checks, gaps, and `### Next step`; never invent Evidence identity/status.
