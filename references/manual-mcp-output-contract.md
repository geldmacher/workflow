# Manual MCP output contract

Manual MCP tools keep `structuredContent` as the authoritative machine contract. Existing keys remain stable; `presentation` is additive Schema-1 metadata for calm human/agent summaries.

## Content vs structuredContent

- `content[0].text` leads with one of six human phases (`Plan ready`, `In progress`, `Review needed`, `Decision needed`, `Blocked`, `Completed`). `Quick decision` then states outcome, required-Check summary, at most one limitation, a blocker only when the current transition is actually prevented, and exactly one host-correct action or honest completion.
- Human text has three layers: `Quick decision`, `Details`, and `Agent and machine contract (authoritative)` with bounded `Technical traceability`.
- `content[0].text` never duplicates full Root/Evidence artifact text or pretty-printed JSON.
- Contextual help, when present, renders exactly one `Meaning:` sentence and one `Learn more:` Markdown link inside secondary technical traceability.
- `structuredContent` retains every existing field plus optional `presentation`.
- Exact artifacts remain in `structuredContent.artifact` or `structuredContent.artifacts`.
- Status presentation may add `presentation.workflow_state`; it never replaces `structuredContent.snapshot.state`.
- Manual responses always emit complete `content`; the server never suppresses a repeated message. `presentation.update_suppressed` is always `false`. A host may use the semantic hash only as an optional display hint.
- Set `GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT=1` to restore JSON text in `content` for one transition release.

## Severity

| Severity | Examples | Treatment |
|---|---|---|
| Advisory | preflight advisories, host tool-approval preference, model-inheritance diagnostics | Informational; never blocks |
| Warning | `handoff_persisted: false`, optional workspace binding unavailable | Task-local success path; follow-up only for deliberate cross-task export |
| Limitation | provisional repository attribution, incomplete or unavailable proof without a known failed Check, bounded human-attention note | Visible in `Quick decision`; does not claim the current transition is blocked |
| Error / blocker | preflight blockers, invalid/ambiguous chains, thrown tool errors, blocked/failed closeout Evidence | Lead summary; blocks the current action and names one resolution |

The structured projection is `severity: { blockers, limitations, warnings, advisories }`. Existing `gaps`, `human_attention`, and `problems` remain compatible source detail; they become blockers only for a blocked or failed outcome. Human limitations are ordered deterministically: failed required Checks are blockers; then missing Check IDs, unavailable Review enforcement, repository attribution, and transport warnings. Quick decision shows at most the first limitation; Details shows every relevant reason. `No material evidence limitation was reported` is allowed only when none exists. A provisional attribution result is a limitation, never a synthetic lifecycle blocker. Pre-existing paths are short technical context only.

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

- Manual phases use the six human labels above; the more detailed `journey_state` remains machine traceability. Actionable phases end with the Next-step footer; terminal status uses the compact state-specific completion block.
- Every emitted review is self-contained: `Quick decision` is sufficient for a human decision, `Details` explains outcome, scope, verification, limits, and recovery, and the authoritative agent/machine layer retains exact traceability. The current reviewer produces it directly; `/explain-work` remains an optional read-only refresh. Only `achieved` is **Final repository explanation**; other reviewed states are **Preliminary explanation** with limitations or blockers and the next safe action.
- Never duplicate full Root/Evidence text in chat when the exact copy already lives in the Plan envelope or `structuredContent.artifact`.
- Always surface authoritative IDs (`wp-*`, `de-*`, `wr-*`) in secondary technical traceability. Attach an exact artifact only when the user intentionally leaves the current task and optional handoff cannot transport it.
- A genuine blocker must be plain language in the primary layer as `Blocker: <reason>` followed by `Resolution: <one practical recovery>`. Do not label a provisional gap, repository-attribution limit, or optional transport failure as a blocker when the current transition remains available. Keep raw codes and paths in Technical traceability.
- Compact prose, lists, or tables are valid for low/medium Manual Intent/Acceptance/Boundaries/Risks; Verification remains an explicit table at presentation. High-risk, Hard-Trigger, and controller preparation stay fail-closed.

## Next-step footer

Actionable human-facing Manual MCP text and agent chat must end with this recognizable block (canonical English; agents may localize prose while keeping command tokens exact):

```text
### Next step
- Now: <label>
- How: <exact invoke>
- Why: <benefit>
```

For blocked output, place plain `Blocker:` and `Resolution:` immediately before this footer. Partial output uses `Limitation:` and a recovery only when one is useful; it must not invent a blocker. Off-track reasons remain structured compatibility detail and render as `Blocker`/`Resolution` or secondary `Recovery`, not as a mandatory fourth CTA line. Place the footer at the end of `Quick decision`. `Details` and one authoritative `Technical traceability` disclosure follow; portable-client compatibility attestations may follow only when that client contract explicitly requires them. Cursor and Codex Manual add none.

Terminal `workflow_status` is deliberately shorter:

