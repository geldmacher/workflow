# Manual Workflow

## Plan and Authority Core

Plan Work produces a comprehensive human implementation prompt as free-form Markdown. The local `build-plan` operation appends exactly one expandable generated `yaml workflow-authority` block. The Core binds normalized plan content, its own semantic fields, goal, acceptance, risk, hard triggers, authority, and structured verification intent. Formatting is never authority.

The human selects the host-native **Implement Plan** action. Implementation stays inside the exact Root authority and creates no Evidence or state. Its handoff is only **Fresh Review pending**.

## Fresh Review

Review is repository-read-only. The harness selects concrete inspection mechanisms and supplies closed repository and Check observations. Workflow validates the exact Root, canonical workspace binding, and predecessor bytes, partitions subject and ambient paths, computes hashes and grades, and atomically builds Evidence plus Review.

Review exposes exactly:

- **Achieved**: no Findings/Open Points and all required Checks at least supported.
- **Correction needed**: at least one current in-Root correctable Finding and one complete bounded Correction.
- **Open points**: a concrete evidence, authority, intent, environment, formal-binding, or no-progress point needs natural human assessment.

Evidence grade remains separate. Missing protected attestation alone is a proof limit, not a reason to downgrade Achieved. Failed remains failed.

Missing required Check observations create no artifacts and trigger an internal retry naming exact Check IDs. Retry continues only with measurable progress; repeated identical failure becomes a `no-progress` Open Point. Explicit unavailability is an Open Point.

Invalid formal binding does not make Review useless. The harness still inspects the human plan repository-read-only; Workflow returns a Shadow Review with Findings and Open Points, no artifacts, and no correction authority.

## Correction loop

One Correct Work invocation is a separate explicit human authorization for only the current exact Correction. Every correctable Finding is covered, targets stay inside Root authority, and steps reuse original Root Check IDs. Correction creates no Evidence or state and ends **Fresh Review pending**. The human separately starts the next Review Work.

Changed intent, risk, authority, dependencies, or external effects becomes an Open Point. The human may stop or deliberately request a new Plan Work invocation; no hidden transition is persisted.

## Human state and failure boundary

Status is only Root ready, Review needed, Correction needed, Achieved, Open points, or Shadow review. Human actions are only Implement Plan, Review Work, Correct Work, a natural assessment, or none. Technical retries stay internal.

Ordinary repository use remains available when Workflow, MCP, adapter, hooks, transport, or harness capabilities fail. Review and explanation never mutate. Deployment, installation, commit, push, release, production access, and learning remain separate actions.
