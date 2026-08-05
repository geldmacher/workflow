# Codex Manual Facade

Workflow on Codex implements only the Manual profile. It uses Codex Plan mode and `<proposed_plan>` for planning, installable `$skill-name` invocations, the bundled five-tool Manual MCP, built-in subagents without model overrides, and Codex lifecycle hooks.

The host sandbox and human approvals remain authoritative. There is no Controller preparation, adaptive Run, route pool, background watcher, verification profile, credential bridge, automatic merge, push, publication, or deployment.

Every skill must read the shared [Manual Workflow contract](./manual-workflow-contract.md) and the task-specific Schema-5 references it names before acting.
