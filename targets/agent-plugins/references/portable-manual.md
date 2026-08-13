# Portable Manual facade

This Agent Plugins target implements only Workflow's Manual profile. Agent Plugins standardizes skill and MCP discovery, not host lifecycle hooks, plan modes, permission prompts, model routing, or repository safeguards.

## Hard boundaries

- The human authorizes planning, implementation, correction, review, provisional acceptance, and learning as separate actions.
- The exact Schema-5 Root text in the current conversation is authority. Cached MCP artifacts are transport enrichment only.
- `workflow_plan_preflight` is mandatory before a portable plan is presented and again before portable implementation starts. It must return `feasible: true`, no blocking issues, and the same visible Root ID.
- `workflow_closeout` is mandatory after implementation, correction, or recovery closeout. Its returned exact Evidence is the only portable closeout result; prose cannot substitute for it.
- Agent Plugins does not standardize native receipt hooks. Without compatible protected host receipts, required machine claims downgrade honestly and fresh review sees the current-delivery limitation; no additional user-maintained field or repeated command can manufacture verification.
- The client sandbox, permission system, and human approvals remain authoritative. A skill never grants itself permissions.
- If the MCP server, exact Root, workspace identity, baseline, required Check evidence, or chain is missing, invalid, conflicting, stale, or ambiguous, stop. Do not simulate a native guard or fabricate Evidence.
- Review and explanation do not edit the repository. Correction and learning require their own explicit skill invocation.
- Optional subagents inherit the current primary model when the client supports inheritance. Do not select or silently remap a child model. The primary agent verifies every advisory result.
- No action may merge, push, publish, deploy, install, or create external effects unless a separate user request grants that authority outside Workflow.

## Portable flow

1. `plan-work` constructs one exact Root and obtains mandatory MCP preflight.
2. The human approves that Root by separately invoking `implement-work` with the exact Root available.
3. `implement-work` revalidates preflight, captures the repository baseline, implements within authority, runs Checks, and calls `workflow_closeout`.
4. A fresh `review-work` invocation inspects the exact Root/Evidence chain read-only and emits the Review.
5. `correct-work`, `accept-work`, and `learn-from-work` remain separate human decisions.

If one read-only recovery proves that Evidence cannot exist after mutation because the baseline, Root binding, workspace identity, or Authority boundary was lost, `review-work` may emit the constrained root-boundary Review only when the client supplies and validates a protected short-lived host receipt bound to the exact Root and current repository snapshot. Portable skill execution cannot mint that trust and must otherwise fail closed. The Review's sole action is a separately approved lineage-preserving replan; it grants no correction, acceptance, achievement, or Learning authority.

All MCP persistence must remain below the client-provided `PLUGIN_DATA`. The package is immutable runtime material below `PLUGIN_ROOT`.

Human-facing closeout, status, and review use one primary journey action. IDs, paths, receipts, and `enforcement_level: explicit` live in secondary Technical traceability. Human attention and Problems appear only when actionable and explain why plus one recovery. Receipts, when available, contain hashes rather than raw command output and never create cross-delivery analytics or automatic learning.
