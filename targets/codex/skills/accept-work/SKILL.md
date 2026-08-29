---
name: accept-work
description: Ephemerally accept one current provisional Schema-6 Manual delivery.
---

# $accept-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Require one exact complete current Schema-6 chain whose unique Review tip permits provisional acceptance. Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`, then invoke `../../dist/manual-workflow.mjs accept-provisional` with the exact Root and artifacts.

Render `human_output` once and decorate only `snapshot.next_action` through the fixed Codex mapping. Do not independently assess or add another action. Report the ephemeral decision only when returned. Refuse unsupported, verified, blocked, failed, incomplete, stale, mixed, ambiguous, or correction-pending chains. Do not create or modify files, artifacts, guidance, Git state, or persistent approval state.
