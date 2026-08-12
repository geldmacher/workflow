---
name: plan-work
description: Create one intent-ready Workflow root in Plan Mode.
---

# /plan-work

Designed for Cursor Plan Mode. Accept `/plan-work <goal>` or `/plan-work replan [wp-*]` and read [work-planning](../skills/work-planning/SKILL.md) completely. Replan without an ID uses the active native Cursor Plan.

Invocation authorizes planning only. Emit no root before intent is ready; initial implementation still requires the human-selected **Implement Plan** action. End with `### Next step`.
