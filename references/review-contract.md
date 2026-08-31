# Review Schema 6

Review is fresh and repository-read-only. The harness alone chooses inspection mechanisms and supplies observations; Workflow validates authority, lineage, semantics, and evidence grades.

The public result has exactly three outcomes:

- `achieved` with `next_action: none`: no Findings or Open Points and every required Check is at least supported.
- `correction-needed` with `next_action: correct`: at least one correctable in-Root Finding and exactly one complete bounded Correction.
- `open-points` with `next_action: human-assessment`: no pending correctable Finding and at least one concrete Open Point.

A correctable Finding wins over simultaneous limits; all current correctable Findings are bundled into one Correction and other limits remain Open Points. Evidence grade is separate from outcome. Missing protected attestation alone is only a proof limit and does not prevent Achieved.

Every Finding binds original Objective and Check IDs. Open Points have type `evidence|authority|intent|environment|formal-binding|no-progress` plus reason, evidence, impact, and one human question. Corrections reuse original Root Check IDs, validate targets against Root authority, and add no required Checks. After Correct Work the only status is Fresh Review pending.

Missing required Check observations create no artifacts and return an internal retry with exact missing IDs. Explicit unavailability becomes an Open Point. Retry continues only while its signature changes and progress is measurable; repeated no-progress becomes a `no-progress` Open Point.

An invalid formal plan binding does not stop repository inspection. Review continues as Shadow against the human plan, shows Findings and Open Points, emits no authoritative artifacts, and offers no correction authority.
