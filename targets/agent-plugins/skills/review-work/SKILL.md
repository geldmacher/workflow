---
name: review-work
description: Perform a fresh repository-read-only review of one exact portable Schema-6 delivery.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Review work

Use a fresh read-only phase in the current task. Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), [review contract](../../../../references/review-contract.md), [host-owned input](../../../../references/work-review-input-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Use one exact current Schema-6 Root and exact predecessor artifacts from the conversation. In a fresh task, require explicit attachment of the Root and every referenced artifact. Cache, MCP state, hook state, IDs, and harness self-assertion are not authority. Invalid, stale, conflicting, or ambiguous bytes are rejected.

Declare repository-read-only intent. The project harness chooses every concrete inspection mechanism and supplies opaque repository and Check observations. Workflow evaluates only the closed semantic input, never commands, tools, models, frameworks, routes, retries, sandboxes, or worktrees.

Inspect repository outcomes separately from proof calibration. Create the closed review, repository-observation, and Check-observation inputs defined by the builder contract. Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`. Use `supported` only for an unambiguous current-snapshot outcome; invocation, source presence, masked exit status, or unknown outcome is `partial` or `unavailable`. Same-task observations may be reused while the snapshot is unchanged. Never supply IDs, hashes, attestations, receipts, or verified claims. Invoke `${PLUGIN_ROOT}/dist/manual-workflow.mjs build-review` once. It creates the pair atomically without MCP, adapters, MCP Roots, hooks, cache, or state.

On success, render `human_output` once. Decorate only `presentation.next_action` through the fixed portable mapping; do not independently assess or add a postscript. Then place each returned artifact text exactly once, unchanged and unquoted, inside its own default-closed `<details>` block; localize only summary labels. Ordinary outside-allowed paths remain visible and provisional; protected, approval-required, escaping, and failed paths or Checks block. For Shadow, decorate only the top-level `next_action`, create no pseudo-artifact, and retain supplied task bytes.

Never mutate or trigger external effects during Review. Optional protected sealing is a separate explicit capability that may append a new result but never edits Manual artifacts.
