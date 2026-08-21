# Manual MCP output contract

Manual MCP tools keep `structuredContent` as the authoritative machine contract. Existing keys remain stable; `presentation` is additive Schema-1 metadata for [human-first output](./human-output-contract.md).

## Content vs structuredContent

- `content[0].text` renders `Quick decision`, then human `Details`, then a bounded non-authoritative `Agent and machine index` pointing to complete `structuredContent`. The first layer contains journey state, outcome, required-Check summary, at most one blocker, and either one actionable Next step or an explicit terminal block with no action. `Details` deterministically projects the exact current Root/artifacts into outcome and approach, scope and boundaries, then verification, risks, uncertainty, and recovery; missing inputs are stated explicitly rather than silently omitted.
- `content[0].text` never duplicates full Root/Evidence artifact text or pretty-printed JSON.
- Contextual help, when present, renders exactly one `Meaning:` sentence and one `Learn more:` Markdown link inside the final technical index.
- `structuredContent` retains every existing field plus optional `presentation`.
- Exact artifacts remain in `structuredContent.artifact` or `structuredContent.artifacts`.
- Status presentation may add `presentation.workflow_state`; it never replaces `structuredContent.snapshot.state`.
- Set `GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT=1` to restore JSON text in `content` for one transition release.

## Severity

| Severity | Examples | Treatment |
|---|---|---|
| Advisory | preflight advisories, host tool-approval preference, model-inheritance diagnostics | Informational; never blocks |
| Warning | `handoff_persisted: false`, optional workspace binding unavailable | Task-local success path; follow-up only for deliberate cross-task export |
| Error / blocker | preflight blockers, invalid/ambiguous chains, thrown tool errors, blocked/failed closeout Evidence | Lead summary; block the action |

## Closeout and status honesty

Distinguish **tool success**, **delivery semantics**, and **transport follow-up**:

- Tool success: `isError === false` and a valid artifact or status payload is returned.
- Delivery semantics drive `presentation.outcome`: blocked/failed Evidence → `blocked`; provisional/partial/unavailable/supported Evidence → `partial`; complete verified Evidence → `ready` even when handoff persistence fails.
- Transport warning: `handoff_persisted: false` stays secondary and keeps `next_action: review-root` when exact Evidence is retained by the current task. `attach-artifact` is reserved for a deliberate cross-task or cross-host export.
- Blocked or failed closeout next action is `review-root`, never `none`.
- Closeout checks include evidence mode, handoff persistence, and a bounded `changed_paths` preview (count plus at most ten paths). `structuredContent.changed_paths` retains the complete unchanged array.
- `workflow_status` outcome: blockers or terminal blocked/stopped/failed → `blocked`; `achieved` or `accepted-provisional` → `ready`; every other actionable nonterminal state (including `delivery-ready-provisional`) → `partial`.
- `workflow_status` renders `host_tool_approval.tool_approval` as readable text and must never emit `[object Object]`.

## Agent chat and native Plan presentation

- Manual phases lead with outcome, checks, and gaps. Actionable phases end with the Next-step footer; terminal status uses the compact state-specific completion block before any required machine attestation fence.
- Every emitted review adds a self-contained explanation in this order: `Quick decision`; `Details` containing `What was achieved`, `What this means`, and `Verification and limits`; then the agent-authored `Agent and machine contract` containing `Technical traceability`. MCP tool text uses its final index instead because the exact contract already exists in `structuredContent`. The current reviewer produces the reply directly; `/explain-work` remains an optional read-only refresh. Only `achieved` is **Final repository explanation**; other reviewed states are **Preliminary explanation** with blockers and next safe action.
- Never duplicate full Root/Evidence/Review text in chat when the exact copy already lives in the Plan envelope or `structuredContent`. Preserve exact IDs and hashes in the final index; include raw bytes only for an explicitly requested cross-task or cross-host export without exact handoff transport.
- Always surface authoritative IDs (`wp-*`, `de-*`, `wr-*`) in the last agent and machine layer. Attach an exact artifact only when the user intentionally leaves the current task and optional handoff cannot transport it.
- A blocker must be plain language in the primary layer as `Blocker: <reason>` followed by `Resolution: <one practical recovery>`. Keep the raw error code or parser detail in Technical traceability.
- Compact prose, lists, or tables are valid for low/medium Manual Intent/Acceptance/Boundaries/Risks; Verification remains an explicit table at presentation. High-risk, Hard-Trigger, and controller preparation stay fail-closed.

## Next-step footer

Actionable human-facing Manual MCP text and agent chat must end with this recognizable block (canonical English; agents may localize prose while keeping command tokens exact):

```text
### Next step
- Now: <label>
- How: <exact invoke>
- Why: <benefit>
- Off track: <reason> → <recovery>
```

For blocked or partial output, place the plain `Blocker:` and `Resolution:` immediately before this footer. `Off track` remains a compatible optional compact rendering of the same information; do not duplicate it when Blocker/Resolution are already present. The footer closes `Quick decision`; human `Details` and then one `Agent and machine index` disclosure follow. Portable-client compatibility attestations may follow only when that client contract explicitly requires them. Cursor and Codex Manual add none.

Terminal `workflow_status` is deliberately shorter:

- `workflow_state: achieved` with `next_action: none` uses `### Done` plus one sentence that repository delivery is complete; `/learn-from-work` and a refreshed `/explain-work` remain optional.
- `workflow_state: accepted-provisional` with `next_action: none` uses `### Accepted provisionally` and states that acceptance is not persisted and later status returns `delivery-ready-provisional`.
- Failed, blocked, partial, or otherwise actionable output never uses either terminal block and never reports `next_action: none`; reuse an existing recovery action.

