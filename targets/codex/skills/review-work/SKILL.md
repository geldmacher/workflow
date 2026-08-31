---
name: review-work
description: Perform a fresh repository-read-only Review against a Schema-6 plan or its human Shadow.
---

# $review-work

Start fresh and repository-read-only. Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely.

Resolve the exact current-task Root and predecessors when available. Run local `validate-plan` before repository inspection, but an invalid or missing formal binding must not prevent that inspection: continue as a read-only Shadow Review against the human plan text. Shadow creates no artifacts and cannot offer Correct Work.

Inspect every objective, boundary, Check, and limitation. The project harness owns every concrete inspection choice. Supply the closed outcome `achieved|correction-needed|open-points`, Findings, Open Points, repository observation, and Check observations. Every Finding binds original Root Objective and Check IDs. Every genuine limitation names its type, reason, evidence, impact, and a concrete human question. Partition dirty paths into disjoint Root-subject and ambient paths; uncertainty is subject. Use `supported` only for a conclusive current-snapshot outcome.

Run `${PLUGIN_ROOT}/dist/manual-workflow.mjs build-review` without MCP, adapters, MCP Roots, hooks, cache, or state. If it returns `check-observations-incomplete`, observe exactly the missing Check IDs and retry internally. Continue only while the retry signature changes and progress is measurable; repeated no-progress becomes a `no-progress` Open Point. A correctable Finding takes precedence and all current correctable Findings are bundled into one Correction. Finding-free with every required Check at least supported is Achieved even when protected proof is absent.

Set `presentation_locale: de` when the active request is German; otherwise `en`. Render `human_output` once. Decorate only `presentation.next_action`: `correct` as **Correct Work**, `human-assessment` as the named natural-language assessment, and `none` as no action. Put each returned artifact text exactly once, unchanged and unquoted, inside its own default-closed `<details>` block. Never mutate.
