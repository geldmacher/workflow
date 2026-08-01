---
name: work-models
description: Validate exact model routing for automated Workflow.
---

# /work-models

Read [work-automation](../skills/work-automation/SKILL.md). Accept an optional route-profile name.

Manual model choice stays in Cursor and does not use these Pools. Both controller profiles need exact live Pool validation; autonomous additionally accepts only models certified in its Capability Receipt.

Call `workflow_validate_models`. This is read-only. Report each ordered Pool candidate as available, certified, or blocked plus the selected candidate and Pool hash. Never accept aliases, silent remaps, free model choice, or fallback outside `approved-pool`.
