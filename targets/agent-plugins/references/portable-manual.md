# Portable Manual facade

This Agent Plugins target implements Workflow's complete Skills-first Manual Schema-6 lifecycle. Agent Plugins standardizes Skill and optional MCP discovery; the client and project harness own permissions and all concrete execution.

## Hard boundaries

- The human separately authorizes planning, implementation, correction, review, provisional acceptance, and learning.
- Exact Schema-6 bytes in the current conversation are the normal Manual transport. A fresh task requires explicit attachment of the current Root and every referenced artifact. Cache, MCP state, hooks, random server values, and IDs without bytes are not authority.
- The bundled `${PLUGIN_ROOT}/dist/manual-workflow.mjs` program validates Roots, atomically builds Evidence/Review, derives Manual status, and performs ephemeral provisional acceptance without MCP or persistent state. Ordinary repository-internal scope drift remains visible and provisional; protected, approval-required, or escaping paths remain blocking.
- The project harness owns every repository discovery, command, tool, model, framework, sandbox, worktree, retry, and verification choice. The local builder consumes only closed opaque observations.
- Unprotected observations are capped to `supported`, `partial`, `unavailable`, or `failed`. They never become verified. Failed required Checks remain blocking.
- Invalid, stale, foreign, mixed, conflicting, or ambiguous input returns Shadow with no pseudo-artifact and affects only the requested phase.
- The client sandbox, permission system, and human approvals remain authoritative. A Skill never grants itself permissions.
- Review and explanation do not edit the repository. Correction and learning require their own explicit invocation.
- No action may merge, push, publish, deploy, install, or create external effects unless a separate user request grants that authority outside Workflow.

## Portable flow

1. `plan-work` constructs one exact Schema-6 Root and validates it through the local builder.
2. The human approves that Root by separately invoking `implement-work` with the exact Root available.
3. `implement-work` implements outcomes inside Root authority using the active project harness and creates no Evidence or state.
4. `review-work` declares repository-read-only intent and passes closed unprotected observations to the local builder, which returns exact Evidence and Review artifacts atomically.
5. `correct-work`, replan, another Review, `accept-work`, and `learn-from-work` remain separate human decisions.

The MCP server remains registered for optional automation-compatible status and protected sealing. MCP, adapter, Root, timeout, or hook failure never changes Manual status or ordinary client availability. Protected sealing may append a new pair but never modifies existing Manual artifacts.

Every local request sets `presentation_locale` to `de` only when the human's active request is German and otherwise uses `en`. Locale changes fixed presentation text only. Human output leads with one decision, concrete reason, required-Check outcome, scope impact, at most one proof boundary, and one next action. Full findings, Checks, distinct limitations, paths, IDs, and hashes remain once in default-closed details. Review places each exact artifact text once, unchanged and unquoted, in its own default-closed disclosure block. Opaque execution trace is never interpreted as authority.

The builder retains canonical action tokens. The portable facade decorates only the operation's authoritative token through the complete fixed portable mapping in the shared Manual Workflow contract; that contract is the single mapping source. The facade never invents another assessment, fallback mapping, or action. It shows the host action as the one human next action and retains the canonical token as technical traceability. Implementation and correction handoffs report only phase completion with fresh `review-work` pending, never delivery or Workflow completion.
