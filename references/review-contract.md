# Root review

Required fields are `artifact: work-review`, `schema: 3`, stable `id`, `status`, `root_plan_id`, `latest_evidence_id`, `assessment`, `review_route`, `next_action`, nullable `correction_id`, nullable `predecessor_review_id`, `auditors_run`, and compact inspected/reused Objective and Check arrays. The first review declares a null predecessor; follow-ups name the direct predecessor. Route, correction ID, predecessor, and auditor provenance are explicit and never inferred.

Required content is Assessment and Next action. Evidence coverage is optional when frontmatter and cited evidence remain unambiguous. Findings appear only when material; a Correction plan appears only for `correct`. Every correction follows the candidate-authoring rules in [embedded correction](correction-contract.md); omission is invalid. Additional operational, audit, knowledge, and explanatory sections are allowed.

Lean/standard begins with the cheapest sufficient inspection; deep/hard-trigger work receives full scrutiny. Compact/full work additionally compares the delivery with product, architecture, program-design, slice, and invariant commitments. Delivery, design, and risk auditors are optional helpers, not success tokens. Missing a named auditor causes `retry-review` only when the unresolved question prevents a defensible decision; equivalent inline scrutiny may satisfy the planned assurance.

`achieved` requires every effective root Objective achieved, every required Root Check supported, current delivery consistent with the evidence, no material Finding, and no unresolved decision-relevant limitation. A Check may be evidenced by a documented equivalent execution that preserves expected outcome, scope, risk, and evidence strength.

Follow-up review still lists all root Objectives and required Checks. Reuse is accepted through matching fingerprints or, for lean/standard, current source/dependency inspection showing no relevant overlap. Deep/hard-trigger reuse requires strong fingerprints or fresh evidence.

Use `correct` for executable in-scope gaps, `clarify` for a human decision, `replan` for changed intent/scope/acceptance/risk, and `retry-review` for genuinely missing decision evidence. Repeated no-progress Finding keys are reported as churn and normally redirect to clarify/replan, but do not structurally forbid a human-approved new attempt.
