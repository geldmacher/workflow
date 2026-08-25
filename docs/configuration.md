# Configuration

Workflow 6 minimizes Workflow-owned configuration. Hosts and project harnesses configure their own tools, models, framework commands, sandboxing, worktrees, retries, and verification strategy.

Current versions:

- Plugin 6.0.0
- Artifact Schema 6
- Controller Protocol 6
- Harness Capability Receipt Schema 1

## External Host Adapter

Automation is protected only when the host configures `GELDMACHER_WORKFLOW_HOST_ADAPTER_MODULE` with an absolute, canonical, non-symlink module path outside the project workspace. The external adapter owns Harness resolution, host policy, receipt storage, deployment identity, and transition recovery. `GELDMACHER_WORKFLOW_HARNESS_MODULE` is merely an opaque locator passed to that adapter; Workflow never imports it.

The adapter returns one binding with `harnessId` and `deploymentBindingHash`. `protectedCapability` is one atomic, idempotent host operation for the exact deployment and workspace. Only transition-bound PhaseResults use `stagePhase`, `recoverPhase`, and `commitPhase`. The deployment hash must change whenever the Harness deployment or host policy changes. Without that adapter—or when loading or protection fails—the requested phase stays Shadow/provisional and ordinary host use remains available.

Workflow validates only the generic closed payload contracts and opaque protected references. It does not inspect the adapter's receipt material or the Harness's commands, tools, models, or internal strategy.

## Shared transport

`GELDMACHER_WORKFLOW_HOME` relocates the shared content-addressed artifact home. `GELDMACHER_WORKFLOW_SHARED_ROOT` relocates its handoff/state base. Cursor binds its operational workspace through MCP Roots and the host workspace locator; Codex uses MCP Roots and plugin-local operational state.

Transport never grants Root or implementation authority.

## Host settings

Workflow does not own or write Cursor/Codex approval, model, shell, network, or sandbox configuration. Configure those directly in the host or project harness. A host failure blocks only the affected Workflow phase or lowers evidence.

## Capability and qualification

A generic Capability Receipt binds Harness identity and version, exact deployment identity, workspace, declared lifecycle capabilities, policy hash, validity interval, optional qualification keys, and protected receipt hash. Autonomous Roots bind one exact Qualification Key, protected Capability hash, verification-intent hash, and certified region. A new deployment hash invalidates the previous Capability and qualification binding even when module paths are unchanged.

There are no Workflow model pools, Verification Profiles, task recipes, controller-owned worktrees, command runners, or retry configurations.
