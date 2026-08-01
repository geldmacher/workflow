# Review Schema 5

A `work-review` binds the Root and latest evidence, declares assessment, delivery status, route, auditors, next action, and inspected/reused coverage. Reviewers are fresh and read-only. They judge Intent, Strategy, diff, and evidence; they cannot upgrade an evidence grade.

An explicit `wp-*` selects its Root. Otherwise use the active native Cursor Plan and current-task chain, then a unique active controller Run; Manual needs no controller state. Missing or ambiguous Root/evidence identity produces a non-artifact request, never a partial `work-review`.

Verified delivery requires `assessment: achieved`, `delivery_status: verified`, and `next_action: none`. A Manual evidence gap may use `assessment: provisional`, `delivery_status: provisional`, and `next_action: accept-provisional`; `/accept-work` can acknowledge exactly that current tip without persistence. Known failure is blocked and must correct or replan. Corrections remain Findings-backed and inside Root authority.
