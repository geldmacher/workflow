Schema 4 supports `work-plan|delivery-evidence|work-review`. Workflow-3 documents are immutable status-only history and are never mixed into a Workflow-4 chain. The `wp-*` Intent Root is authoritative; the external Strategy and Decision Ledger may evolve only inside its authority.

Validation is semantically strict and presentation-tolerant. Intent Root prose may use paragraphs, lists, or tables. Unknown authoritative metadata, ambiguous tips, scope/risk expansion, missing evidence identity, unsafe reuse, and fabricated success remain blocking. Optional top-level `extensions` is opaque audit metadata and never model context or authority.

`achieved` means every required check is verified. `accepted-provisional` is a human acceptance of plausible work with missing or unavailable evidence and never qualifies as successful history. A known failed check is `blocked`; reviewer opinion cannot upgrade it.

Artifacts resolve by semantic `artifact`, never filename. Repository delivery excludes push, PR, merge, deployment, production access, and production-success claims.
