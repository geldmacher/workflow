# Workflow — Agent Plugins v1 target

This package provides Workflow's portable Manual profile through nine Agent Skills and five MCP tools. It targets Agent Plugins Specification 1.0.0.

## Requirements

Use an Agent Plugins v1 client that discovers Agent Skills and supports stdio MCP servers. Node.js 22 or newer must be available as the bare `node` executable. When launching the bundled server, the client must provide and expand `PLUGIN_ROOT` and `PLUGIN_DATA` as defined by Agent Plugins v1.

The human separately authorizes planning, implementation, correction, review, provisional acceptance, and learning. Planning and implementation require the exact Schema-5 Root to pass the bundled MCP preflight. Implementation and correction finish through deterministic MCP closeout. Missing MCP support, ambiguous workspace roots, invalid chains, or unavailable authority checks stop the action.

The package contains no controller profiles, host hooks, commands, agents, model routing, automatic merge, push, publication, deployment, or host installation logic. Persistent Workflow transport state is isolated below the client-provided `PLUGIN_DATA`; package files are resolved below `PLUGIN_ROOT`.

This artifact is repository-validated only. A compatible-client smoke, installation, and publication are separate environment-specific steps and are not implied by the build.

See the [Agent Plugins v1 specification](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md) and the project [Manual Workflow guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md).
