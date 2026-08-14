# Manual Workflow Contract

This contract is host-neutral. A host facade may translate command syntax and native plan containers, but it must preserve the same Schema-5 artifact text, IDs, hashes, chain rules, status derivation, and closeout semantics.

## Authority

- The human authorizes planning, implementation, every correction, review, replan, provisional acceptance, and learning as separate actions. Starting a fresh read-only Manual review phase authorizes final verification: an `achieved/verified/none` verdict completes the Root, while only a provisional verdict needs the separate ephemeral `/accept-work provisional` decision. Freshness is a phase boundary, not a requirement to open another task or chat.
- Manual Workflow never starts controller automation, merges, pushes, publishes, or deploys.
- Subagents are optional role helpers. By default they inherit the parent model. An optional Manual subagent policy may approve concrete host-specific candidates; see [manual subagent policy](./manual-subagent-policy.md). Their output is advisory until the primary agent verifies and records it.
- Review is read-only. A proven gap requires a separate correction or implementation action.

## Artifact flow

1. Planning creates one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID.
2. The host validates every exact Manual Root locally through its native plan guard before presentation. Standalone `workflow_plan_preflight` remains optional compatibility and controller-preparation transport; `workflow_artifact_record` is best-effort transport only.
3. The host presents its native plan container. Its final implementation step uses semantic `delivery-closeout`; legacy `workflow_closeout` remains accepted.
4. Before implementation or correction mutation, the host revalidates the exact task-bound Root, captures the repository baseline, and rejects directly observable protected, approval-required, or out-of-authority targets. Missing Root or baseline blocks before writing; opaque mutation targets remain fail-closed at complete closeout inventory.
5. Implementation observes every required Check and performs one internal closeout commit. The host derives repository evidence and stores one exact `delivery-evidence` artifact with a `de-*` ID before exposing Review readiness. The normal user-visible response contains neither `closeout-input` nor `delivery-report`; the native typed report remains a bounded host fallback and the existing MCP contract remains wire-compatible.
6. In the same user task/chat by default, a fresh read-only reviewer returns closed Schema-1 semantic input; the host validates the exact Root/Evidence chain and deterministically builds one authoritative `work-review` artifact with a `wr-*` ID. If Evidence is missing, the review action invokes the same idempotent closeout builder internally and continues without a second user action. If one recovery proves Evidence impossible because the post-mutation Root/workspace/baseline boundary is irrecoverable, a native host may record a short-lived protected receipt bound to the exact Root and current repository snapshot; only the host may build the root-boundary variant, whose sole action is a separately approved replan. Portable/rootless or stale validation grants no replan. Hosts retain exact Root, Evidence, Review bytes, and builder provenance under one Root-content chain so an authorized correction or replan receives its predecessor tips without reconstruction. Task artifacts are authoritative; handoff context is optional recovery transport, while artifact record accepts new Roots but not raw new Review authority.
7. Status is derived from the exact current-task artifact chain. The shared root-content handoff cache is transport only and never grants authority. Optional host `tool_approval` preference metadata is advisory only; see [host approval](./host-approval-contract.md).

Artifact text remains host-neutral and immutable. Human-facing summaries lead with journey state, outcome, Check summary, at most one blocker, and one action; exact machine artifacts remain secondary but authoritative in `Technical traceability`. Actionable Manual-phase replies use the `### Next step` footer from [manual MCP output](./manual-mcp-output-contract.md) (Now/How/Why; Off track when blocked). Terminal `achieved` and `accepted-provisional` status use compact state-specific completion blocks. Prefer MCP `presentation` when present; keep command tokens exact.

The default Manual journey is task-local from Plan through Review and any bounded Correction. Optional persistence may support interruption recovery or deliberate transfer, but `handoff_persisted: false` never blocks a valid exact chain already retained by the current task. A new task/chat is optional, not a freshness or independence gate. The same user-task invariant applies to supervised and autonomous orchestration: stored Runs support resilience and monitoring, while the user may prepare, approve, follow, and finish one delivery in the task that started it.

Machine `verified` needs a fresh host receipt bound to exact Root, command, directory, and repository snapshot. Receipts are host-neutral hashes with no raw output, expire after 24 hours, and are purged after persisted closeout. Missing/stale/rootless proof downgrades; host failure stays `failed`; human gates are unchanged.

Closeout, status, and review expose current-delivery coverage only. Success stays compact; actionable Human attention and Problems include why, recovery, and one next action. No history or automatic Learning follows.

When a user-visible state, Evidence grade, non-achieved Review outcome, handoff limitation, or recovery condition needs interpretation, add at most one short `Meaning:` sentence and one topic-specific `Learn more:` link inside technical traceability. Use the canonical [Manual Workflow guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md); omit blanket help from ordinary successful prose and from explanations that already translate the chain.

## Roles

- Planner: read-only discovery, intent interview, Schema-5 Root construction, native plan presentation, and optional preflight.
- Primary implementer: executes only the approved Root, collects direct Check observations, and performs closeout.
- Delivery auditor: read-only comparison of changed code and evidence against acceptance and required Checks.
- Risk auditor: read-only inspection of material safety, security, data, and irreversible-operation risks.
- Design auditor: read-only inspection of architecture and public-contract fit.
- Explainer: read-only explanation of behavior and boundaries.

Role helpers receive the exact Root/chain, a bounded question, and the marker `[workflow-model-inherit-v1]`. Cursor Tasks omit model overrides or use `inherit`. Codex may apply a configured ordered Manual candidate rewrite with parent fallback. Unapproved concrete models remain forbidden.

## Failure boundary

- Invalid, ambiguous, conflicting, Schema-3/4, or incomplete chains stop the action.
- Native closeout failures name their concrete class and cause in the host response; a visible `closeout-input` never implies that Evidence was created.
- Unavailable cache transport does not invalidate or block exact artifacts already present in the task. Attach exact artifacts only when deliberately continuing in another task or host that cannot load them.
- Unattested or model-divergent subagent output is not evidence.
- Missing or invalid closeout blocks implementation completion. Local plan validation is required for every Manual Root; standalone MCP preflight is optional and its failure cannot fabricate success or override local validation.
- A closeout recovery may request at most one technical continuation. Cursor binds that generated prompt to the exact Root and carries it into the next generation using the host `loop_count`; a mismatched genuine human prompt supersedes it. Repeated failure terminalizes the phase as blocked, preserves the immutable chain as inert context, and leaves later ordinary prompts quiet.
- A host-observed required Check failure after closeout immediately invalidates the current Evidence tip. One bounded internal continuation persists replacement Evidence with the failed grade; the invalidated transport record is quarantined recoverably and cannot remain the active handoff tip.
