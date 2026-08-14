# Host-owned work-review input

New authoritative Schema-5 `work-review` artifacts are built by the host, never serialized by the reviewer model. The reviewer returns exactly one closed Schema-1 semantic input:

```json workflow-review-input
{
  "schema": 1,
  "kind": "review-input",
  "assessment": "achieved",
  "recommended_action": "none",
  "assessment_summary": "The exact verified Evidence satisfies the Root.",
  "snapshot_assessment": "consistent",
  "snapshot_summary": "The Evidence snapshot matches the reviewed repository state.",
  "findings": [],
  "missing_evidence": [],
  "auditor_reports": []
}
```

Every displayed top-level field is required. Empty Findings, missing-Evidence, and auditor collections are explicit empty arrays, never omitted defaults. Finding bindings and every correction judgment are likewise explicit; a missing reviewer-owned field enters the single named-field repair path instead of receiving a host-authored semantic value.

Reviewer-owned fields are the assessment, recommended action, short assessment/snapshot summaries, typed Findings, missing Evidence, typed auditor reports, and an optional semantic correction proposal. Findings use local lowercase keys plus explicit severity, Root Objective IDs, Root Check IDs, evidence, reasoning, and resolution. Correction fixes, steps, checks, and Learning candidates refer only to local semantic keys.

Auditor `assessment` uses the same closed assessment vocabulary as the top-level Review. A top-level assessment may be more conservative than an auditor report but never more positive; contradictory combinations receive the one same-task input repair instead of being silently upgraded. Likewise, `mostly-achieved`, `partially-achieved`, or `not-achieved` cannot be converted into provisional acceptance without a typed finding, Evidence gap, or blocking action.

Artifact IDs, Root/Evidence selection, hashes, status, route, coverage, receipts, lineage, Correction/FIX/STEP/CHECK/Learning IDs, timestamps, and serialization are forbidden model input. The host resolves the exact task-local chain, lowers unsafe claims, derives all identities and fields, renders fixed Schema-5 Markdown, validates the complete chain, and retains the exact bytes in the originating task.

Native Cursor and Codex accept one fenced input block. A named native auditor report counts only after the lifecycle host observed successful completion of the same protected read-only auditor role; an unattested model claim is rejected. Controller reports remain bound to controller phase receipts. Portable Manual may integrate complete typed auditor reports, but they cannot upgrade Check Evidence. Portable Manual calls `workflow_closeout` with `artifact_kind: work-review`; omission keeps the existing `delivery-evidence` default. No sixth Manual tool exists. Root-boundary Reviews contain no model input and are built only from a fresh protected host receipt.

Malformed input receives one repair attempt. The message names the unreadable field, confirms that Root, Evidence, and repository work remain intact, and tells the reviewer to repeat Review in the same task. A second malformed response blocks only Review. Optional handoff/cache failure never invalidates a successfully built task-local Review.

The MCP tool advertises the complete strict object as its primary input branch. A recovery-only object branch lets a malformed candidate reach the same host error presentation instead of failing as an unformatted MCP parameter error. This transport tolerance grants no authority: the builder still applies the closed schema above, rejects every missing, mistyped, or unknown field, and never supplies a reviewer judgment.

`workflow_artifact_record` and `workflow_closeout.artifacts` do not accept a new raw Review as authority. Previously recorded immutable Reviews remain readable without rewriting history; only protected handoff history may identify one such provenance-less Review as legacy. Any newly imported Review without builder provenance must be rebuilt from its exact Root/Evidence chain.

When the current task already supplies exact Evidence, optional cache contents cannot introduce a newer Evidence or predecessor Review tip. Cache recovery may restore the chain only when task-local Evidence is absent; an exact cached duplicate may confirm idempotency without changing lineage or bytes.

See the [Manual Workflow guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#review-results-and-next-actions) for the human-visible result and recovery paths.
