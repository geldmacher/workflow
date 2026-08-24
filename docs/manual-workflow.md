# Manual Workflow guide

Manual Workflow is the human-driven Cursor and Codex path. It keeps planning native, implementation ordinary, and delivery claims review-owned:

```text
native Plan -> Implement Plan -> fresh Review
                              |-> achieved
                              |-> acknowledge provisional
                              |-> correct -> fresh Review
                              |-> replan -> Implement Plan -> fresh Review
```

No controller Run, persistent Manual task database, implementation closeout, Stop continuation, cross-task restore, push, PR, deploy, or publication is part of this path. Cursor's passive planning `stop` observer records state only and always returns an empty hook result; it is not a continuation and never creates another turn.

The observer uses Cursor's documented [`stop` hook payload](https://prod.cursor.com/docs/hooks), including conversation, generation, workspace, and transcript binding.

Workflow activates only for an explicit Workflow action such as `/plan-work` or `/review-work` in Cursor and `$plan-work` or `$review-work` in Codex. Ordinary prompts and file edits remain host-native; native **Implement Plan** authority stays host-owned. Passive observation fails quiet when activation cannot be established. Cursor's small pre-tool safety kernel is different: matching write, shell, task, browser/computer, and MCP surfaces use `failClosed:true`, so a hook crash, timeout, or invalid result can block a matching mutation even outside an active Workflow. Reads and prompts remain available. This availability tradeoff is deliberate because an active Review must not silently become writable. An inactive `workflow_status` response is informational and never grants or withholds permission to implement.

## Intent Root and Plan

`/plan-work` in Cursor or `$plan-work` in Codex Plan mode creates one immutable Schema-5 Root with a visible `wp-*` ID. Cursor's native Plan and Codex's native `<proposed_plan>` are the sole Manual plan authority and the only authoritative plan containers. Workflow validates an exposed Root. Cursor retains `postToolUse(CreatePlan)` as a compatible fast path. When Cursor omits that event, the exact `/plan-work` generation arms a passive observer: successful `stop` accepts exactly one structured assistant `CreatePlan` from only the latest completed transcript turn, after bounding the conversation, workspace, regular-file type, symlink status, size, Schema-5 bytes, and hash. Prose, older turns, incomplete turns, and multiple candidates grant no authority.

Only when the transcript is completely unavailable may exactly one regular, non-symlinked `.cursor/plans/*.plan.md` file created during that just-finished Plan turn and no more than 120 seconds old establish a Root. That weaker binding is always `provisional`, reports `native_root_source: cursor-plan-file`, and can never produce verified delivery. Missing, stale, invalid, oversized, or multiple files block only Review. Historical tasks are not scanned or backfilled; a future generation-bound `/plan-work` marker is required. Every successful Root observation records one current Root and its repository baseline for the same conversation and single canonical repository. It cannot approve implementation, cross a task or workspace boundary, or become repository-independent cache authority. A later ordinary Plan supersedes it, and Cursor Manual rejects ambiguous multi-root workspaces instead of copying authority into every root.

Native steps describe implementation and planned Checks. They contain no closeout todo or Workflow attestation. Required Verification methods must stay repository-read-only across their complete wrapper and lifecycle-hook chain. The human's separate **Implement Plan** action authorizes implementation inside the Root. Cursor exposes no structured Workflow hook event for that host choice, so Workflow reports `implementation_authorization: host-owned-unattested` and never infers approval from prompt text. Corrections and material replans remain separate human actions.

## Implementation

The agent implements inside the approved authority and normal host sandbox. It may run the planned Checks and reports failures or uncertainty honestly, but these are implementation observations rather than final Evidence.

Implementation itself carries no Workflow mutation gate. Hook or MCP state, `workflow_status`, workspace discovery, and a missing Review Root cannot block the host's already authorized native implementation action.

Implementation and correction finish normally. They do not emit `closeout-input`, create `de-*`, wait for lifecycle state, persist a chain, or trigger another agent turn. The next action is a fresh Review in the same task.

## Fresh Review and atomic Evidence

`/review-work` or `$review-work` is repository-read-only and resolves the exact Root only from the current native Plan/task context. In Cursor, the explicit `/review-work` turn selects the one current validated CreatePlan Root and reports `review_selection_source: explicit-review-command`; it does not attest the preceding host implementation action. The Review turn creates a protected five-minute opaque single-use receipt for the matching `workflow_closeout` call. If only the prompt observer is unavailable, Cursor may recover activation from one exact final `/review-work` user message in a bounded regular conversation-bound JSONL transcript. That fallback never reads Root or predecessor authority from prose and always reports `review-observer-unavailable`, caps Evidence at supported, and keeps delivery provisional. A failed required Check remains blocked. In Codex and portable clients, the reviewer supplies the exact Root and predecessor bytes directly. Legacy state, handoff tips, artifact caches, IDs without bytes, and another task cannot substitute.

