---
name: work-execution
description: Apply the latest correction idempotently and emit minimal progressive evidence.
---

This workflow is intended for Cursor Agent Mode. Read [protocol](../../references/artifact-protocol.md), [correction](../../references/correction-contract.md), [evidence](../../references/delivery-evidence-contract.md), and [output](../../references/delivery-evidence-output-contract.md). Let Cursor determine available capabilities.

Accept no ID. Discover artifacts by `artifact` field, never filename, and resolve the newest unique actionable review/`cp-*` plus evidence tip. Use the shipped validator when readily available, but do not require a terminal, temporary serialization, or validator invocation. In all cases check root, chain, scope, reuse, risk, approval, and ambiguity before mutation. New evidence points to the current tip, never back to the review's Base Evidence.

Refresh repository state and classify correction steps `satisfied|pending|partial|conflicted`. Skip satisfied changes, preserve partial work, and stop on conflict, new intent, scope expansion, or higher risk. Execute only pending/partial FIXes. Run required correction and invalidated root Checks; inherit unchanged direct-predecessor evidence when fingerprints or current change-impact inspection justify reuse.

For a verification-only FIX, make no code change: run its mapped Checks, refresh snapshot/fingerprints, and emit new evidence. Missing proof never requires the human to attest test results.

After the implementation is stable, run the relevant Checks and capture the resulting snapshot. Return evidence in the response; do not create repository files merely to satisfy the Workflow protocol. Lean/standard normally emits delta evidence; deep/uncertain work may emit full evidence. Include fresh/reused coverage, validate the effective chain when possible, and direct Ask `/review-work`. Never merge, push, create a PR, deploy, access production, or claim production success.
