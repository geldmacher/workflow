---
name: plan-work
description: Create a human-authorized Schema-5 Workflow plan in Codex Plan mode. Use when the user invokes $plan-work or asks for a Workflow implementation plan.
---

# $plan-work

Operate only in Codex Plan mode. If Plan mode is not active, stop and ask the user to switch modes; do not draft a Root.

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [executable contract](../../references/executable-contract.md), [design contract](../../references/design-contract.md), [plan container](../../references/plan-container-contract.md), and [closeout](../../references/closeout-contract.md) completely.

Clarify only decisions that materially change outcome, scope, authority, public behavior, data/security, risk, or acceptance. Inspect read-only. Built-in subagents are optional for bounded research and must receive `[workflow-model-inherit-v1]`. Without Manual subagent policy, omit model, provider, and reasoning overrides; with a configured Codex ordered policy, allow only Workflow-selected approved candidates or parent fallback.

Create one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID and cheapest sufficient required Checks. Call `workflow_plan_preflight` with the exact Root and repair every blocker. Then call `workflow_artifact_record` with that same exact text. Neither call grants implementation approval. Honor [Codex Manual](../../references/codex-manual.md) host tool-approval guidance: `strict` expects host MCP prompts; `allowlisted` expects a Codex host allowlist and never claims the preference granted approval.

Return one native `<proposed_plan>` containing the visible `wp-*` ID and the material decisions. Its final implementation step must call `workflow_closeout` with the exact Root/chain and report the resulting `de-*` artifact. Do not implement. Implementation begins only through the user's separate **Implement Plan** action.
