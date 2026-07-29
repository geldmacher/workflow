# Adaptive design depth

Design depth controls how explicitly a root describes maintainability. It is independent from assurance and automation eligibility.

- `oneshot`: mechanical, local work with no material contract or cross-module design. Existing eight H2 tables are sufficient.
- `compact`: behavior or cross-module work. Under **Scope and targets**, add `### System architecture` with `Surface | Current state | Required change | Invariant | Evidence`. Under **Execution steps**, add `### Vertical slices` with `Slice ID | Objectives | Dependencies | Targets | Observable outcome | Check IDs | Human review`.
- `full`: new subsystem, major data/contract/security design, cross-cutting change, irreversibility, or high architectural uncertainty. It includes compact tables plus `### Product requirements` under **Intent and decisions** using `Requirement ID | Need | Actor | Observable outcome | Non-goal or constraint`, and `### Program design` under **Scope and targets** using `Design ID | Responsibility | Interfaces | Invariants | Failure handling`.

Every slice uses `SLICE-N`, references known OBJ/CHECK IDs, lists predecessor slices or `None.`, and has an observable outcome. The `Human review` value is `yes|no`. Size is chosen for a useful independent oracle; 100–200 changed lines is a heuristic, never a validator limit.

Planning raises depth automatically. Lowering a hard `full` trigger requires a material human decision and makes the plan ineligible for unattended execution. Full design is at most `auto-gated` in this version.
