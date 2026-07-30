# Review Schema 4

A `work-review` binds the Root and latest evidence, declares assessment, delivery status, route, auditors, next action, and inspected/reused coverage. Reviewers are fresh and read-only. They judge Intent, Strategy, diff, and evidence; they cannot upgrade an evidence grade.

Verified delivery requires `assessment: achieved`, `delivery_status: verified`, and `next_action: none`. An evidence gap may use `assessment: provisional`, `delivery_status: provisional`, and `next_action: accept-provisional`. Known failure is blocked and must correct or replan. Corrections remain Findings-backed and inside Root authority.
