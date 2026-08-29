# Stateless Manual builder contract

`dist/manual-workflow.mjs` is the host-neutral, repository-read-only construction boundary for the Schema-6 Manual lifecycle. It requires Node.js 22, reads one closed JSON object from standard input, writes one deterministic JSON result to standard output, and accepts the operation name as its sole positional argument.

The public input schema is `schemas/manual-workflow/request-1.schema.json`. Every operation uses `schema: 1` and an exact matching `operation`. Unknown properties are rejected.

## Stable operations

- `validate-plan` accepts `root_plan` and validates the exact Schema-6 Root locally. It creates no artifact and grants no approval.
- `build-review` accepts `root_plan`, exact predecessor `artifacts`, one closed `review_input`, one `unprotected-repository-observation`, and `check_observations`. It returns either one atomic Evidence/Review pair or no artifacts.
- `status` accepts `root_plan` plus exact current `artifacts` and derives Manual state only from those bytes.
- `accept-provisional` accepts the same exact chain as `status`. It succeeds only for the unique current non-failed provisional Review tip and returns an ephemeral, non-persisted acknowledgement. Rejection preserves the exact Review action (`correct`, `clarify`, `replan`, or `retry-review`); missing valid chain bytes return `provide-artifacts`.

The builder performs no repository discovery, Git operation, Check, command, tool call, framework selection, cache lookup, MCP request, Hook lookup, state write, or artifact persistence. The project harness supplies opaque read-only observations; Skills supply the semantic Review input.

## Review observations

`repository_observation` contains only:

- `schema: 1`
- `kind: unprotected-repository-observation`
- the absolute `repository_root`
- repository-relative `changed_paths`
- non-empty opaque `snapshot_material`
- explicit `limitations`

Each Check observation contains only `check_id`, `grade`, `observed`, `evidence_material`, and `limitations`. Local grades are limited to `supported`, `partial`, `unavailable`, and `failed`. `supported`, `partial`, and `failed` require evidence material; `partial` and `unavailable` require a limitation. Supplied hashes, attestations, receipts, or `verified` claims are rejected. The builder hashes opaque material itself and caps all unprotected observations below verified.

## Atomic result

A successful `build-review` result contains:

- Root, intent, workspace, snapshot, Evidence, and Review hashes computed by the builder;
- exactly one `delivery-evidence` entry and one `work-review` entry with immutable Markdown bytes;
- one `presentation` whose assessment, evidence grade, findings, limitations, and `next_action` are projected from the same authoritative result;
- `human_output` ready to present before the two exact artifact texts.

Invalid JSON, unsupported schemas, invalid or ambiguous lineage, conflicting bytes, foreign or stale chain material, unknown Checks, and malformed observations return `kind: manual-workflow-error`, `mode: shadow`, `artifacts: []`, and a stable recovery action. The builder never deletes or changes the Root or predecessor bytes held in the task.

Evidence keeps every observed repository-internal changed path. The builder returns a deterministic `path_authority` projection with `allowed_paths`, `outside_allowed_paths`, `approval_required_paths`, and `protected_paths`. Ordinary paths outside `allowed_roots` cap Manual delivery at provisional and may be accepted only ephemerally; this does not grant authority or verified evidence. Protected and approval-required paths remain visible but force a blocked `clarify` decision. Absolute, traversal, malformed, or repository/symlink-escaping paths return Shadow without artifacts. Protected automation and sealing retain hard Root authority.

Authority patterns are repository-relative POSIX paths. Literal roots match themselves and descendants, `*` matches within one segment, and `**` is recursive only as a complete segment and may match zero or more segments. Protected takes precedence over approval-required, then allowed, then outside-allowed. Overlap is valid and resolved by that precedence.

## Transport and authority

The normal transport is the current task. A fresh task must receive the exact current Root and every referenced Evidence/Review artifact explicitly. IDs, cache, handoff, hook state, MCP state, or host memory without those bytes are insufficient.

The local builder is deterministic construction, not protected execution. A successful unprotected Review therefore ends at most `provisional`. Optional protected sealing may later append new Evidence and Review artifacts, but it never edits or upgrades already emitted Manual artifacts.
