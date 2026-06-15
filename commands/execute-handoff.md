---
name: execute-handoff
description: Execute the active Cursor handoff plan or the latest review-delivery improvement plan without replanning or broadening scope.
---

# Execute Handoff

Use when a Cursor plan artifact or a `Recommended next handoff` from `review-delivery` already exists and the next job is implementation.

1. Follow the `handoff-executor` skill.
2. Resolve the active scope in this order:
   - Use the latest `Recommended next handoff` from `review-delivery` when present.
   - Otherwise use the current or attached Cursor plan artifact.
   - Ask the user to choose when multiple candidate packets are equally plausible.
3. Implement `Executable agent plan` in order.
4. When Cursor exposes task or plan progress UI, mirror each numbered plan step as a visible task and update status as work proceeds.
5. Stop and ask for a tightened handoff if execution-critical details are missing.
6. Run the packet's verification when possible.
7. Recommend another `review-delivery` pass when risk, scope, uncertainty, or skipped verification justifies it.
