---
name: plan-work
description: "Plan repository implementation when requested."
---

# plan-work

Read the [working agreement](../../references/workflow.md) unless it is already in this task's context. A natural-language request for an implementation plan selects planning; implementation reasoning does not start planning. Inspect the repository and saved project lessons for current relevance before asking questions it can answer. Planning is read-only; verification inspection does not start the product.

Before asking, inspect other worktrees for in-flight work, uncommitted changes here, and any unfinished plan or implementation documented for this repository. A clean idle worktree is not another workstream. When another workstream is active, or this checkout is dirty with work this task must leave untouched, read [concurrent work](../../references/concurrent-work.md) and record continue, wait, or isolate in the plan to cold-start. A clean sole checkout needs no worktree and no extra question.

Check plan choices against the north star, assignment, and success criteria; resolve consequential conflicts with the user. Stop when goal, boundaries, interfaces and checks suffice. A clear assignment needs no interview and no advance routine design. When a short throwaway experiment can settle an open technical question, propose it instead of a longer risk list.

When the assignment is vague or underspecified (missing the goal, boundaries, interfaces, success checks, or a material trade-off that would change the plan), an optional short decision round asks only what blocks a sound plan. Offer a concrete recommendation the user can accept or steer, in a few focused questions. Do not add a separate skill for that round, require a glossary, expand a design tree, or turn planning or Auto-Work into an interview gate.

For a repeated correction, read the [learning guidance](../../references/learning-work.md) and plan prevention proportionate to the assignment.

Explain the goal, benefit, observable success criteria, scope, exclusions, material risks, dependencies, decisions, and checks. Add files, commands, or sequencing where needed. For a new or changed API, CLI, or config format, include a short caller-side usage example and the key signatures, as the concrete target for plan-only implementation and review. For a material change (architecture, a breaking change, several surfaces, or schema and deploy), note each relevant second-order effect in one line: caller impact, data or migration, deploy and rollback, and security or auth. Mark speculation as speculation. Omit it for a routine fix or small plan.

Resolve success criteria, instruction conflicts, permissions, and consequential choices before presenting the plan. Hand off the working agreement, [implementation requirements](../../references/implementation-work.md), accepted references, and the open learning collection. Reference the complete collection when the receiver can reach it, and include it in full when they cannot. In standalone work, the human checks the plan, starts implementation, and commissions Review. In expressly commissioned Auto-Work, Light waits for plan approval; Dark can continue within the human goal assignment. Neither mode resolves consequential missing choices by assumption.

Read the playbook [catalog](../engineering-work/references/catalog.md) when the user asks about methods or the task has an unexplained defect, a live failure or trace, a performance or metric target, refactoring, a design question, a visual reference, agent comparison, skill authoring, or resumed work. Skip it for a clear routine change with suitable checks. Assess verifier gaps independently. Only selected additions enter the plan. Unaccepted offers neither block planning nor recur for that scope.

Check relevant prerequisites and feedback routes, reusing current evidence. Follow [project readiness](../../references/project-readiness.md) when the affected behavior has no runnable check, a check route is broken or differs between local and CI, or a consequential decision lacks project direction. Reuse suitable checks and verifiers with no offer or justification. Read the [verification guidance](../../references/verification-work.md) for options and handoff when acceptance needs a running UI, CLI, service, side effect, or journey beyond established checks, or when a change affects a covered feature. Retain evidence gaps and acceptance limits.
