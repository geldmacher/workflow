---
name: work-execution
description: Apply one approved correction and return evidence.
---

Read [protocol](../../references/artifact-protocol.md), [correction](../../references/correction-contract.md), [evidence](../../references/delivery-evidence-contract.md), and [output](../../references/delivery-evidence-output-contract.md) completely.

Resolve the unique actionable correction and evidence tip. Reject invalid, ambiguous, Workflow-3-only, or mixed chains before mutation. Use the validator when available; otherwise check root, Strategy revision, chain, scope, reuse, risk, and approval.

Refresh the repository and classify every FIX `satisfied|pending|partial|conflicted`. Execute only pending/partial FIXes, preserve partial work, and stop on conflict or changed intent, scope, or risk. Verification-only avoids edits. Run affected Checks, justify reuse, return evidence, never materialize Learning candidates, and hand control to Ask `/review-work`.
