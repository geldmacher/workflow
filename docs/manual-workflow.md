# Manual Workflow guide

Manual Workflow is the human-driven Cursor and Codex path. It keeps planning native, implementation ordinary, and delivery claims review-owned:

```text
native Plan -> Implement Plan -> fresh Review
                              |-> achieved
                              |-> accept provisional
                              |-> correct -> fresh Review
                              |-> replan -> Implement Plan -> fresh Review
```

No controller Run, persistent Manual task database, implementation closeout, Stop continuation, cross-task restore, push, PR, deploy, or publication is part of this path.

Workflow activates only for an explicit Workflow action such as `/plan-work` or `/review-work` in Cursor and `$plan-work` or `$review-work` in Codex. Ordinary prompts, native Plans, **Implement Plan**, file edits, shell commands, and subagents remain host-native when no Workflow action is active. Globally installed hooks fail quiet when activation cannot be established; explicit Review read-only violations and explicit Plan validation failures still return deliberate denials. An inactive `workflow_status` response is informational and never grants or withholds permission to implement.

## Intent Root and Plan

`/plan-work` in Cursor or `$plan-work` in Codex Plan mode creates one immutable Schema-5 Root with a visible `wp-*` ID. Cursor's native Plan and Codex's native `<proposed_plan>` are the sole Manual plan authority and the only authoritative plan containers. Workflow validates an exposed Root. Cursor may retain a protected conversation-bound observation of the exact `CreatePlan` bytes after successful validation, but that observation is transport provenance only: it cannot approve a Plan, select an active Root, cross a task or workspace boundary, or become cache authority.

Native steps describe implementation and planned Checks. They contain no closeout todo or Workflow attestation. Required Verification methods must stay repository-read-only across their complete wrapper and lifecycle-hook chain. The human's separate **Implement Plan** action authorizes implementation inside the Root. Corrections and material replans remain separate human actions.

## Implementation

The agent implements inside the approved authority and normal host sandbox. It may run the planned Checks and reports failures or uncertainty honestly, but these are implementation observations rather than final Evidence.

Implementation itself carries no Workflow mutation gate. Hook or MCP state, `workflow_status`, workspace discovery, and a missing Review Root cannot block the host's already authorized native implementation action.

Implementation and correction finish normally. They do not emit `closeout-input`, create `de-*`, wait for lifecycle state, persist a chain, or trigger another agent turn. The next action is a fresh Review in the same task.

## Fresh Review and atomic Evidence

`/review-work` or `$review-work` is repository-read-only and resolves the exact Root only from the current native Plan/task context. In Cursor, successful `CreatePlan` observation plus the later native **Implement Plan** choice binds the exact approved Root to that conversation. The explicit Review turn creates a protected five-minute single-use receipt for the matching `workflow_closeout` call. In Codex and portable clients, the reviewer continues to supply the exact Root and predecessor bytes directly. Legacy state, handoff tips, artifact caches, IDs without bytes, and another task cannot substitute.

Root resolution is explicit:

- `resolved`: exact Root text, ID, hash, and native source are available.
- `unavailable`: Review lists the native sources inspected and stops.
- `unapproved`: Cursor observed a Root, but the human has not selected native **Implement Plan** for it.
- `invalid`: an observed or recovered native candidate is present but fails exact Schema-5 validation.
- `ambiguous`: Review lists candidate IDs and stops.

For unavailable or ambiguous resolution, restore the Plan in this task or create and approve a new native Plan. Only Review is blocked; completed repository work is not rewritten or discarded.

The reviewer executes or directly inspects planned Checks fresh. In Cursor it calls the stateless work-review builder once with semantic Review input only; the host receipt supplies the exact Root and validated predecessor artifacts. In Codex and portable clients it supplies those exact bytes in the call as before. The server observes the current repository and returns Delivery Evidence plus Work Review atomically. Both artifacts exist or neither does.

The Cursor MCP consumes a matching receipt atomically and once. Missing, expired, replayed, mismatched, cross-task, or cross-workspace receipts fail closed. A successful Review reports `native_task_binding: cursor-receipt`, `native_root_source: cursor-create-plan`, and `predecessor_mode: task-chain|full-rebuild`. If historical artifact bytes are unavailable, `full-rebuild` creates honest full Evidence and claims no delta lineage.

Caller-supplied paths do not narrow the repository observation. Pre-existing, ambiguous, or out-of-authority changes become explicit limitations or Findings. A failed required Check still yields a completed Review whose delivery status is blocked.

## Evidence grades

