# Work Review semantic input

The reviewer supplies one closed Schema-1 semantic assessment: assessment, recommended lifecycle action, summary, repository snapshot assessment, findings, missing evidence, and an optional outcome-based correction proposal.

The reviewer does not author Schema-6 envelopes, artifact IDs, hashes, lineage, receipts, snapshot hashes, or evidence grades. Correction checks use verification intent, expected evidence, required flag, evidence class, cost class, and prerequisites. Commands, working directories, tools, models, routes, retries, and host recipes are forbidden.

Repository assessment and proof calibration are separate. `supported` requires an unambiguous outcome on the exact current snapshot. A finding-free consistent assessment with all required Checks supported recommends `none` and may conclude `achieved`; proof still remains below verified. Command invocation, source presence, masked exit status, or an unknown outcome is `partial` or `unavailable`. Exact observations already present in the same task may be reused while the repository snapshot is unchanged.

Workflow validates the exact chain, calibrates evidence from protected harness attestations, assigns identities, and serializes the authoritative artifact.
