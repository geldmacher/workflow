# Embedded correction

A correction exists only in a review with `next_action: correct`; invoking `/correct-work` approves the newest unique actionable one. It contains one stable `cp-*`, root/source/base links, risk, Findings-backed FIXes, outcome-oriented steps, and required verification.

Each FIX references stable Finding keys plus affected root Objectives and Checks. Targets remain within root required/permitted scope and outside prohibited scope. Completion Probes make execution idempotent. A verification-only FIX collects genuinely missing repository evidence without unnecessary implementation changes.

`/correct-work` resolves the current evidence tip, classifies work `satisfied|pending|partial|conflicted`, preserves partial progress, and executes only pending/partial FIXes. It reruns affected verification and inherits unchanged proof when fingerprints or current change-impact inspection justify reuse. Conflict, new intent, scope expansion, higher risk, or ambiguous approval blocks mutation.

Repeated no-progress Findings produce a churn warning and normally recommend `clarify` or `replan`; they do not revoke the human's authority to approve another in-scope approach. Corrections never introduce unrelated improvements, publishing, deployment, production access, or production claims.
