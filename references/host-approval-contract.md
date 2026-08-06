# Host tool-approval preference

Workflow never grants Cursor or Codex MCP tool approvals and never writes host settings. Host sandbox and human approvals remain authoritative. Standard MCP tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) are advisory safety facts that hosts may use; they are not an allowlist and do not auto-approve anything.

## Preference file

Create optional Schema-1 `~/.geldmacher/workflow/preferences.yaml` (override with `GELDMACHER_WORKFLOW_HOME` / `GELDMACHER_WORKFLOW_PREFERENCES`):

```yaml
schema: 1
tool_approval: strict
```

| `tool_approval` | Meaning |
|---|---|
| `strict` | Default when missing or invalid. Expect host confirmation for each Workflow MCP call. |
| `allowlisted` | You intend the host MCP allowlist to cover Workflow tools. The preference itself still grants nothing. |

Optional `manual_subagent_policy` may approve concrete host-specific Manual subagent candidates. Missing or invalid policy stays parent-only. See [manual subagent policy](./manual-subagent-policy.md).

`workflow_status` exposes non-authoritative `host_tool_approval` metadata: `tool_approval`, `source`, `path`, `authoritative: false`, `grants_host_approval: false`, and `host_allowlist_required` when allowlisted.

## Cursor allowlist

With `tool_approval: allowlisted`, add tools under **Settings → Agents → Approvals & Execution** or in `~/.cursor/permissions.json`. Match the server id shown on the approval chip. Declared Cursor MCP key is `workflow` in `mcp.json`; installed plugins often show a longer plugin-prefixed id on the chip. Run Mode must be **Auto-review**, **Allowlist**, or **Run Everything**.

Prefer least privilege. Broader wildcards are an explicit high-trust choice, never the default recommendation. When the chip shows a plugin-prefixed id, duplicate each `workflow:...` entry with that exact chip id.

### Preset A — read-only Manual inspection

```jsonc
{
  "mcpAllowlist": [
    "workflow:workflow_plan_preflight",
    "workflow:workflow_artifact_context",
    "workflow:workflow_status"
  ]
}
```

Cursor may also allowlist additional read-only controller inspection tools by exact `server:tool` name when needed; keep those Cursor-only entries out of Codex configuration.

### Preset B — Manual delivery (recommended)

Adds the five Manual tools used by `/plan-work` → Implement Plan → `/review-work` → `/work-status`:

```jsonc
{
  "mcpAllowlist": [
    "workflow:workflow_plan_preflight",
    "workflow:workflow_artifact_record",
    "workflow:workflow_artifact_context",
    "workflow:workflow_closeout",
    "workflow:workflow_status"
  ]
}
```

### Preset C — full Cursor controller (opt-in)

Only when you intentionally trust every Workflow MCP tool on Cursor, including mutating controller actions:

```jsonc
{
  "mcpAllowlist": [
    "workflow:*"
  ]
}
```

Add the plugin-prefixed chip id with `:*` only when Cursor shows that id. Do not use Preset C for Codex; Codex exposes only the five Manual tools. Workspace binding and External-File Protection remain separate from this preference. Cursor MCP binds `GELDMACHER_WORKFLOW_WORKSPACE_ROOT` to `${workspaceFolder}` for operational workspace identity; root-content handoff under `~/.geldmacher/workflow/handoff/by-root/...` may still require host sandbox/external-file allowance even when MCP tools are allowlisted.

## Codex allowlist

With `tool_approval: allowlisted`, configure Codex host MCP / tool policy for the Manual server key `geldmacher-workflow` in `targets/codex/.mcp.json`. User config can override plugin-provided MCP policy under `plugins.<plugin-id>.mcp_servers.geldmacher-workflow` without Workflow writing that file.

Least-privilege example using truthful `readOnlyHint` annotations:

```toml
[plugins."geldmacher-workflow@local".mcp_servers.geldmacher-workflow]
default_tools_approval_mode = "writes"
```

`writes` prompts for tools that are not marked read-only. For session-persistent auto-run of Manual tools only, set per-tool `approval_mode = "auto"` for the five Manual tools, or set `default_tools_approval_mode = "auto"` only if you accept every Manual tool without prompts. Keep sandbox and human approvals authoritative; do not treat the preference as a host bypass.

## Agent behavior

- In `strict`, do not assume MCP calls auto-run; wait for host prompts.
- In `allowlisted`, expect a host allowlist; if prompts or roots/handoff failures persist, report misconfiguration instead of claiming approval was granted.
- Never claim the preference, status field, annotations, or plugin granted host approval.
- Never create or edit Cursor `permissions.json`, Codex `config.toml`, or other host approval settings unless the human explicitly asks outside Workflow authority.
