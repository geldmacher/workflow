---
name: review-work
description: Perform a fresh repository-read-only Review or informative Shadow Review.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Review work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), [review contract](../../../../references/review-contract.md), and [host-owned input](../../../../references/work-review-input-contract.md) completely.

Declare repository-read-only intent. Resolve the exact Root and predecessors when available. Run local `validate-plan` before repository inspection. An invalid or missing formal binding does not stop inspection: continue against the human plan as Shadow Review, create no artifacts, and grant no correction authority.

Inspect objectives, boundaries, Checks, and limitations. The project harness owns every concrete inspection choice. Supply `achieved|correction-needed|open-points`, Findings, Open Points, repository observation, and Check observations. Findings bind original Objective and Check IDs. Open Points name the concrete reason, evidence, impact, and human question. Partition every dirty path into Root-subject or ambient; uncertainty is subject.

Run `${PLUGIN_ROOT}/dist/manual-workflow.mjs build-review` without MCP, adapters, MCP Roots, hooks, cache, or state. Missing required observations are an internal retry with exact Check IDs. Retry only while signature changes and progress is measurable; repeated no-progress becomes a `no-progress` Open Point. Bundle all currently correctable Findings into one Correction. Finding-free plus supported or verified required Checks is Achieved; proof grade stays separate.

Set `presentation_locale: de` when the active request is German; otherwise `en`. Render `human_output` once and decorate only `presentation.next_action` through the fixed portable mapping for `correct`, `human-assessment`, or `none`. Return each returned artifact text exactly once, unchanged and unquoted, inside its own default-closed `<details>` block. Never mutate or trigger external effects.
