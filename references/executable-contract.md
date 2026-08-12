# Intent Root contract

A Schema-5 `work-plan` is closed and requires `artifact`, `schema`, `id`, `status`, `intent_ready`, `profile_max`, `contract_level`, `risk`, `hard_triggers`, `goal`, `acceptance`, `non_goals`, `constraints`, and `authority`.

Initial Roots omit lineage. A replan Root uses a fresh ID and must bind both `predecessor_plan_id` and the predecessor's unique current `replan_source_review_id`; the source review requires `next_action: replan`. Lineage is authoritative, linear, and acyclic.

`authority` closes allowed roots, protected and approval-required paths, dependencies, external effects, repository-only delivery, and controlled budgets. Manual uses `lean`; supervised uses `controlled`; autonomous uses `certified` plus hashed Verification Profile, task recipe, certified region, and Route Pool.

Intent, Acceptance, Boundaries, and Risks must be meaningfully present, but may be prose, lists, or tables. The Validator checks semantics rather than eight fixed tables. The Root declares primary outcomes; Strategy owns mutable steps, targets, and equivalent checks.
