---
name: verification-work
description: Inspect, create, or maintain a scoped project verifier.
---

# verification-work

Read the [working agreement](../../references/workflow.md) and [verification guidance](../../references/verification-work.md). Default to read-only `inspect`. `create`, `maintain`, and explicit `maintain full` require an approved plan and matching implementation or correction instruction covering the destination and outcome.

Use existing project harnesses. Create or modify only the authorized verifier surface, with actionable setup, behavior, observations, isolation, and cleanup. Default maintenance covers affected features; `maintain full` covers the agreed full map. Drive at least one relevant feature after creation and each affected behavior after maintenance, within the available permissions. If runtime access is unavailable, report the untested result. Never change an oracle to hide a product regression.

Report paths, changes, exercised behavior, observations, and limitations. A changed verifier needs a fresh separately commissioned review. This action does not repair product code unless that work is independently within the current assignment.
