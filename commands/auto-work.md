---
name: auto-work
description: Prepare or approve one supervised or autonomous Workflow run.
---

# /auto-work

Read [work-automation](../skills/work-automation/SKILL.md). Accept exactly:

- `/auto-work <goal|wp-id> <supervised|autonomous> [route-profile]`
- `/auto-work <preparation-id> approve`

The first form authorizes one read-only Preparation. The second approves only its displayed Intent Root hash. Strategy revisions inside its authority envelope and an automatic `autonomous` to `supervised` downgrade do not need another approval; delivery acceptance remains separate.
