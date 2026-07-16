# Learning closeout

`/learn-from-work [instruction]` is optional Agent Mode closeout and direct authorization for bounded project-guidance edits. Its entire argument is one manual Learning, never an artifact selector. Resolve exactly one root and linear review/evidence chain or stop before mutation. Legacy corrections remain valid but yield no automatic Learning.

## Correction candidates

Every new review with `next_action: correct` includes non-empty root-unique `learning_candidates: [LRN-*]` and an embedded table `Learning ID | Finding keys | Reusable guidance | Candidate targets | Confirmation evidence`. Rows reference existing Findings, state reusable guidance and later proof, and remain output-only during review/correction.

Confirm an automatic candidate only when valid complete `delivery-evidence` names its `cp-*` as `subject_id` and current repository inspection supports its Confirmation evidence. Skip pending, blocked, unexecuted, contradicted, and legacy work. A manual Learning needs no correction evidence but must be project-relevant and non-conflicting.

## Consolidation and target routing

Process chronologically and deduplicate semantically. Equal/stronger guidance is `already-covered`; unresolved conflicts are `needs-clarification` without mutation.

Inspect docs, `AGENTS.md`, rules, skills, agents, commands, checklists, and templates. Route in this fixed order:

1. Leave equal or stronger existing guidance unchanged.
2. Extend the closest suitable existing document or component in place, including another Cursor-supported project path.
3. If reusable behavior has a clear trigger or bounded role, create the smallest type-specific component.
4. Only otherwise use the documentation fallback below.

Route explanatory, architecture, or domain context to maintained topical docs. A docs structure is suitable only when project-discoverable and reachable from existing navigation; a `docs/` directory alone is insufficient. Prefer a component despite docs when behavior becomes reliably triggered, reusable, or delegable; do not duplicate its body in docs.

Create collision-safe kebab-case components:

- normative behavior → `.cursor/rules/<name>.mdc`: `description`, suitable `globs`, `alwaysApply` (`true` only when universal). Extend an existing best-fit `AGENTS.md`; otherwise prefer a scoped Rule for new guidance;
- conditional multi-step procedure → `.agents/skills/<name>/SKILL.md`: only `name` and trigger-rich `description` frontmatter; folder and `name` match;
- specialist research/review/audit role → `.cursor/agents/<name>.md`: `name`, `description`, `model: inherit`; body defines task, inputs, boundaries, output;
- compact human-started workflow → `.cursor/commands/<name>.md`: plain Markdown unless the project has a valid command-frontmatter convention.

Validate new components structurally. Use `docs/workflow-learnings.md` only when no suitable guidance exists, no clear component trigger/independent workflow exists, and a durable general note still helps. Link it from existing README, contributor, or agent navigation; remove a fallback entry later superseded by a component.

Never modify product source, runtime configuration, dependencies, generated output, lockfiles, or global/user configuration. Never publish, push, create a PR, deploy, or serialize Workflow state.

## Result and verification

Preserve project style/unrelated changes and validate affected guidance, links, or component structure. Repeated closeout with identical effective inputs produces no diff.

Return Candidate, Source, Result (`applied|already-covered|skipped-unconfirmed|needs-clarification`), Destination, changed paths, and verification. Zero change succeeds when all candidates are covered or skipped.
