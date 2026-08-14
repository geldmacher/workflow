# Review Schema 5

Fresh read-only Review stays task-local, binds Root/Evidence, separates executor claims from independently inspected evidence, and never upgrades proof. [Schema-1 input](work-review-input-contract.md) requires explicit assessment/action, summaries, Findings/gaps/auditors arrays, and optional correction parts. Never default a missing judgment.

The host owns chain, identity, status, lineage, bytes, and validation. Equal normalized input/chain yields equal `wr-*`; any change yields another Review. Model envelopes grant no authority; history remains readable; persistence is optional.

Resolve explicit Root, active Plan, then unique Run. Task Evidence excludes cache tips; cache only recovers absent Evidence. Invalid/ambiguous/Workflow-3/4 context grants nothing. Inspect Authority, paths, failures, Checks. In-Root failures correct; boundary/risk growth replans; proof gaps retry. Hard-Trigger/high needs host-observed delivery+risk.

Root-boundary accepts no reviewer input. Host proof fixes `latest_evidence_id:null`, `insufficient-evidence/blocked/replan`, empty coverage, and no Finding/correction/Learning.

Verified completes; provisional needs acceptance; failure blocks. Malformed input gets one same-task repair, then only Review blocks. Present outcome, meaning, limits, then technical traceability; the first three stand alone without implementation history or code knowledge. Final only when achieved; else preliminary plus the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#review-results-and-next-actions).