Root resolution is explicit:

- `resolved`: exact Root text, ID, hash, and native source are available.
- `unavailable`: Review lists the native sources inspected and stops.
- `invalid`: an observed or recovered native candidate is present but fails exact Schema-5 validation.
- `ambiguous`: Review lists candidate IDs and stops.
- `superseded`: a later native Plan replaced the observed Workflow Root; start from the current Plan.

For unavailable or ambiguous resolution, restore the Plan in this task or create and approve a new native Plan. Only Review is blocked; completed repository work is not rewritten or discarded.

The reviewer executes or directly inspects planned Checks fresh. In Cursor it calls the stateless work-review builder once with semantic Review input only; the host receipt supplies the exact Root and validated predecessor artifacts. In Codex and portable clients it supplies those exact bytes in the call as before. The server observes the current repository and returns Delivery Evidence plus Work Review atomically. Both artifacts exist or neither does.

The Cursor hook injects the opaque receipt only through the host's protected `updated_input`; a model-supplied receipt is rejected. The MCP addresses that one token, validates its conversation, generation, tool-call, workspace, Root, Root binding, baseline, request, and expiry bindings, and consumes it atomically once. Missing, expired, replayed, mismatched, cross-task, or cross-workspace receipts fail closed. A successful Review reports `native_task_binding: cursor-receipt`, `native_root_source`, additive `native_root_binding`, `implementation_authorization: host-owned-unattested`, and `predecessor_mode: task-chain|full-rebuild`. Transcript or post-tool observation uses `cursor-create-plan` with enforced binding. The native Plan-file fallback uses `cursor-plan-file` with provisional binding, caps repository attribution and delivery at provisional even when every Check passes, and exposes the reason as a human Limitation. Only a complete current Evidence/Review tip is a `task-chain`; an incomplete but valid tip falls back to honest `full-rebuild` and claims no delta lineage.

Caller-supplied paths do not narrow the repository observation. The CreatePlan baseline and each explicit Correction baseline distinguish attributable changes from unchanged pre-existing dirty paths. Missing baseline, HEAD drift, concurrent repository activity, or a baseline mismatch produces `repository_attribution.status: provisional`: behavior may still be supported, but exclusive change attribution and verified delivery are unavailable. Pre-existing paths stay visible in Technical traceability; out-of-authority changes become Findings. A failed required Check still yields a completed Review whose delivery status is blocked.

During active Review, potential writes, unknown or mutating shell commands, unmarked tasks, browser/computer control, and unknown MCP tools are denied by default. Shell permits only one exact machine-verifiable command from the active Root in its declared canonical directory, optionally wrapped once by `rtk`; changed targets, extra arguments, chaining, substitutions, redirections, output-writing Git options, executable search options, and unknown npm scripts are denied. Symlink, realpath, and repository subdirectory representations share `realpath(git rev-parse --show-toplevel)` as StateRoot, baseline, and receipt identity. Named read-only auditors and the bound `workflow_closeout` route remain permitted. The two prompt observers are `failClosed:false` for ordinary availability; the active mutation guard is `failClosed:true`.

## Evidence grades

- `verified`: this reviewer directly observed the planned method or inspection, directory, expectation, result, and repetition.
- `supported`: useful observation exists but does not satisfy the full planned proof.
- `partial`: only part of the required outcome was observed.
- `unavailable`: the required proof could not be obtained.
- `failed`: the observed result contradicted the required Check.

Host receipts may enrich Manual proof, but they are not required. Supervised and Autonomous retain stricter certified receipts. A known failed required Check can never become achieved or verified through wording.

## Risk and auditors

Low- and medium-risk work may use an inline or targeted review. High-risk or Hard-Trigger work uses a full route with delivery and risk auditors, plus design review when materially relevant. Risk changes review depth and communication; it does not retroactively block the user's native implementation action.

Unresolved uncertainty stays provisional or blocked and appears as a named Limitation or Blocker. The human chooses whether to improve proof, authorize correction, replan, or acknowledge a provisional gap once.

Review depth is proportional. Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility, but do not require all six signals when they are irrelevant to the Root.

## Review results and next actions

- `achieved / verified / none`: repository delivery is complete for this Root.
- `provisional / accept-provisional`: no known failed required Check, but a named proof gap needs another Review or an explicit one-response acknowledgement.
- `correct`: authorize only the bounded Findings-backed correction, then run a fresh Review that creates delta Evidence.
- `clarify`, `retry-review`, or `replan`: follow the one named action; do not reinterpret uncertainty as success.

