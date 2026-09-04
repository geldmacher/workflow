---
name: review-work
description: Perform a fresh repository-read-only Review against a Schema-6 plan or its human Shadow.
---

# $review-work

Start fresh and repository-read-only. Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely.

Resolve the exact current-task Root and predecessors when available. Run local `validate-plan` before repository inspection, but an invalid or missing formal binding must not prevent that inspection: continue as a read-only Shadow Review against the human plan text. Shadow creates no artifacts and cannot offer Correct Work.

Inspect every objective, boundary, Check, and limitation. The project harness owns every concrete inspection choice. Supply the closed outcome `achieved|correction-needed|open-points`, Findings, Open Points, repository observation, and Check observations. Every Finding binds original Root Objective and Check IDs. Every genuine limitation names its type, reason, evidence, impact, and a concrete human question. Partition dirty paths into disjoint Root-subject and ambient paths; uncertainty is subject. Use `supported` only for a conclusive current-snapshot outcome.

When an applicable `.agents/skills/verify-*` exists, inspect its current contract and the project surface, then use its Drive only as a harness-owned recipe. Never edit it during Review. Root-relevant drift is a Finding; other drift is an Open Point. Raw Drive output is an observation only, verifier changes require fresh evidence, and `verified` still requires an exact protected attestation.

Run `${PLUGIN_ROOT}/dist/manual-workflow.mjs build-review` without MCP, adapters, MCP Roots, hooks, cache, or state. If it returns `check-observations-incomplete`, observe exactly the missing Check IDs and retry internally. Continue only while the retry signature changes and progress is measurable; repeated no-progress becomes a `no-progress` Open Point. A correctable Finding takes precedence and all current correctable Findings are bundled into one Correction. Finding-free with every required Check at least supported is Achieved even when protected proof is absent.

Set `presentation_locale: de` for German requests; otherwise `en`. Render `human_output` once; only decorate `presentation.next_action` (`correct`→**Correct Work**; otherwise use its named action). Append artifacts once, unchanged and unquoted, in builder order within one default-closed `<details>` titled `Technische Nachweise und Workflow-Artefakte`/`Technical evidence and Workflow artifacts`, below `Delivery Evidence · <label>` then `Work Review · <label>`. Shadow: none. Add nothing; never mutate.
