---
name: work-control
description: Control one prepared or active Workflow run.
---

# /work-control

Read [work-automation](../skills/work-automation/SKILL.md). Accept `<id> <pause|resume|stop|answer|accept>`; a Preparation accepts only `stop`. `accept` additionally requires `acceptance: verified|provisional`, matching the displayed delivery state.

Invocation authorizes only that transition. `answer` uses `workflow_answer`; all others use `workflow_control`. Never expand Root authorization.

Supervised delivery always needs human `accept`. A fully verified effective autonomous Run reaches `achieved` directly; an evidence gap first downgrades it to supervised. Failed Checks block acceptance.
