# Engineering playbook catalog

This catalog is optional, human-confirmed methodology. It supports the current assignment and does not grant additional permissions.

## Selection

Identify the outcomes that meaningfully help the assignment. Use this catalog to compare plausible options before the human selects a method:

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

When several entries are useful, explain their differences by deliverable: diagnosis or correction, prototype or production feature, one-off performance correction or iterative hillclimb, and fixed captured data or live forensics. These distinctions guide the recommendation; they do not authorize choosing on the human's behalf or hiding useful alternatives.

## Planning integration

Offer only methods that help this task. Briefly explain each option's benefit and intended phase, including multiple alternatives when useful and no artificial extras. Mark exactly one substantive option as recommended: the best fit for the goal, scope, and repository. Always include an explicit decline-all option meaning none of the offered playbooks will be used, and allow a revised proposal. Use the user's language, including "Empfohlen" and "Nein, nicht machen" in German.

An explicit inline choice or `engineering-work use` selects the method. A recommendation, silence, or acceptance of a separate verifier offer is not selection. Preserve prior explicit approval; decline or no answer excludes the unselected additions without blocking plan completion or repeating the offer for that scope. Read full method references and put methods into the binding plan only after explicit selection. Actual mutation still needs the matching implementation or correction instruction.

## Cross-cutting adaptation

- Long-running work uses a checkable exit predicate, agreed budgets, and one auditable result per iteration. The selected method itself grants no authority; an explicit Auto-Work assignment governs any automatic phase transitions.
- Multi-phase work expresses objective prerequisites and independently verifiable phase outcomes. Concrete execution sequencing belongs to the harness.

Playbooks do not commission PR operations, cleanup, delivery, or learning. Expressly commissioned Auto-Work delivery follows its own acceptance and gate rules; selecting a method grants none of those permissions.
