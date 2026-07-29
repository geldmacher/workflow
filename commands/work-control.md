---
name: work-control
description: Control one prepared or active Workflow run.
---

# /work-control

Read [work-automation](../skills/work-automation/SKILL.md). Accept `<id> <approve|pause|resume|stop|answer|accept>`; a Preparation accepts only `stop`.

Invocation authorizes only that transition. `answer` uses `workflow_answer`; all others use `workflow_control`. Never expand Root authorization.
