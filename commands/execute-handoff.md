---
name: execute-handoff
description: Execute the active Cursor handoff plan with a verified preflight, step checks, and controlled deviations.
---

# Execute Handoff

Use when a Cursor plan artifact or a `Recommended next handoff` from `review-delivery` already exists and the next job is implementation.

1. Follow the `handoff-executor` skill.
2. Resolve the active scope in this order:
   - Use a ready `Recommended next handoff` that explicitly names the active handoff as its predecessor.
   - Otherwise use the current or attached Cursor plan artifact.
   - Ask the user to choose when multiple candidate packets are equally plausible.
3. Run the required preflight before changing files.
4. Implement `Executable agent plan` in order. For every step, inspect the resulting diff and run its step-level verification before continuing.
5. Apply the packet's risk and deviation policy before making any unplanned change.
6. Run every required verification in the matrix. Stop and report the blocker if required evidence cannot be produced.
7. Reconcile the final diff, acceptance criteria, verification evidence, and deviation log before closeout.
8. Recommend another `review-delivery` pass when risk, scope, uncertainty, or incomplete validation justifies it.
