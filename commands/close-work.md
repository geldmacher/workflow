---
name: close-work
description: Recover deterministic delivery closeout without repository edits.
---

# /close-work

Designed for Cursor Agent Mode. Accept `/close-work [wp-id]` and read [work-closeout](../skills/work-closeout/SKILL.md) completely.

Invocation authorizes local, non-interactive verification only; it does not authorize repository mutation, network, external effects, production, acceptance, or a Run. Recover through the internal closeout builder without artifact ceremony. One strict `closeout-input` is fallback; the hook derives Evidence and resumes review once. Lead with outcome/gaps and `### Next step`; never invent Evidence identity/status.
