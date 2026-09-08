# Engineering playbook catalog

This catalog is optional, human-confirmed methodology. It supports the current assignment and does not grant additional permissions.

## Selection

Choose exactly one closest outcome:

| Playbook ID | Use when | Playbook reference |
|---|---|---|
| `investigation` | Explain, critique, or recommend without repository mutation. | [investigation](./investigation.md) |
| `runtime-forensics` | Diagnose a live runtime symptom from fresh instrumentation. | [runtime-forensics](./runtime-forensics.md) |
| `trace-forensics` | Diagnose an already captured profile, trace, dump, or snapshot. | [trace-forensics](./trace-forensics.md) |
| `bug-fix` | Reproduce, identify, correct, and prove one defect. | [bug-fix](./bug-fix.md) |
| `feature` | Add or intentionally change behavior. | [feature](./feature.md) |
| `refactoring` | Change structure while preserving pinned behavior. | [refactoring](./refactoring.md) |
| `performance` | Improve one measured slowness against a baseline. | [performance](./performance.md) |
| `hillclimb` | Iteratively improve one metric under a budget and stop predicate. | [hillclimb](./hillclimb.md) |
| `prototype` | Settle a design or empirical decision with disposable work. | [prototype](./prototype.md) |
| `visual-parity` | Match an immutable visual reference with a harness-owned comparison. | [visual-parity](./visual-parity.md) |
| `skill-authoring` | Create or revise one agent skill and validate its structure. | [skill-authoring](./skill-authoring.md) |
| `evaluation` | Compare agent behavior using fixed criteria and blinded candidates. | [evaluation](./evaluation.md) |
| `session-pickup` | Resume prior work from exact reports and bounded context. | [session-pickup](./session-pickup.md) |
| `pause-safely` | Stop at a durable, resumable boundary without new external effects. | [pause-safely](./pause-safely.md) |

When two entries appear plausible, select by deliverable: diagnosis before correction, prototype before production feature, one-off performance correction before hillclimb, and fixed captured data before live forensics.

## Planning integration

Recommend a method only if it helps this task. Present its fit and intended phase without requiring a selection before finishing a plan. An explicit inline choice or `engineering-work use` selects the method; actual mutation still needs the matching implementation or correction instruction.

## Cross-cutting adaptation

- Long-running work uses a checkable exit predicate, agreed budgets, and one auditable result per iteration. It does not gain autonomous authority.
- Multi-phase work expresses objective prerequisites and independently verifiable phase outcomes. Concrete execution sequencing belongs to the harness.

Not integrated: babysitting or shipping PRs, automatic merge, full or stacked autopilot, worktree cleanup, simulator cleanup, and any automatic push, deployment, publication, or learning.
