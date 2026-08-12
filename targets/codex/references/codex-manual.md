# Codex Manual Facade

Workflow on Codex implements only the Manual profile. It uses Codex Plan mode and `<proposed_plan>` for planning, installable `$skill-name` invocations, built-in subagents under Manual subagent policy or parent inheritance, and Codex lifecycle hooks. Native lifecycle closeout is the default; the bundled five-tool Manual MCP remains optional and wire-compatible.

The host sandbox and human approvals remain authoritative. There is no Controller preparation, adaptive Run, route pool, background watcher, verification profile, credential bridge, automatic merge, push, publication, or deployment.

Optional shared preference `~/.geldmacher/workflow/preferences.yaml`:

```yaml
schema: 1
tool_approval: strict
```

| `tool_approval` | Meaning |
|---|---|
| `strict` | Default when missing or invalid. Expect host confirmation for each Manual MCP call. |
| `allowlisted` | You intend a Codex host MCP/tool allowlist for Manual server key `geldmacher-workflow` in `.mcp.json`. The preference still grants nothing. |

`workflow_status.host_tool_approval` is non-authoritative advisory metadata (`grants_host_approval: false`). Configure Codex separately when using `allowlisted`, for example:

```toml
[plugins."geldmacher-workflow@local".mcp_servers.geldmacher-workflow]
default_tools_approval_mode = "writes"
```

`writes` uses the Manual tools' `readOnlyHint` annotations. Prefer that over blanket `auto` unless you trust every Manual tool. Host sandbox and human approvals remain authoritative; Workflow never writes Codex settings.

Optional `manual_subagent_policy` may configure ordered concrete Codex candidates with parent fallback. Missing or invalid policy stays parent-only and continues to reject explicit Child model overrides. See [manual subagent policy](./manual-subagent-policy.md).

Every skill must read the shared [Manual Workflow contract](./manual-workflow-contract.md) and the task-specific Schema-5 references it names before acting.

Codex lifecycle state retains exact Root, generated Evidence, and emitted Review bytes under the exact Root-content hash. Native correction closeout therefore does not depend on MCP Roots/workspace binding or a successful prior `workflow_artifact_record`. Caller `changed_paths` are omitted or ignored as non-authoritative hints; the Hook owns the complete repository inventory and surfaces classified failures such as missing Source Review, immutable text conflict, Authority violation, repository observation conflict, or Evidence-lineage conflict directly in the Stop response.

Required machine Checks are attested behind their existing Codex tool calls. Receipts bind the exact Root, command, directory, and current repository snapshot without raw output, expire after 24 hours, and are purged after persisted closeout. Missing or invalid proof becomes a current-delivery Problem with one rerun; it never adds a human setup step.
