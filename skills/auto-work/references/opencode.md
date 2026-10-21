# OpenCode delegation

Use OpenCode 2.1.2. Launch child work with the `subagent` tool: agent id, a short description, and a complete prompt. Built-in agents are `build` (primary), `plan` (primary; it does not edit normal project files), `general` (subagent; it cannot launch subagents), and `explore` (subagent, read-only). Do not use a Task tool or a `subagent_type` field.

`experimental.subagent_depth` defaults to 1, so a subagent cannot start another subagent. Delegate Plan, Implement, Review, and Correct from the primary session unless the user has raised that depth. The Cursor and Codex notes in [agents](agents.md) do not apply here.

Select a skill explicitly with `@skill-id` or `/skill-id`. Leave model auto-invocation enabled.
