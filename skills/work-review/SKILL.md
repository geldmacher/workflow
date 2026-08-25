---
name: work-review
description: Review one Schema-6 Workflow root repository-read-only.
---

Start a fresh repository-read-only Review. Read [protocol](../../references/artifact-protocol.md) and [review](../../references/review-contract.md). The atomic builder owns Evidence construction.

Use the exact current-task Schema-6 Root selected by the host. Presentation defects and recoverable MCP transport failures do not erase a valid active Root or selection. Caches and handoff are transport only. Reject every unsupported artifact schema.

Assess acceptance, authority, boundaries, verification intents, repository state, and limitations. The project harness chooses how to inspect them and attests before and after snapshots. Workflow never parses or classifies its commands, tools, models, framework, or host choices.

No exact active Root means no substantive Review. Missing harness evidence is different: keep the Root, create unavailable or supported Evidence, and return a provisional decision with the limitation.

A Check is verified only when a protected harness attestation binds its verification intent, Root hash, workspace binding, and current snapshot. Missing attestation stays provisional; attested failure stays failed; contradictory binding is rejected. Human-decision Checks remain human gates.

Call `workflow_closeout` once with `artifact_kind: work-review` and closed `review_input`. Cursor uses its single-use Root/workspace receipt; Codex and portable clients supply exact bytes. The builder asks the configured project harness through the generic phase interface and returns Delivery Evidence plus Work Review together or neither. Harness unavailability caps evidence but never invents Root-unavailable.

Verified completes. Provisional may offer ephemeral `/accept-work provisional`. Failed required Checks route to correction, clarification, retry, or replan. Never mutate during Review.