The result uses three layers: **Quick decision**, **Details**, then **Agent and machine contract (authoritative)**. Quick decision contains outcome, Checks, at most one Limitation, a Blocker only when the current transition is actually prevented, and exactly one host-correct action or honest completion. Exact Root, Evidence, Review, Check, Finding, path, and hash details follow in Technical traceability. Repository delivery never claims live host activation or production deployment.

## Manual states

State is derived from exact current-task artifacts, never from legacy runtime files. The stable machine contract retains the detailed states below. Human output projects them into only six phases: **Plan ready**, **In progress**, **Review needed**, **Decision needed**, **Blocked**, and **Completed**.

- `intent-clarification`: a material Plan decision is open.
- `root-plan-review`: the native Plan awaits human **Implement Plan** approval.
- `root-review`: implementation finished and fresh Review is next.
- `waiting-human`: one named human decision or exact current-task artifact is missing.
- `replan`: intent or authority must change under a new Root.
- `delivery-ready-provisional`: delivery is usable only with the named evidence limitation.
- `achieved`: fresh Review verified all required outcomes.
- `accepted-provisional`: the human acknowledged one named evidence gap for this response without converting it to verified. Manual acknowledgement is ephemeral, not persisted, not qualification evidence, and grants no Learning authority; a later status returns `delivery-ready-provisional`.
- `blocked` or `failed`: a required Check, safety boundary, or builder failure prevents delivery.
- `stopped`: a historical or deliberately non-actionable subject is shown as completed without delivery.

Human status never asks a blocked controller subject to inspect the same unchanged status repeatedly. After status already exposed the blocker, `resolve-blocker` means: fix the named cause, then check status once again.

## Artifacts, tips, and handoff

Exact Root, Evidence, and Review bytes returned in the current task are authoritative there. Cursor uses one opaque, same-conversation native receipt to transport the current validated Root and complete predecessor tip into its explicit Review. Codex and portable clients use exact-input Root and predecessor bytes instead; they do not claim Cursor's protected receipt binding. A successful Cursor post-tool observation may retain the validated paired Evidence/Review bytes only for later same-conversation delta lineage. It cannot restore another task. Handoff transport never creates approval.

## Recovery and troubleshooting

If native Root resolution is unavailable or ambiguous, Review names the concrete cause and gives one remedy: create one fresh Plan in this task, then repeat Review. A missing transcript plus one unique recent Plan file is accepted automatically but remains visibly provisional; there is no recovery command on the normal path. If a Check fails, authorize correction or replan; never relabel failure as missing proof. If persistence fails after an atomic Review result, keep using the exact returned pair in this task.

## Command map

| Need | Cursor | Codex | Agent Plugins |
|---|---|---|---|
| Create or replace the Root | `/plan-work` | `$plan-work` in Plan mode | `plan-work` |
| Implement | **Implement Plan** | **Implement Plan** | `implement-work` |
| Review and create Evidence | `/review-work` | `$review-work` | `review-work` |
| Apply a reviewed correction | `/correct-work` | `$correct-work` | `correct-work` |
| Replan | `/plan-work replan` | `$plan-work replan` | `plan-work replan` |
| Acknowledge one provisional gap | `/accept-work provisional` | `$accept-work provisional` | `accept-work provisional` |
| Inspect or explain exact current-task artifacts | `/work-status`, `/explain-work` | `$work-status`, `$explain-work` | `work-status`, `explain-work` |
| Persist confirmed guidance | `/learn-from-work` | `$learn-from-work` | `learn-from-work` |

## Learning

Learning is optional and always human-started. It requires the exact current achieved chain. `/accept-work provisional` is an ephemeral, not persisted acknowledgement; it supplies neither Qualification evidence nor Learning authority. Blocked or stale work, transcripts, caches, and historical lookup likewise do not authorize project guidance changes.

## Upgrade behavior

Workflow 5.5.1 deliberately ignores older native task context and receipt state. Old files may remain for maintenance cleanup but cannot influence authority. After upgrading an open Cursor task, create a fresh native Plan before implementation and start a fresh Review before relying on a delivery verdict; stale authority data is never migrated into the new binding protocol.

Deployment and live activation are separate from repository completion. After an authorized dual-host deployment, validate a fresh Cursor task and a genuinely new Codex task: Plan remains visible, implementation creates no second turn, Review returns both artifacts once, no closeout action appears, and a rootless Review gives one concise native-plan diagnostic.
