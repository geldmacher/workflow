---
name: manual-workflow
description: Validate Manual state and acceptance locally.
---

Use the bundled `dist/manual-workflow.mjs` program and the closed `schemas/manual-workflow/request-1.schema.json` contract. It is stateless, repository-read-only, and independent of MCP, adapters, Roots, hooks, cache, and persistent state.

For status, require the exact current Schema-6 Root and every referenced Evidence/Review byte, then invoke `status`. For explicit `/accept-work provisional`, invoke `accept-provisional` with the same exact chain and succeed only when the returned unique tip is current, provisional, non-failed, and not correction-pending.

Return `human_output` unchanged. Never persist acceptance, create an artifact, infer missing bytes, restore authority from an ID, or turn provisional evidence into verified.
