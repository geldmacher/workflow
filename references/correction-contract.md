# Embedded correction

A correction exists only in a review with `next_action: correct`; `/correct-work` approves the unique active-Plan correction, never an older Root. It contains identity/links, risk, Findings-backed FIXes, outcome steps, verification, and output-only Learning candidates.

Every correction declares a root-unique `LRN-*` in `learning_candidates` and embeds `Learning ID | Finding keys | Reusable guidance | Candidate targets | Confirmation evidence`. Each row generalizes cited Findings, suggests project-local targets, and names proof. Review authors but never apply candidates; only `/learn-from-work` may confirm and persist them.

Each FIX references stable Findings plus affected Objectives/Checks, stays inside Root authority, and has an idempotent Completion Probe. Verification-only FIXes collect missing evidence without unnecessary edits.

`/correct-work` resolves the evidence tip, classifies `satisfied|pending|partial|conflicted`, preserves progress, and executes pending/partial FIXes. Closeout combines correction Checks with every inherited required Root Check not effectively `passed`; only passed proof is reused. Equivalent Checks may share one probe on the same stable state, with honest Evidence per ID. Unavailable or failed probes stay explicit. Conflict, intent/scope/risk expansion, drift, or ambiguous approval blocks mutation.

Repeated no-progress Findings warn. After two rounds with the same unresolved high Finding, review recommends `clarify|replan`, not unbounded `correct`; a human may clarify one more in-scope approach. `/correct-work` never materializes learning candidates; complete Evidence only makes them eligible. Corrections add no unrelated improvement, publication, deployment, production access, or claim.
