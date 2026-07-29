---
name: auto-work
description: Prepare or approve one controlled automated Workflow run.
---

# /auto-work

Read [work-automation](../skills/work-automation/SKILL.md). Accept exactly:

- `/auto-work <goal|wp-id> <auto-gated|unattended-eligible> [route-profile]`
- `/auto-work <preparation-id> approve`

The first form authorizes one read-only Preparation. The second approves only its displayed Root hash; it never approves a downgrade or delivery.
