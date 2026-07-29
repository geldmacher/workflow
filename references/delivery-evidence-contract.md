# Progressive evidence

Required identity/link fields are `artifact: delivery-evidence`, `schema: 3`, stable `id`, `status`, `root_plan_id`, `subject_id`, `source_review_id`, `predecessor_evidence_id`, and `representation`. Coverage arrays `affected_objectives|reused_objectives|executed_checks|reused_checks` remain the compact materialization source. Initial evidence uses null source/predecessor links and full representation; correction evidence uses concrete source-review and direct-predecessor IDs.

Core content is Summary, Objective outcomes, Repository snapshot, and Checks. Subject/FIX results, Changes, Idempotency/resume, Deviations, Operational evidence, and Residual risks are conditional on relevance. Heading aliases and extra sections are tolerated; metadata belongs only in optional `extensions`.

The snapshot records current repository identity/status, relevant changed paths, known failures, and available dependency evidence. A separate frontmatter snapshot ID is not required. Check rows identify the Root or correction Check, observed result, status, and—when substituted—the actual execution plus equivalence rationale.

Delta evidence writes affected/executed details and inherits declared unchanged proof from the direct predecessor. Lean/standard reuse is valid when matching fingerprints or current source/dependency inspection shows no relevant change. Deep/hard-trigger reuse requires strong fingerprints or a fresh Check. Changed scope, expected outcome, dependencies, or weaker evidence invalidates reuse.

Readiness is derived from effective Objective outcomes, required Checks, relevant operational proof, and current snapshot consistency. Verification-only work may have no Changes. Never infer deployment or production success from repository evidence.
