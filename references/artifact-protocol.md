Schema 5 supports `work-plan|delivery-evidence|work-review`. Workflow-3/4 documents are immutable status-only history, never part of a Workflow-5 chain. The `wp-*` Intent Root is authoritative; Strategy and Decision Ledger may evolve only within it.

Selector precedence is explicit ID, then active native Cursor Plan/current-task chain, then—only without Manual context—a supported controller subject. Replans form a linear `predecessor_plan_id`/`replan_source_review_id` lineage; its unique tip is active. Zero or multiple tips request context and authorize nothing.

Validation is semantically strict and presentation-tolerant. Root prose may use paragraphs, lists, or tables. Lean Manual Evidence needs only `Summary`; Full Evidence keeps proof tables. Unknown authority metadata, ambiguous tips, scope/risk expansion, missing identity, unsafe reuse, and fabricated success block. Top-level `extensions` is opaque audit metadata, never model context or authority.

`achieved` requires every Check verified. `accepted-provisional` is explicit controller acceptance or an ephemeral Manual snapshot with missing/unavailable proof; it never qualifies as successful history. A failed Check is `blocked`; review cannot upgrade it.

Resolve by semantic `artifact`, never filename. Repository delivery excludes push, PR, merge, deployment, production access, and success claims.

Manual cross-context transport may use the external append-only Schema-1 handoff cache. Every read revalidates exact artifact text and active-Plan binding. The cache is never authority, Run state, approval, acceptance, qualification, or Learning.
