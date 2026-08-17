# Embedded correction

A correction exists only in a Review with `next_action: correct`; `/correct-work` approves its unique active-Plan correction. It contains identity, risk, Findings-backed FIXes, Checks, and advisory Learning candidates.

Each correction declares root-unique `LRN-*` `learning_candidates` with Finding, guidance, targets, and proof. Only `/learn-from-work` confirms and persists them.

Each FIX binds Findings and affected Objectives/Checks, stays in Root authority, and has an idempotent Completion Probe. Verification-only FIXes avoid edits.

`/correct-work` resolves current tips, classifies `satisfied|pending|partial|conflicted`, and executes pending/partial FIXes. It runs correction Checks plus failed, missing, affected, stale, or ambiguous Root Checks as implementation observations, then finishes normally without Evidence. The next fresh Review re-observes required proof; its atomic builder creates delta Evidence against the exact predecessor chain. Unaffected proof keeps its existing grade. Conflict, drift, expansion, or ambiguous approval blocks.

After two unchanged high-Finding rounds, Review uses `clarify|replan`, not unbounded `correct`. `/correct-work` never materializes Learning or adds unrelated effects.
