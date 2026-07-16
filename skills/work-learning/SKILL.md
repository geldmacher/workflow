---
name: work-learning
description: Persist confirmed correction learnings in project-local guidance at a human-selected Workflow stop. Use for `/learn-from-work` with or without one supplemental instruction.
---

Use Cursor Agent Mode. Read [protocol](../../references/artifact-protocol.md) and [learning](../../references/learning-contract.md) completely; let Cursor determine capabilities.

Treat invocation as optional human closeout and authorization for bounded project-guidance edits. Interpret all trailing text as one manual Learning, never an ID. Resolve exactly one valid root/review/evidence chain; require artifacts in a fresh task and stop before mutation if resolution is missing or ambiguous.

Collect candidates chronologically. Accept one only when complete correction evidence names its `cp-*` as `subject_id` and current repository inspection confirms it. Skip legacy, pending, blocked, contradicted, or unexecuted work. Verify a manual Learning's project relevance; do not override unresolved higher-priority guidance.

Deduplicate, then route strictly: keep equal/stronger guidance; extend the closest suitable existing guidance; create a reusable type-specific component; only then use the docs fallback. Route context to maintained navigable docs, normative behavior to `.cursor/rules`, conditional procedures to `.agents/skills`, specialist roles to `.cursor/agents`, and compact human-started workflows to `.cursor/commands`. Update matches in other Cursor-supported paths in place.

Prefer a component over docs when it improves triggering, reuse, or delegation; do not duplicate it in docs. Docs are suitable only when maintained, topical, discoverable, and navigation-linked. Use `docs/workflow-learnings.md` only for a durable general note with neither suitable guidance nor a clear component; link it from existing navigation and remove a migrated fallback entry. Use collision-safe kebab-case names, target-specific structure, project style, and structural validation.

Do not change product source, runtime configuration, dependencies, generated files, lockfiles, or global/user configuration. Do not publish, push, create a PR, deploy, or serialize Workflow state. Preserve unrelated work; validate economically and make repeated invocation diff-free.

Return each candidate with `applied|already-covered|skipped-unconfirmed|needs-clarification`, source, destination, changed paths, and verification.