### Action catalog

Stable `next_action` ids and their default invoke/benefit/recovery copy:

| action | Now (label) | How | Why | Default Off track |
|---|---|---|---|---|
| `repair-root` | Repair the Root | Plan: fix blockers, then `/plan-work` or `$plan-work` again | Makes the Root feasible before approval | Root infeasible → resolve blocking issues, then re-validate |
| `implement-plan` | Implement the Plan | Human: native **Implement Plan** (approves the presented Root) | Delivers inside the approved Root and finishes normally | No approved Root → finish Plan presentation first |
| `attach-artifact` | Export the exact artifact | Agent: attach exact Root/Evidence text only for intentional continuation in another task/host | Exports the chain when optional handoff is unavailable | Stay in the current task, or paste the exact bytes into the chosen new task |
| `review-root` | Review delivery | Current task, read-only phase: run `/review-work` or `$review-work` against the exact task-local chain | Produces a fresh verdict without requiring a new task/chat | Missing Evidence → Review attempts one internal recovery first |
| `accept-provisional` | Accept provisional delivery | Ask/Agent: `/accept-work provisional` or `$accept-work provisional` only for an explicit provisional acceptance | Records a one-time human acceptance of an evidence gap | Not provisional → run fresh review first |
| `closeout` | Portable Evidence build | Compatible portable client: call `workflow_closeout` delivery-evidence mode | Preserves the legacy portable transport without affecting native Manual lifecycle | Cursor/Codex → use fresh Review instead |
| `correct` | Fix failing Checks | Agent: repair failing required Checks, then closeout again | Restores a deliverable Evidence grade | Intent/scope change → `/plan-work replan` or `$plan-work replan` instead |
| `approve-correction` | Apply bounded correction | Agent: `/correct-work` or `$correct-work`, then review again in the same task | Applies only the review-approved in-scope FIX set | No actionable `cp-*` → run `/review-work` first |
| `provide-artifacts` | Supply artifact chain | Ask/Agent: pass current Schema-5 Root/Evidence/Review to `workflow_status` | Derives status without inventing tips | Ambiguous tips → pass explicit `wp-*` plus exact artifacts |
| `replan` | Replan the Root | Plan: `/plan-work replan` or `$plan-work replan`, then approve the replacement | Creates a new approval boundary when Intent must change | Review lacks `next_action: replan` → run fresh review first |
| `retry-review` | Retry review | Current task, read-only phase: rerun `/review-work` or `$review-work` with updated evidence | Reassesses once Evidence or context is complete | Resolve the named task-local evidence gap, then retry |
| `answer` | Answer clarification | Ask: answer the open review clarification | Unblocks a human decision without mutating delivery | No open clarify → run `/work-status` or `$work-status` |
| `resolve-intent` | Resolve intent | Plan: answer open intent questions or replan | Restores Intent Readiness before a Root is presented | Unclear goal → `/plan-work <goal>` with decisive answers |
| `none` | Done | No further Workflow command required | Delivery is complete for this Root | Optional: `/learn-from-work` / `$learn-from-work` or `/explain-work` / `$explain-work` |
| `learn` | Persist learnings | Agent: `/learn-from-work` or `$learn-from-work` | Captures confirmed reusable guidance after earned delivery | Not verified/achieved → finish verified review; provisional acceptance does not authorize Learning |
| `explain` | Explain the chain | Ask: `/explain-work` or `$explain-work` | Translates the Root/Evidence/Review chain for humans | Missing chain → `/work-status` or supply artifacts |

## Presentation fields

`presentation.schema` is `1`. Required fields: `tool`, `phase`, `outcome` (`ready|blocked|partial|failed`), `summary`, `checks`, `gaps`, `advisories`, `warnings`, `errors`, `next_action`, `next_action_label`, `journey_state`, `enforcement_level`, `primary_action`, and `technical_traceability`. When a valid Root is available, `presentation.human_projection` is Schema 1 with `outcome`, `approach_and_rationale`, `in_scope`, `non_goals`, `constraints`, `acceptance_and_verification`, `risks_and_tradeoffs`, and `unknowns_and_recovery`. The renderer derives both human layers plus the final visible machine index without changing the authoritative payload or duplicating exact artifact bytes.

`journey_state` is one of `plan-ready|implementation-active|closeout-recovery-required|review-ready|review-active|correction-approval-required|replan-approval-required|provisional-acceptance-required|clarification-required|blocked|done`. `enforcement_level` is `host-native|explicit`. `primary_action` is exactly `{ id, label, invoke, why }` or `null`; it is the only primary action. `technical_traceability` carries Root/Evidence/Review/Correction IDs, Checks, Findings, paths, and enforcement detail. `deduplication_key` is deterministically derived from Root, journey state, first problem, and action so hosts can coalesce repeated messages.

Compatibility fields remain: `next_action_invoke`, `next_action_benefit`, and, when Off track applies, `next_action_blocked_reason`, `next_action_recovery`. Optional contextual help is `help: { topic, meaning, label, url }`; `label` is `Manual Workflow guide`, and `url` uses `https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md` plus a validated topic anchor. `workflow_status` additionally sets optional `workflow_state` from the derived snapshot and includes the uniform read-only `learning` projection. Keep `next_action` and `next_action_label` stable.
