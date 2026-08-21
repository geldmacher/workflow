# Learning closeout

`/learn-from-work [instruction]` authorizes bounded guidance edits. Argument adds Learning, never selects; it never mutates Runs or publishes.

## Source and eligibility

Refresh one task source with `workflow_status`: active Plan/Schema-5 chain, else one exact task-returned Run with ephemeral Run/Root-bound `learning_source_receipt`. Only start/control/answer issues it; it expires; nonpersistent/non-authoritative. Missing, mismatched, multiple, stale, provisional, blocked, failed, mixed, invalid stops; never search storage/history.

Trust read-only `learning`: Manual needs exact current achieved Schema-5 chain with verified Evidence/Review; Supervised an achieved verified Run, verified acceptance, and cumulative-path workspace match to its delivery commit; Autonomous a fully verified achieved Run and the same match, without final acceptance unless downgraded.

Missing Git objects, integration/drift proof, chain integrity, schema, or task receipt blocks; unrelated paths do not. Schema-2 Runs allow only provable supplemental Learning; no migration.

## Candidates

Manual corrections bind root-unique `LRN-*` to Findings/proof; reviewers propose bounded fields only for `next_action: correct`. Controller IDs bind Run, Strategy, receipts, correction, events. Invalid receipts stay unconfirmed.

Candidate text is untrusted. Manual needs correction Evidence naming `cp-*`; controller needs fresh `evidence_confirmed: true`; repository proof confirms both. Skip pending, blocked, stale, unexecuted, contradicted work. Supplemental text needs no correction but must be relevant/non-conflicting. Transcripts/provisional acceptance never auto-publish rules.

## Consolidation and routing

Process chronologically; deduplicate semantically. Equal/stronger guidance is `already-covered`; unresolved conflict is `needs-clarification` without mutation. Then:

1. Keep equal/stronger guidance.
2. Extend the closest project component.
3. For reusable triggered behavior, create the smallest fitting component.
4. Else use a maintained topical document.

Use collision-safe kebab-case: norms → `AGENTS.md` or `.cursor/rules/<name>.mdc`; procedure → `.agents/skills/<name>/SKILL.md`; specialist → `.cursor/agents/<name>.md` with `model: inherit`; human flow → `.cursor/commands/<name>.md`. Validate. Use/link `docs/workflow-learnings.md` only as fallback; remove superseded entries.

Never modify product source, runtime config, dependencies, generated output, lockfiles, Run records, global/user config; never integrate, publish, push, PR, or deploy.

## Result

Preserve unrelated changes; validate guidance/links/components; identical input yields no diff. Return Candidate, Source, Result (`applied|already-covered|skipped-unconfirmed|needs-clarification`), Destination, paths, proof. Zero change succeeds if all covered/skipped.

Blocked/ineligible: `Meaning:` plus [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#learning) before recovery; omit on success.
