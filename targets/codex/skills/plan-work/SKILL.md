---
name: plan-work
description: Create a human-authorized free-form Schema-6 Workflow plan in Codex Plan mode.
---

# $plan-work

Operate only in Codex Plan mode. Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), [root semantics](../../references/executable-contract.md), [design](../../references/design-contract.md), and [plan container](../../references/plan-container-contract.md) completely.

Clarify only material outcome, scope, authority, risk, behavior, or acceptance decisions. Once material intent is stable, read the [engineering catalog](../../references/engineering-playbooks.md), recommend exactly one closest playbook with ID, fit, intended phase, and authority need, and ask and wait for an explicit inline confirm or decline. Decline continues without a playbook. Keep this choice as human trace outside authority; a material intent change requires a fresh suggestion.

Before the final Root, assess project-verifier readiness only when acceptance needs a running UI, CLI, service, side-effect boundary, or cross-surface journey beyond established checks. Add one concise non-authoritative `Verification readiness` note with `ready`, `create-recommended`, `maintenance-recommended`, `not-applicable`, or `blocked`. If Create or Maintenance belongs to implementation, include its exact `.agents/skills/verify-*` destination and outcome in human scope, acceptance, and Root path authority. This is no second playbook choice or gate and never becomes a Core extension.

Write the best complete implementation prompt as free-form Markdown. Headings, order, tables, and editorial phrases are not validity conditions. Supply a closed Authority Core input with the plan's goal, acceptance, risk, hard triggers, authority, and structured verification intents to `../../dist/manual-workflow.mjs build-plan`. Never author its hashes or `yaml workflow-authority` block manually. For a deliberately new plan from Open Points, optional predecessor bindings require exact current-task Root and Review bytes; there is no separate replan action.

Set `presentation_locale` to `de` only for an active German request, otherwise `en`. State Root readiness, one concrete reason, and exactly one action: **Implement Plan**. Present exactly the generated `root_plan` inside one native `<proposed_plan>`. Decorate only `implement-plan` as **Implement Plan**. Add no closeout or Review step and never claim implementation or delivery completion.
