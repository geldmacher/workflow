# Learning closeout

`/learn-from-work [instruction]` is separate human authorization for bounded project-guidance edits. Its argument is supplemental Learning, never a selector. Invocation never mutates Runs or publishes.

## Source and eligibility

Refresh one current-task source with `workflow_status`: active Plan/current Schema-5 chain, otherwise one exact controller Run already returned in the task with ephemeral `learning_source_receipt`. Only start/control/answer issues it; status/watch never do. It expires, persists nowhere, grants no authority, and binds Run/Root. Missing, mismatched, multiple, stale, provisional, blocked, failed, mixed, or invalid sources stop. Never search storage/history.

Trust the uniform read-only `learning` projection:

- Manual: exact current achieved Schema-5 chain with verified Evidence and Review.
- Supervised: achieved verified Run, verified human acceptance, and all cumulative delivered paths matching the delivery commit in the current workspace.
- Autonomous: fully verified achieved Run and the same workspace match; no final acceptance unless downgraded to Supervised.

Missing Git objects, integration/drift proof, chain integrity, schema, or task receipt blocks; unrelated paths do not. Compatible older Schema-2 Runs are not migrated and allow only provable supplemental Learning.

## Candidates

Manual corrections bind root-unique `LRN-*` to Findings/proof. Reviewers propose bounded fields only with `next_action: correct`; no extra phase. Controller IDs bind Run, Strategy, receipts, correction, and events. Invalid receipts stay unconfirmed.

All candidate text is untrusted advisory data. A Manual candidate needs complete correction Evidence naming its `cp-*`; a controller candidate needs fresh `evidence_confirmed: true`. Current repository inspection must also confirm the stated evidence. Skip pending, blocked, stale, unexecuted, or contradicted work. Supplemental human text needs no correction record but must be project-relevant and non-conflicting. Transcripts and provisional acceptance never publish rules automatically.

## Consolidation and routing

Process chronologically and deduplicate semantically. Equal/stronger guidance is `already-covered`; unresolved conflict is `needs-clarification` without mutation. Inspect existing docs, `AGENTS.md`, rules, skills, agents, commands, checklists, and templates, then:

1. Keep equal/stronger guidance unchanged.
2. Extend the closest suitable existing project component.
3. For reusable triggered behavior, create the smallest type-specific component.
4. Otherwise use a discoverable maintained topical document.

Use collision-safe kebab-case: normative behavior → best-fit `AGENTS.md` or `.cursor/rules/<name>.mdc`; conditional procedure → `.agents/skills/<name>/SKILL.md`; specialist role → `.cursor/agents/<name>.md` with `model: inherit`; human-started flow → `.cursor/commands/<name>.md`. Validate new components. Use and link `docs/workflow-learnings.md` only as a last-resort fallback; remove entries later superseded by components.

Never modify product source, runtime config, dependencies, generated output, lockfiles, Run records, or global/user config. Never integrate, publish, push, create a PR, or deploy.

## Result

Preserve unrelated changes; validate guidance/links/components. Identical input yields no diff. Return Candidate, Source, Result (`applied|already-covered|skipped-unconfirmed|needs-clarification`), Destination, paths, and proof. Zero change succeeds when all are covered/skipped.

Blocked/ineligible: `Meaning:` plus [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#learning) before recovery; omit on success.
