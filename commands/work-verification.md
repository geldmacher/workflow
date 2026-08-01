---
name: work-verification
description: Draft, prove, approve, or audit one project Verification Profile.
---

# /work-verification

Read [work-automation](../skills/work-automation/SKILL.md). Accept `draft <surface>`, `prove`, `approve <profile-hash>`, or `audit`.

Manual needs no Verification Profile. Supervised does not require one for profile eligibility. Autonomous requires the exact proved, human-approved hash and a clean current audit.

Call `workflow_verification_profile`. `draft` may create only the manifest, project-local verification Skill, and Feature Map. `prove` runs the configured Verifier read-only through launch, doctor, drive, observe, evidence, reset, and cleanup; proof files go only to the external artifact directory and the Controller hashes them. Never fabricate capability results. `approve` is the human activation of exactly the displayed combined hash. `audit` is read-only and reports `clean`, `changed`, or `blocked`.
