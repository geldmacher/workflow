# Manual MCP output contract

Manual MCP tools keep `structuredContent` as the authoritative machine contract. Existing keys remain stable; `presentation` is additive Schema-1 metadata for calm human/agent summaries.

## Content vs structuredContent

- `content[0].text` leads with outcome, checks, gaps/blockers, advisories or warnings, then ends with the Next-step footer.
- `content[0].text` never duplicates full Root/Evidence artifact text or pretty-printed JSON.
- Contextual help, when present, renders exactly one `Meaning:` sentence and one `Learn more:` Markdown link before the final Next-step or terminal block.
- `structuredContent` retains every existing field plus optional `presentation`.
- Exact artifacts remain in `structuredContent.artifact` or `structuredContent.artifacts`.
- Status presentation may add `presentation.workflow_state`; it never replaces `structuredContent.snapshot.state`.
- Set `GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT=1` to restore JSON text in `content` for one transition release.

## Severity

| Severity | Examples | Treatment |
|---|---|---|
| Advisory | preflight advisories, host tool-approval preference, model-inheritance diagnostics | Informational; never blocks |
| Warning | `handoff_persisted: false`, workspace binding unavailable, attach instructions | Success path with required follow-up |
| Error / blocker | preflight blockers, invalid/ambiguous chains, thrown tool errors, blocked/failed closeout Evidence | Lead summary; block the action |

## Closeout and status honesty

Distinguish **tool success**, **delivery semantics**, and **transport follow-up**:

- Tool success: `isError === false` and a valid artifact or status payload is returned.
- Delivery semantics drive `presentation.outcome`: blocked/failed Evidence → `blocked`; provisional/partial/unavailable/supported Evidence → `partial`; complete verified Evidence → `ready` even when handoff persistence fails.
- Transport follow-up: `handoff_persisted: false` adds an attach gap/warning and may set `next_action: attach-artifact`; it does not downgrade verified Evidence to `partial`.
- Blocked or failed closeout next action is `review-root`, never `none`.
- Closeout checks include evidence mode, handoff persistence, and a bounded `changed_paths` preview (count plus at most ten paths). `structuredContent.changed_paths` retains the complete unchanged array.
- `workflow_status` outcome: blockers or terminal blocked/stopped/failed → `blocked`; `achieved` or `accepted-provisional` → `ready`; every other actionable nonterminal state (including `delivery-ready-provisional`) → `partial`.
- `workflow_status` renders `host_tool_approval.tool_approval` as readable text and must never emit `[object Object]`.

## Agent chat and native Plan presentation

- Manual phases lead with outcome, checks, and gaps. Actionable phases end with the Next-step footer; terminal status uses the compact state-specific completion block before any required machine attestation fence.
- Every emitted review adds a self-contained explanation in this order: `What was achieved`, `What this means`, `Verification and limits`, then `Technical traceability`. The current reviewer produces it directly; `/explain-work` remains an optional read-only refresh. Only `achieved` is **Final repository explanation**; other reviewed states are **Preliminary explanation** with blockers and next safe action.
- Never duplicate full Root/Evidence text in chat when the exact copy already lives in the Plan envelope or `structuredContent.artifact`.
- Always surface authoritative IDs (`wp-*`, `de-*`, `wr-*`) and attach the exact artifact when `handoff_persisted: false`.
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

Omit `Off track` unless `presentation.outcome` is `blocked` or `partial` and a recovery path exists. Place the footer last in human-facing prose; only required typed attestation fences may follow.

Terminal `workflow_status` is deliberately shorter:

- `workflow_state: achieved` with `next_action: none` uses `### Done` plus one sentence that repository delivery is complete; `/learn-from-work` and a refreshed `/explain-work` remain optional.
- `workflow_state: accepted-provisional` with `next_action: none` uses `### Accepted provisionally` and states that acceptance is not persisted and later status returns `delivery-ready-provisional`.
- Failed, blocked, partial, or otherwise actionable output never uses either terminal block and never reports `next_action: none`; reuse an existing recovery action.

### Action catalog

Stable `next_action` ids and their default invoke/benefit/recovery copy:

