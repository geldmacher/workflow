---
name: close-work
description: Recover a missing deterministic delivery closeout without editing repository files.
---

# /close-work

Designed for Cursor Agent Mode. Accept `/close-work [wp-id]` and read [work-closeout](../skills/work-closeout/SKILL.md) completely.

Invocation authorizes verification-only repository reads and safe local, non-interactive Checks. It does not authorize repository mutation, network access, external effects, production access, acceptance, or a controller Run. Return the exact `delivery-evidence` produced by `workflow_closeout`.
