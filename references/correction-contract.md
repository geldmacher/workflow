# Embedded correction

A Correction exists only in a Schema-6 Review with `outcome: correction-needed` and `next_action: correct`. It covers every current correctable Finding exactly through bounded fixes and steps.

Findings bind original Root Objective and Check IDs. Correction steps reuse only original Root Check IDs; they create no required Check IDs. Local completion probes remain non-authoritative implementation guidance. Every target is validated against the original Root authority before output.

Correct Work is one separate human authorization for the current exact Correction. It applies only those outcomes, creates no Evidence or state, and ends as **Fresh Review pending**. The human separately starts Review Work.

Changed intent, authority, risk, or external effects cannot be smuggled into a Correction. They become a concrete Open Point for human assessment and may lead to a deliberately new Plan Work request.
