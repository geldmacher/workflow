# Root review

Required fields are `artifact: work-review`, `schema: 2`, stable `id`, `root_plan_id`, `latest_evidence_id`, `assessment`, `next_action`, and compact inspected/reused Objective and Check arrays. Predecessor review is optional when the latest predecessor is unique. Route, correction ID, timestamps, source, and auditor provenance are derived or optional.

Required content is Assessment and Next action. Evidence coverage is optional when frontmatter and cited evidence remain unambiguous. Findings appear only when material; a Correction plan appears only for `correct`. Every newly emitted correction declares non-empty `learning_candidates` and embeds the Learning table defined by [learning closeout](learning-contract.md). Legacy corrections without candidates remain valid with a diagnostic. Additional operational, audit, knowledge, and explanatory sections are allowed.

Lean/standard begins with the cheapest sufficient inspection; deep/hard-trigger work receives full scrutiny. Delivery and risk auditors are optional helpers, not success tokens. Missing a named auditor causes `retry-review` only when the unresolved question prevents a defensible decision; equivalent inline scrutiny may satisfy the planned assurance.

`achieved` requires every effective root Objective achieved, every required Root Check supported, current delivery consistent with the evidence, no material Finding, and no unresolved decision-relevant limitation. A Check may be evidenced by a documented equivalent execution that preserves expected outcome, scope, risk, and evidence strength.

Follow-up review still lists all root Objectives and required Checks. Reuse is accepted through matching fingerprints or, for lean/standard, current source/dependency inspection showing no relevant overlap. Deep/hard-trigger reuse requires strong fingerprints or fresh evidence.

Use `correct` for executable in-scope gaps, `clarify` for a human decision, `replan` for changed intent/scope/acceptance/risk, and `retry-review` for genuinely missing decision evidence. Repeated no-progress Finding keys are reported as churn and normally redirect to clarify/replan, but do not structurally forbid a human-approved new attempt.
