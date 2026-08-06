# Manual subagent model policy

Manual Workflow keeps the human-selected primary model authoritative. Subagent routing is host-aware and fail-safe: missing or invalid policy means **parent-only**.

This policy is independent of Controller Route Pools (`references/model-routing-contract.md`).

## Preference

Optional Schema-1 field `manual_subagent_policy` in `~/.geldmacher/workflow/preferences.yaml`:

```yaml
schema: 1
tool_approval: strict
manual_subagent_policy:
  schema: 1
  mode: parent-or-approved
  hosts:
    cursor:
      preset: cursor-composer-grok-v1
    codex:
      preset: codex-efficient-gpt-v1
```

| Mode | Meaning |
|---|---|
| `parent-only` | Child must exactly match the captured parent. Default when the field is absent or invalid. |
| `parent-or-approved` | Parent match remains valid. Host-specific concrete candidates may also be valid when explicitly configured. |

Custom hosts use ordered concrete `model_id` entries (optional `reasoning_effort` for Codex only). Presets expand to versioned concrete IDs; substring or family inference is rejected.

## Cursor

Cursor Tasks must still omit the model or use literal `inherit`. Workflow does not rewrite Task models.

At `subagentStart`, the observed Child is allowed when it exactly equals the parent **or** exactly equals a configured Cursor approved `model_id`. The shipped `cursor-composer-grok-v1` preset names Composer and Grok candidates and does **not** include GPT Sol.

## Codex

When `parent-or-approved` is configured for Codex, Workflow may rewrite `Agent`/`spawn_agent` inputs to the first available ordered candidate for the current phase, then advance after an unavailable-model failure. The parent is the explicit final fallback. Effective Child model is attested; reasoning effort remains unattested through current host hooks.

The shipped `codex-efficient-gpt-v1` preset orders cost-efficient GPT candidates and does **not** include Sol as a fallback.

## Evidence and status

Out-of-policy or unattested Children are not evidence. `workflow_status.model_inheritance` remains non-authoritative diagnostics. Review/explanation still allow only marked named read-only plugin agents.
