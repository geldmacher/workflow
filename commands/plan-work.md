---
name: plan-work
description: Create one intent-ready Workflow root in Plan Mode.
---

# /plan-work

Designed for Cursor Plan Mode. Accept `/plan-work <goal>` or `/plan-work replan [wp-*]` and read [work-planning](../skills/work-planning/SKILL.md) completely. Replan resolves its predecessor only from exact current-task Schema-6 Root/Review bytes. Unsupported artifact schemas are rejected.

Invocation authorizes planning only. The Skill passes the active German or English presentation locale. Emit no Root before intent is ready; initial implementation still requires the human-selected **Implement Plan** action. End with `### Next step`.
