---
name: close-work
description: Recover deterministic Schema-5 delivery closeout without repository edits. Use when the user invokes $close-work for an implemented Root lacking current evidence.
---

# $close-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [closeout contract](../../references/closeout-contract.md) completely.

Resolve one exact Root/chain from the task, then `workflow_artifact_context` as transport enrichment. Capture repository identity and a complete baseline before checks. Reuse only snapshot-bound evidence. Run missing Checks only when they cannot mutate the repository or external systems; otherwise mark them `unavailable`. A known failed Check remains `failed`.

Recompute the baseline and stop on drift. Call `workflow_closeout` with exact artifacts and observed Check evidence. Content-bound handoff persists under the exact Root hash even when workspace Roots are unavailable. Return its Schema-5 `delivery-evidence` byte-for-byte with the `de-*` ID and any attach warning. This command grants no implementation, acceptance, learning, merge, push, publish, or deployment authority. Host tool-approval preference metadata never grants MCP approval; see [Codex Manual](../../references/codex-manual.md).
