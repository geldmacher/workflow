# Engineering playbook catalog

This catalog is optional, human-confirmed methodology. It supports the current assignment and does not grant additional permissions.

## Selection

Choose exactly one closest outcome:

| Playbook ID | Use when | Family reference |
|---|---|---|
| `investigation` | Explain, critique, or recommend without repository mutation. | [diagnostic](./engineering-diagnostic-playbooks.md) |
| `runtime-forensics` | Diagnose a live runtime symptom from fresh instrumentation. | [diagnostic](./engineering-diagnostic-playbooks.md) |
| `trace-forensics` | Diagnose an already captured profile, trace, dump, or snapshot. | [diagnostic](./engineering-diagnostic-playbooks.md) |
| `bug-fix` | Reproduce, identify, correct, and prove one defect. | [delivery](./engineering-delivery-playbooks.md) |
| `feature` | Add or intentionally change behavior. | [delivery](./engineering-delivery-playbooks.md) |
| `refactoring` | Change structure while preserving pinned behavior. | [delivery](./engineering-delivery-playbooks.md) |
| `performance` | Improve one measured slowness against a baseline. | [delivery](./engineering-delivery-playbooks.md) |
| `hillclimb` | Iteratively improve one metric under a budget and stop predicate. | [delivery](./engineering-delivery-playbooks.md) |
| `prototype` | Settle a design or empirical decision with disposable work. | [delivery](./engineering-delivery-playbooks.md) |
| `visual-parity` | Match an immutable visual reference with a harness-owned comparison. | [delivery](./engineering-delivery-playbooks.md) |
| `skill-authoring` | Create or revise one agent skill and validate its structure. | [delivery](./engineering-delivery-playbooks.md) |
| `evaluation` | Compare agent behavior using fixed criteria and blinded candidates. | [delivery](./engineering-delivery-playbooks.md) |
| `session-pickup` | Resume prior work from exact reports and bounded context. | [continuity](./engineering-continuity-playbooks.md) |
| `pause-safely` | Stop at a durable, resumable boundary without new external effects. | [continuity](./engineering-continuity-playbooks.md) |

When two entries appear plausible, select by deliverable: diagnosis before correction, prototype before production feature, one-off performance correction before hillclimb, and fixed captured data before live forensics.

## Planning integration

Recommend a method only if it helps this task. Present its fit and intended phase without requiring a selection before finishing a plan. An explicit inline choice or `engineering-work use` selects the method; actual mutation still needs the matching implementation or correction instruction.

## Cross-cutting adaptation

- Long-running work uses a checkable exit predicate, agreed budgets, and one auditable result per iteration. It does not gain autonomous authority.
- Multi-phase work expresses objective prerequisites and independently verifiable phase outcomes. Concrete execution sequencing belongs to the harness.

Not integrated: babysitting or shipping PRs, automatic merge, full or stacked autopilot, worktree cleanup, simulator cleanup, and any automatic push, deployment, publication, or learning.

Provenance: independently adapted from the pstack playbook taxonomy at `cursor/plugins`, commit `bdf7aa355337897f167153e05069aca505dae17c`.