- `verified`: this reviewer directly observed the planned method or inspection, directory, expectation, result, and repetition.
- `supported`: useful observation exists but does not satisfy the full planned proof.
- `partial`: only part of the required outcome was observed.
- `unavailable`: the required proof could not be obtained.
- `failed`: the observed result contradicted the required Check.

Host receipts may enrich Manual proof, but they are not required. Supervised and Autonomous retain stricter certified receipts. A known failed required Check can never become achieved or verified through wording.

## Risk and auditors

Low- and medium-risk work may use an inline or targeted review. High-risk or Hard-Trigger work uses a full route with delivery and risk auditors, plus design review when materially relevant. Risk changes review depth and communication; it does not retroactively block the user's native implementation action.

Unresolved uncertainty stays provisional or blocked and appears under Human attention. The human chooses whether to improve proof, authorize correction, replan, or accept a provisional gap.

Review depth is proportional. Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility, but do not require all six signals when they are irrelevant to the Root.

## Review results and next actions

- `achieved / verified / none`: repository delivery is complete for this Root.
- `provisional / accept-provisional`: no known failed required Check, but a named proof gap needs explicit human acceptance or another Review.
- `correct`: authorize only the bounded Findings-backed correction, then run a fresh Review that creates delta Evidence.
- `clarify`, `retry-review`, or `replan`: follow the one named action; do not reinterpret uncertainty as success.

The result leads with outcome, Checks, limitations, and one next action. Exact Root, Evidence, Review, Check, Finding, path, and hash details follow under Technical traceability. Repository delivery never claims live host activation or production deployment.

## Manual states

State is derived from exact current-task artifacts, never from legacy runtime files.

- `intent-clarification`: a material Plan decision is open.
- `root-plan-review`: the native Plan awaits human **Implement Plan** approval.
- `root-review`: implementation finished and fresh Review is next.
- `waiting-human`: one named human decision or exact current-task artifact is missing.
- `replan`: intent or authority must change under a new Root.
- `delivery-ready-provisional`: delivery is usable only with the named evidence limitation.
- `achieved`: fresh Review verified all required outcomes.
- `accepted-provisional`: the human accepted one named evidence gap without converting it to verified.
- `blocked` or `failed`: a required Check, safety boundary, or builder failure prevents delivery.
- `stopped`: a historical or deliberately non-actionable subject remains read-only.

## Artifacts, tips, and handoff

Exact Root, Evidence, and Review bytes returned in the current task are authoritative there. A successful Cursor post-tool observation may retain the validated paired Evidence/Review bytes only for later same-conversation delta lineage. It cannot authorize a Review or restore another task. Cursor and Codex do not restore Manual authority from artifact tips or handoff caches. Portable clients may transport exact bytes under the compatibility contract, but transport never creates approval.

## Recovery and troubleshooting

If native Root resolution is unavailable or ambiguous, Review names the native sources inspected and gives one remedy: restore the Plan in this task or create and approve a new native Plan. If a Check fails, authorize correction or replan; never relabel failure as missing proof. If persistence fails after an atomic Review result, keep using the exact returned pair in this task.

## Command map

| Need | Cursor | Codex |
|---|---|---|
| Create or replace the Root | `/plan-work` | `$plan-work` in Plan mode |
| Implement | **Implement Plan** | **Implement Plan** |
| Review and create Evidence | `/review-work` | `$review-work` |
| Apply a reviewed correction | `/correct-work` | `$correct-work` |
| Replan | `/plan-work replan` | `$plan-work replan` |
| Accept one provisional gap | `/accept-work provisional` | `$accept-work provisional` |
| Inspect or explain exact current-task artifacts | `/work-status`, `/explain-work` | `$work-status`, `$explain-work` |
| Persist confirmed guidance | `/learn-from-work` | `$learn-from-work` |

## Learning

Learning is optional and always human-started. It requires the exact current achieved chain. Provisional acceptance, blocked or stale work, transcripts, caches, and historical lookup do not authorize project guidance changes.

## Upgrade behavior

Workflow 5.5 deliberately ignores pre-5.5 Manual active-root, plan-transaction, chain, closeout, and handoff state. Old files may remain for maintenance cleanup but cannot influence authority. An in-progress older chain must start from a new native Plan after upgrade.

Deployment and live activation are separate from repository completion. After an authorized dual-host deployment, validate a fresh Cursor task and a genuinely new Codex task: Plan remains visible, implementation creates no second turn, Review returns both artifacts once, no closeout action appears, and a rootless Review gives one concise native-plan diagnostic.
