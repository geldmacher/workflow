# Manual Workflow contract

The default human loop is **Plan → Implement → Review → Correct → Review**.

1. Plan Work writes comprehensive free-form Markdown and local `build-plan` adds one generated Authority Core.
2. The human authorizes implementation through the host's native Implement Plan action.
3. The human starts fresh repository-read-only Review Work.
4. Review returns exactly Achieved, Correction needed, or Open points.
5. The human separately authorizes each bounded Correct Work action and separately starts the next Review Work.
6. Open Points end with a natural-language human assessment. A human may stop or deliberately request a new plan; neither decision is persisted as a hidden transition.

Manual, Supervised, and Autonomous use these same outcomes and correction path. Profiles differ only in harness attestation, qualification, and execution capability. There is no final delivery-acceptance gate.

Workflow owns intent, authority, lineage, evidence grades, artifacts, and human phase gates. The project harness owns commands, tools, models, framework knowledge, worktrees, retries, and verification strategy. Ordinary Cursor and Codex use remains fail-open when Workflow infrastructure is unavailable.

Planning may project non-authoritative project-verifier readiness for acceptance that needs live behavioral proof beyond established checks. `workflow-doctor` is read-only. `verification-work` may create or maintain `.agents/skills/verify-*` only inside an approved implementation or correction boundary that already authorizes the exact destination and outcome. This adds no phase, schema field, playbook gate, evidence grade, or automatic Learning.

The only human-facing actions are **Implement Plan**, **Review Work**, **Correct Work**, a natural assessment of named Open Points, or none. Technical retries stay internal. Unsupported earlier actions and plan/review forms fail clearly and never create a success path.

Missing protected attestation caps proof at supported; it does not by itself prevent Achieved. Known failed required Checks remain failed. Repository-only remains the finish line: no automatic push, PR, merge, deploy, production access, publication, or learning.
