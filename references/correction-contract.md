# Embedded correction

A correction exists only in a review with `next_action: correct`; `/correct-work` approves the unique current correction in the active Plan chain, never an older Root. It contains stable identity/links, risk, Findings-backed FIXes, outcome steps, verification, and output-only Learning candidates.

Every correction declares at least one root-unique `LRN-*` in `learning_candidates` and embeds `Learning ID | Finding keys | Reusable guidance | Candidate targets | Confirmation evidence`. Each row generalizes a cited Finding, suggests only project-local targets, and names later proof. Review authors candidates but never apply them; only explicit `/learn-from-work` may confirm and persist them.

Each FIX references stable Findings plus affected Objectives/Checks, stays inside Root authority, and has an idempotent Completion Probe. Verification-only FIXes collect missing evidence without unnecessary edits.

`/correct-work` resolves the current evidence tip, classifies work `satisfied|pending|partial|conflicted`, preserves partial progress, and executes only pending/partial FIXes. It reruns affected verification and inherits unchanged proof when fingerprints or current change-impact inspection justify reuse. Conflict, new intent, scope expansion, higher risk, or ambiguous approval blocks mutation.

Repeated no-progress Findings produce a churn warning and normally recommend `clarify` or `replan`; they do not revoke the human's authority to approve another in-scope approach. `/correct-work` never materializes learning candidates; complete correction evidence only makes them eligible for later explicit collection. Corrections never introduce unrelated improvements, publishing, deployment, production access, or production claims.
