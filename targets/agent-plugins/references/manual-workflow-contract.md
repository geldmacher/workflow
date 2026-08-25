# Portable Manual Workflow contract

This contract preserves Workflow's Manual Schema-6 lifecycle on Agent Plugins clients. The client discovers skills and MCP components through the standard package; the project harness owns every concrete execution choice.

## Authority

- Planning, implementation, correction, review, provisional acceptance, and learning are separate human-authorized actions.
- The exact current-conversation Schema-6 Root and artifact chain are authority. MCP persistence is transport only; every other artifact schema is unsupported.
- Portable plan presentation and implementation use `workflow_plan_preflight` for structural validation; the human separately approves implementation.
- Review and explanation are repository-read-only. The harness chooses inspection details and returns protected attestations.
- No action automatically merges, pushes, publishes, deploys, installs, changes host settings, or grants permissions.

## Artifact flow

1. `plan-work` creates one exact Schema-6 `work-plan` Root with a visible `wp-*` ID and obtains exact MCP preflight.
2. The human separately invokes `implement-work` with that approved Root available.
3. Implementation re-runs exact preflight, stays inside Root authority, and finishes without creating Evidence.
4. `review-work` declares repository-read-only intent; the project harness returns bound snapshots and Check attestations.
5. Review passes closed Schema-1 semantic input to `workflow_closeout`; the host builds Schema-6 Evidence and Review atomically.
6. `work-status` derives state from the exact chain. Provisional acceptance, correction, and learning remain separate invocations.

Verified claims require protected harness attestations bound to Check intent, exact Root, workspace, and snapshot. Missing attestation stays provisional; attested failure stays failed; contradictory binding is rejected. Workflow never inspects command, tool, model, framework, sandbox, worktree, retry, or route data.

## Failure boundary

Invalid, stale, conflicting, mixed-version, or ambiguous Roots and workspace bindings stop only the affected phase. Harness or MCP unavailability lowers Evidence or blocks that phase without blocking ordinary client use. Prose, cache content, tool IDs, or opaque trace cannot manufacture approval, Evidence, or success.
