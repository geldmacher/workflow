---
name: engineering-work
description: Suggest or apply one non-authoritative engineering playbook.
---

# Engineering work

Use this Gateway when a task benefits from a disciplined engineering method. It is optional methodology, never Workflow authority or evidence.

## Suggest

`$engineering-work suggest` is read-only. Read the [catalog](../../references/engineering-playbooks.md), inspect the current task, phase, and exact Schema-6 Root when one exists, then recommend exactly one playbook. If the material intent is ambiguous, ask one clarifying question instead of routing automatically.

Return the playbook ID, why it fits, intended phase, authority needed, and the exact confirmation `$engineering-work use <playbook-id>`. Do not mutate, start implementation, or treat the recommendation as approval.

## Use

`$engineering-work use <playbook-id>` is the human confirmation. Read only the matching family reference named by the catalog.

- Diagnostic playbooks remain read-only.
- A mutating playbook requires an exact approved Schema-6 Root and separate implementation authority. Then follow [work execution](../work-execution/SKILL.md); the project harness chooses every command, tool, model, framework, runner, sandbox, worktree, retry, decomposition, and verification mechanism.
- Continuity playbooks preserve state only inside existing authority. They never create a commit, push, external publication, acceptance, qualification, or learning permission.

Playbook choice may appear in human trace text. It must never enter Root, Evidence, Review, PhaseRequest, PhaseResult, a grade, or an authority decision.

If no invocation verb is supplied, perform `suggest` only. Never become sticky and never auto-apply a recommendation.

PR, merge, deployment, autopilot landing, destructive cleanup, and automatic publication are outside this Gateway.
