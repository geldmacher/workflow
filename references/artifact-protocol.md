Schema 5 supports `work-plan|delivery-evidence|work-review`. Workflow-3/4 is immutable history. The `wp-*` Intent Root is authoritative; Strategy and Ledger evolve only within it.

Selector precedence is explicit ID, active Plan/current-task chain, then—without Manual context—a controller subject. Replans form a linear `predecessor_plan_id`/`replan_source_review_id` lineage whose unique tip is active. Zero or multiple tips authorize nothing.

Validation is strict and presentation-tolerant. Lean Evidence needs `Summary`; Full keeps proof tables. Unknown authority, ambiguous tips, scope/risk expansion, missing identity, unsafe reuse, and fabricated success block. `extensions` is opaque audit metadata, never model context or authority.

`achieved` requires every required Check. Deferred Checks are not gates. `accepted-provisional` acknowledges missing/unavailable proof and never qualifies. Failure is `blocked`; review cannot upgrade it.

Resolve by semantic `artifact`, never filename. Repository delivery excludes push, PR, merge, deployment, production access, and success claims.

Manual transport may use the append-only Schema-1 root-content handoff cache, namespaced by the full SHA-256 of exact Root text. Reads revalidate exact text and active-Plan binding. The cache grants no authority, Run, approval, acceptance, qualification, or Learning.
