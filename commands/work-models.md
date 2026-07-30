---
name: work-models
description: Validate exact model routing for automated Workflow.
---

# /work-models

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional route-profile name.

Call `workflow_validate_models`. This is read-only. Report each ordered Pool candidate as available, certified, or blocked plus the selected candidate and Pool hash. Never accept aliases, silent remaps, free model choice, or fallback outside `approved-pool`.
