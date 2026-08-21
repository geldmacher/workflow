# Portable Manual Workflow contract

This contract preserves Workflow's Schema-5 Manual semantics on Agent Plugins clients. The client discovers skills and MCP components through the standard package; it does not gain native hooks, plan modes, permissions, model routing, or controller automation.

## Authority

- Planning, implementation, correction, review, provisional acceptance, and learning are separate human-authorized actions.
- The exact current-conversation Schema-5 Root and artifact chain are authority. MCP persistence is transport only.
- Portable plan presentation and implementation require successful `workflow_plan_preflight` for the exact Root. Implementation, correction, and recovery require `workflow_closeout`.
- Review and explanation are repository-read-only. Optional subagents inherit the primary model and remain advisory until the primary verifies their claims.
- No action automatically merges, pushes, publishes, deploys, installs, changes host settings, or grants permissions.

## Artifact flow

1. `plan-work` creates one exact Schema-5 `work-plan` Root with a visible `wp-*` ID and obtains exact MCP preflight.
2. The human separately invokes `implement-work` with that approved Root available.
3. Implementation re-runs exact preflight, captures the pre-mutation baseline, stays inside authority, observes every required Check, and calls `workflow_closeout`.
4. The returned exact Schema-5 `delivery-evidence` artifact is the portable closeout result.
5. In the same task by default, `review-work` compares the exact chain read-only and passes closed Schema-1 input to `workflow_closeout` in `work-review` mode; the host builds the authoritative Review.
6. `work-status` derives state from the exact chain. Provisional acceptance, correction, and learning remain separate invocations.

Required machine claims are verified only by fresh protected host receipts bound to the exact Root, command, directory, and repository snapshot. Agent Plugins clients without compatible lifecycle hooks receive an honest MCP downgrade; they never simulate receipts. Closeout, status, and review expose current-delivery coverage, actionable human attention, Problems with cause and recovery, and one next action.

## Human-facing output

Every material reply follows [human-first output](./human-output-contract.md): `Quick decision`, complete human `Details`, then the authoritative `Agent and machine contract`. The human layers add no authority. For MCP tool results, inspect the complete authoritative `structuredContent`; the visible final machine index is a non-authoritative pointer, not a substitute.

## Failure boundary

Invalid, incomplete, stale, conflicting, mixed-version, redirected, or ambiguous Roots, workspace identity, baselines, Check observations, or artifact chains stop the action. Missing MCP capability stops planning or closeout where it is mandatory. Prose, cache content, tool IDs, or subagent claims cannot substitute for exact artifacts or manufacture approval, Evidence, or success.
