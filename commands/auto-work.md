---
name: auto-work
description: Start supervised or exact-qualified autonomous controller work.
---

# /auto-work

Read [work-automation](../skills/work-automation/SKILL.md). Accept exactly:

- `/auto-work <goal|wp-id> <supervised|autonomous> [route-profile]`
- `/auto-work <preparation-id> approve`

`manual` does not use this command. In `supervised`, the Controller executes but a human accepts delivery. `autonomous` needs an exact Qualification Key and may finish only with complete verified evidence; otherwise it downgrades to `supervised`.

The first form authorizes read-only Preparation. The second approves only its displayed Intent Root hash. In-boundary Strategy revisions and downgrade need no new Root approval. Delivery acceptance is separate.
