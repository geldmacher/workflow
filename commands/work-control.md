---
name: work-control
description: Control one prepared or active Workflow run.
---

# /work-control

Read [work-automation](../skills/work-automation/SKILL.md). Accept exactly one of these copyable forms:

```text
<id> pause|resume|stop
<id> answer <text>
<id> accept verified|provisional
```

A Preparation accepts only `<id> stop`. Run acceptance must match the displayed verified or provisional delivery state.

Invocation authorizes only that transition. `answer` uses `workflow_answer`; all others use `workflow_control`. Never expand Root authorization.

Supervised delivery always needs human `accept`. A fully verified effective autonomous Run reaches `achieved` directly; an evidence gap first downgrades it to supervised. Failed Checks block acceptance.
