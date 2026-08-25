---
name: implement-work
description: Implement one approved portable Schema-6 Root under separate human authorization.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Implement work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [executable contract](../../../../references/executable-contract.md) completely.

Treat this explicit invocation as implementation authority only for one exact Schema-6 Root present in the current conversation. Require an unambiguous workspace and call `workflow_plan_preflight` with the exact Root. Proceed only when it is feasible and returns the same Root ID.

Preserve unrelated changes and remain inside Root authority. New scope, protected paths, dependencies, external effects, risk, or acceptance requires a new human-approved Root.

Implement the approved outcomes. The active project harness chooses all commands, tools, models, working directories, sandboxes, worktrees, retries, and verification strategy. Workflow does not assess or prescribe those choices.

Finish normally without creating Evidence and route to fresh `review-work`. Repository observations remain trace until protected harness attestations bind them to Root, workspace, verification intent, and snapshot. Do not merge, push, publish, deploy, install, or create external effects.