- `workflow_state: achieved` with `next_action: none` uses `### Done` plus one sentence that repository delivery is complete; `/learn-from-work` and a refreshed `/explain-work` remain optional.
- Manual `workflow_state: accepted-provisional` with `next_action: none` uses `### Provisional gap acknowledged`. It says that the acknowledgement applies only to this response, is neither persisted nor verified, and that later status returns `delivery-ready-provisional`. It grants no Qualification or Learning authority.
- Controller `accepted-provisional` is different: `### Provisional controller delivery accepted` reports the persisted Run decision while still stating that delivery remains unverified and non-qualifying.
- `workflow_state: stopped` retains its compatible blocked machine outcome but projects `Completed`, `primary_action: null`, and `### Ended without delivery` with no Next-step footer.
- Failed, blocked, partial, or otherwise actionable output never uses either terminal block and never reports `next_action: none`; reuse an existing recovery action. The compatibility-only `stopped` exception uses `### Ended without delivery` and no action as specified above.

### Action catalog

Stable `next_action` ids retain one semantic label and benefit. The presenter chooses `How` from the build target and never appends a Root ID:

| action | Now (label) | Cursor | Codex | Agent Plugins / portable |
|---|---|---|---|---|
| `repair-root` | Repair the Root | `/plan-work` | `$plan-work` | `plan-work` |
| `implement-plan` | Implement the Plan | `Implement Plan` | `Implement Plan` | `implement-work` |
| `attach-artifact` | Export the exact artifact | `Attach the exact artifact` | `Attach the exact artifact` | `attach-artifact` |
| `review-root` | Review delivery | `/review-work` | `$review-work` | `review-work` |
| `accept-provisional` | Acknowledge the provisional gap | `/accept-work provisional` | `$accept-work provisional` | `accept-work provisional` |
| `closeout` | Portable Evidence build | `/review-work` | `$review-work` | `workflow_closeout` |
| `correct` / `approve-correction` | Fix or apply bounded correction | `/correct-work` | `$correct-work` | `correct-work` |
| `provide-artifacts` | Supply artifact chain | `/work-status` | `$work-status` | `work-status` |
| `replan` | Replan the Root | `/plan-work replan` | `$plan-work replan` | `plan-work replan` |
| `retry-review` | Retry review | `/review-work` | `$review-work` | `review-work` |
| `answer` | Answer clarification | reply with the requested answer | reply with the requested answer | reply with the requested answer |
| `resolve-intent` | Resolve intent | `/plan-work` | `$plan-work` | `plan-work` |
| `resolve-blocker` | Resolve the named blocker | fix the named cause, then `/work-status` again | fix the named cause, then `$work-status` again | fix the named cause, then `work-status` again |
| `none` | Done | no further Workflow action | no further Workflow action | no further Workflow action |
| `learn` | Persist learnings | `/learn-from-work` | `$learn-from-work` | `learn-from-work` |
| `explain` | Explain the chain | `/explain-work` | `$explain-work` | `explain-work` |

Benefits and recovery remain action-specific: implementation stays inside the approved Root; Review produces a fresh verdict; correction applies only the Review-approved bounded fix; replan creates a new approval boundary; provisional acknowledgement confirms one evidence gap without persisting or verifying it. A missing or ambiguous chain asks for exact artifacts in technical input but does not leak artifact IDs into the human CTA.

## Presentation fields

`presentation.schema` is `1`. Required fields remain: `tool`, `phase`, `outcome` (`ready|blocked|partial|failed`), `summary`, `checks`, `gaps`, `advisories`, `warnings`, `errors`, `next_action`, `next_action_label`, `journey_state`, `enforcement_level`, `primary_action`, and `technical_traceability`.

`journey_state` is one of `plan-ready|implementation-active|closeout-recovery-required|review-ready|review-active|correction-approval-required|replan-approval-required|provisional-acceptance-required|clarification-required|blocked|done`. The additive `human_projection` is `{ phase, label, status }`; `phase` is exactly `plan-ready|in-progress|review-needed|decision-needed|blocked|completed`. `severity` is `{ blockers, limitations, warnings, advisories }`. `primary_actor` is `human|agent|reviewer|controller|none`, and `client_host` is `cursor|codex|portable`.

`enforcement_level` is `host-native|explicit`. `primary_action` is exactly `{ id, label, invoke, why }` or `null`; it is the only primary action. `technical_traceability` carries Root/Evidence/Review/Correction IDs, Checks, Findings, paths, attribution, and enforcement detail. `deduplication_key` is the SHA-256 of the complete canonical presentation semantics except the key itself and `update_suppressed`; any visible semantic change therefore changes the key. It is not server state and never authorizes content suppression.

Compatibility fields remain: `next_action_invoke`, `next_action_benefit`, and, when recovery applies, `next_action_blocked_reason`, `next_action_recovery`. Optional contextual help is `help: { topic, meaning, label, url }`; `label` is `Manual Workflow guide`, and `url` uses `https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md` plus a validated topic anchor. `workflow_status` additionally sets optional `workflow_state` from the derived snapshot and includes the uniform read-only `learning` projection. Keep `next_action` and `next_action_label` stable.