| action | Now (label) | How | Why | Default Off track |
|---|---|---|---|---|
| `repair-root` | Repair the Root | Plan: fix blockers, then `/plan-work` or `$plan-work` again | Makes the Root feasible before approval | Root infeasible → resolve blocking issues, then re-validate |
| `implement-plan` | Implement the Plan | Human: native **Implement Plan** (approves the presented Root) | Delivers inside the approved Root and runs deterministic closeout | No approved Root → finish Plan presentation first |
| `attach-artifact` | Attach the exact artifact | Agent: attach exact Root/Evidence text to the next Workflow command | Preserves the chain when handoff transport is unavailable | Missing attach → paste exact artifact bytes before review/status |
| `review-root` | Fresh review | Ask: run a fresh `/review-work` or `$review-work` against the exact Root/Evidence chain | Produces a fresh verdict without Writer assumptions | No Evidence → `/close-work [wp-id]` or `$close-work` first |
| `accept-provisional` | Accept provisional delivery | Ask/Agent: `/accept-work provisional` or `$accept-work provisional` only for an explicit provisional acceptance | Records a one-time human acceptance of an evidence gap | Not provisional → run fresh review first |
| `closeout` | Deterministic closeout | Agent: `/close-work [wp-id]` or `$close-work`, or finish Implement Plan closeout | Builds validated Evidence from observed Checks | Missing Root/chain → supply exact artifacts, then retry |
| `correct` | Fix failing Checks | Agent: repair failing required Checks, then closeout again | Restores a deliverable Evidence grade | Intent/scope change → `/plan-work replan` or `$plan-work replan` instead |
| `approve-correction` | Apply bounded correction | Agent: `/correct-work` or `$correct-work`, then Ask: fresh review | Applies only the review-approved in-scope FIX set | No actionable `cp-*` → run `/review-work` first |
| `provide-artifacts` | Supply artifact chain | Ask/Agent: pass current Schema-5 Root/Evidence/Review to `workflow_status` | Derives status without inventing tips | Ambiguous tips → pass explicit `wp-*` plus exact artifacts |
| `replan` | Replan the Root | Plan: `/plan-work replan` or `$plan-work replan`, then approve the replacement | Creates a new approval boundary when Intent must change | Review lacks `next_action: replan` → run fresh review first |
| `retry-review` | Retry review | Ask: fresh `/review-work` or `$review-work` with complete evidence | Reassesses once Evidence or context is complete | Evidence still missing → closeout or attach first |
| `answer` | Answer clarification | Ask: answer the open review clarification | Unblocks a human decision without mutating delivery | No open clarify → run `/work-status` or `$work-status` |
| `resolve-intent` | Resolve intent | Plan: answer open intent questions or replan | Restores Intent Readiness before a Root is presented | Unclear goal → `/plan-work <goal>` with decisive answers |
| `none` | Done | No further Workflow command required | Delivery is complete for this Root | Optional: `/learn-from-work` / `$learn-from-work` or `/explain-work` / `$explain-work` |
| `learn` | Persist learnings | Agent: `/learn-from-work` or `$learn-from-work` | Captures confirmed reusable guidance after earned delivery | Not verified/achieved → finish verified review; provisional acceptance does not authorize Learning |
| `explain` | Explain the chain | Ask: `/explain-work` or `$explain-work` | Translates the Root/Evidence/Review chain for humans | Missing chain → `/work-status` or supply artifacts |

## Presentation fields

`presentation.schema` is `1`. Required fields: `tool`, `phase`, `outcome` (`ready|blocked|partial|failed`), `summary`, `checks`, `gaps`, `advisories`, `warnings`, `errors`, `next_action`, `next_action_label`.

Additive fields (always set when a catalog action is known): `next_action_invoke`, `next_action_benefit`. When Off track applies: `next_action_blocked_reason`, `next_action_recovery`. Optional contextual help is `help: { topic, meaning, label, url }`; `label` is `Manual Workflow guide`, and `url` uses `https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md` plus a validated topic anchor. `workflow_status` additionally sets optional `workflow_state` from the derived snapshot so terminal formatting never guesses from prose, and its structured response includes the uniform read-only `learning` projection. Keep `next_action` and `next_action_label` stable for compatibility; `next_action_label` remains the short Now/How summary line.
