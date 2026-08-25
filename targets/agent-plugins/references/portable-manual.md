# Portable Manual facade

This Agent Plugins target implements Workflow's Manual Schema-6 lifecycle. Agent Plugins standardizes skill and MCP discovery; the client and project harness own permissions and all concrete execution.

## Hard boundaries

- The human authorizes planning, implementation, correction, review, provisional acceptance, and learning as separate actions.
- The exact Schema-6 Root text in the current conversation is authority. Cached MCP artifacts are transport enrichment only. Every other artifact schema is unsupported.
- `workflow_plan_preflight` validates the exact portable Root but grants no approval.
- Fresh `review-work` calls `workflow_closeout` in work-review mode; Evidence and Review are created atomically.
- Missing compatible protected harness attestations cap Evidence at provisional. Repetition or user-authored trace cannot manufacture verification.
- The client sandbox, permission system, and human approvals remain authoritative. A skill never grants itself permissions.
- If the exact Root or workspace binding is invalid, conflicting, stale, or ambiguous, stop only the affected phase. Missing harness evidence is a limitation, not an invented missing Root.
- Review and explanation do not edit the repository. Correction and learning require their own explicit skill invocation.
- No action may merge, push, publish, deploy, install, or create external effects unless a separate user request grants that authority outside Workflow.

## Portable flow

1. `plan-work` constructs one exact Schema-6 Root and obtains MCP preflight.
2. The human approves that Root by separately invoking `implement-work` with the exact Root available.
3. `implement-work` revalidates preflight and implements outcomes inside Root authority using the active project harness.
4. `review-work` declares repository-read-only intent; the harness returns protected snapshots and Check attestations, and `workflow_closeout` builds Evidence plus Review.
5. `correct-work`, `accept-work`, and `learn-from-work` remain separate human decisions.

All MCP persistence must remain below the client-provided `PLUGIN_DATA`. The package is immutable runtime material below `PLUGIN_ROOT`.

Human-facing status and review lead with outcome, limitations, and one lifecycle action. IDs, paths, receipts, and hashes stay in secondary technical traceability. Opaque execution trace is never interpreted as authority.
