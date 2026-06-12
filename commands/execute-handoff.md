---
name: execute-handoff
description: Execute an existing handoff packet without replanning or broadening scope.
---

# Execute Handoff

Use when a handoff packet already exists and the next job is implementation.

1. Follow the `handoff-executor` skill.
2. Treat the latest handoff packet as the active scope.
3. Implement `Executable agent plan` in order.
4. Stop and ask for a tightened handoff if execution-critical details are missing.
5. Run the packet's verification when possible.
6. Recommend delivery review only when risk, scope, or uncertainty justifies it.
