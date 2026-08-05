# Capability spike and activation status

Supervised and autonomous are activation-gated, not merely feature-flagged. Manual does not need these observations. Supervised needs all hard controller capabilities before writable execution; autonomous needs additional exact qualification. See the [profile guide](profiles.md) for the user-facing comparison. The shipped controller must observe all of the following before it may create a writable SDK run:

| Capability | Required observation |
|---|---|
| Local MCP packaging | The built server starts through `${CURSOR_PLUGIN_ROOT}` and lists exactly twelve tools. |
| Marketplace packaging | The installed Marketplace copy starts the same pinned MCP bundle and resolves the exact SDK/platform runtime without installation-on-first-use. |
| Model routing | Every role's exact ID, reasoning parameter and options exist in the live catalog. |
| Model attestation | A paid read-only SDK smoke reports the same accepted and observed selection plus request/agent IDs and usage. |
| Planner submission | A paid Plan-mode smoke captures exactly one Cursor `CreatePlan` argument, rejects Plan/Blocker ambiguity, preserves read-only repository state, and resumes technical repair with the same Agent. |
| SDK write boundary | A real local Agent cannot modify anything outside its explicit writer targets. |
| Worker network boundary | Model transport works while product tool calls cannot reach unapproved network destinations. |
| SDK secret boundary | Product tool calls cannot read `CURSOR_API_KEY` or controller-only secrets. |
| Budget cancellation | An in-flight SDK run observes the atomic Controller sentinel or deadline, calls `Run.cancel()`, and yields a terminal `cancelled` receipt inside the grace period. A hard kill is `interrupted`. |
| Worktree/state/restart | External worktree, atomic state, interruption detection and explicit resume are repeatable. |

## Current result for the pinned adapter

The MCP/controller is bundled, while the worker deliberately keeps `@cursor/sdk` as an exact external runtime dependency. The build does not copy the SDK into `dist`. A development checkout or `GELDMACHER_WORKFLOW_WORKER` may resolve a Worker for tests, but its provenance is explicitly automation-ineligible. Only `npm run provision:worker-runtime -- --marketplace-git-commit <exact-sha>`, invoked manually in the actually installed Marketplace copy, may create the pinned runtime below `~/.cursor/geldmacher-workflow/runtime/5.2.0/1.0.24/<platform>/`. In a real Git checkout the exact `HEAD` may be detected instead. It stages `npm ci --omit=dev --ignore-scripts`, never uses `latest`, `npx`, overrides, or install-on-first-use, and atomically publishes a manifest binding the Marketplace commit, Plugin, Worker, lockfile inventory, SDK, platform package, Node, and runtime hashes.

At Controller runtime the exact Cursor host version must also be observable as `GELDMACHER_WORKFLOW_CURSOR_VERSION` or `CURSOR_VERSION`; otherwise the receipt is not accepted. The value must match the certified receipt exactly.

The current worker needs network access for SDK model transport. The Adapter now supplies a minimal environment and removes `CURSOR_API_KEY` from the Worker process after SDK construction, but a real SDK smoke must still prove that model-invoked tools cannot recover Controller secrets or reach unapproved destinations. SDK `sandboxOptions.enabled` and classifier-based Auto-review are not proof.

A production dependency audit is an external, time-bound certification input, not a repository-test claim. Run it only with explicit network authorization and record its lockfile/evidence hashes. Any fresh finding blocks activation until the minimal dependency fix or a separate hash-bound human risk acceptance; High/Critical findings must never pass implicitly. If no fresh audit exists, report it unavailable. Never use `npm audit fix` or `--force` automatically.

Therefore a fresh installation has no valid `capability-receipt.json`; `planner_submission_verified`, `worker_network_isolated`, and `sdk_secret_isolated` resolve false, and both auto profiles remain in read-only Shadow Mode. This is an intentional negative capability result, not a silent partial activation. The manual workflow, `/explain-work`, model validation, status, and deterministic controller simulation remain usable.

## Running the spike

Static release checks build and launch the local MCP bundle, distinguish local, isolated, provisioned, and Marketplace worker provenance, exercise filesystem sandbox denial, validate Preparation/Run external state locking, and test the model-catalog contract with mocks. Use `npm run capability-spike` for the local negative report. `--live-models` requires a valid `CURSOR_API_KEY`; `--approve-sdk-cost` also requires `--max-cost-usd` no greater than 6 and authorizes the three-run inference probes. Missing usage or price data fails the cost gate. It does not waive any failed boundary.

The receipt-bearing invocation is intentionally explicit:

```bash
npm run capability-spike -- --workspace /absolute/certification/repo --marketplace-root /absolute/installed/plugin --route-profile certification-v1 --live-models --approve-sdk-cost --max-cost-usd 6 --cursor-version <exact-version> --marketplace-git-commit <exact-sha> --cursor-harness-report /private/tmp/cursor-plugin-harness/report.json --crash-probe-report /private/tmp/cursor-plugin-harness/crash-probe.json --issue-receipt --require-automation-safe
```

The two external reports are accepted only as hashed inputs with `verified: true`; the crash report additionally declares at least three independent repetitions. They do not bypass the live SDK, audit, Marketplace, model, boundary, cancel, planner, or exact-configuration probes executed by the spike.

Marketplace verification must point at the actually installed plugin root, not this development checkout. Record failures as failures or blocked observations; never create a positive receipt from assumptions, a Markdown statement, or a classifier decision.

The pinned SDK declares an all-rights-reserved Cursor SDK license subject to Cursor's Terms of Service. It is therefore not vendored into this plugin. Any future redistribution form must first be cleared; local technical success is not legal clearance.

Only a future adapter/spike that produces all positive machine observations for the exact SDK/plugin/platform versions may write:

```text
~/.cursor/geldmacher-workflow/state/<repo-hash>/capability-receipt.json
```

Receipt Schema 4 is closed; older schemas are rejected without migration. It binds the exact Plugin, Controller, artifact schema, SDK, platform, host, Marketplace commit, canonical Plugin/Worker/runtime/lock hashes, route, catalog, harnesses, model configurations/IDs, audit evidence, and twelve observations. Security-critical observations require three repetitions. Expiry is at most 30 days. `automation_safe` is derived and accepted only while every live hash matches.

The complete operational sequence, qualifying-history matrix, and Unattended pilots are in the [certification runbook](certification-runbook.md).
