# Diagnostic engineering playbooks

All entries are repository-read-only. They produce findings and limitations, not Workflow artifacts or implementation authority.

## `investigation`

Establish the question and decision audience, trace the relevant source and authoritative records, distinguish observation from inference, and return an explanation or recommendation with concrete evidence and tradeoffs. If the result requires a change, stop and propose `bug-fix`, `feature`, or `refactoring` for separate confirmation.

## `runtime-forensics`

Capture the live signal on the affected surface, reduce it to the smallest useful mechanism, confirm the mechanism with targeted observation, and map it back to the source boundary. If the live surface cannot be reached, report that limitation rather than substituting source speculation. Hand a confirmed defect to `bug-fix` or `performance` only after separate confirmation.

## `trace-forensics`

Identify the fixed artifact and format, transform it into a queryable representation when necessary, narrow to the dominant frame, retainer, wait, or failure path, and map symbols back to source. A paired capture can confirm a regression; without one, label the strongest supported hypothesis honestly. Do not recapture or mutate the target under this playbook.
