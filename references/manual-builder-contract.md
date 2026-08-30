# Stateless Manual builder contract

`dist/manual-workflow.mjs` is the host-neutral, repository-read-only construction boundary for the Schema-6 Manual lifecycle. It requires Node.js 22, reads one closed JSON object from standard input, writes one deterministic JSON result to standard output, and accepts the operation name as its sole positional argument.

The public input schema is `schemas/manual-workflow/request-1.schema.json`. Every operation uses `schema: 1` and an exact matching `operation`. Unknown properties are rejected. Every request may include `presentation_locale: de|en`; omission defaults to `en`. Locale affects fixed presentation text only and never enters artifact bytes, IDs, hashes, lineage, authority, grades, or action tokens.

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
- repository-relative `subject_changed_paths`
- repository-relative `ambient_changed_paths`
- non-empty opaque `snapshot_material`
- explicit `limitations`

The two path arrays are complete, disjoint, and snapshot-bound. Subject paths are the Root delivery; ambient paths are observed dirty-tree state outside that delivery. Materially uncertain attribution belongs in `subject_changed_paths`. Only subject paths are classified against Root authority.

Each Check observation contains only `check_id`, `grade`, `observed`, `evidence_material`, and `limitations`. Local grades are limited to `supported`, `partial`, `unavailable`, and `failed`. Required Checks must be observed or become unavailable; optional Root Checks may be supplied or omitted. `supported`, `partial`, and `failed` require evidence material; `partial` and `unavailable` require a limitation. Supplied hashes, attestations, receipts, or `verified` claims are rejected. The builder hashes opaque material itself and caps all unprotected observations below verified.

## Atomic result

A successful `build-review` result contains:

- Root, intent, workspace, snapshot, Evidence, and Review hashes computed by the builder;
- exactly one `delivery-evidence` entry and one `work-review` entry with immutable Markdown bytes;
- one `presentation` whose assessment, evidence grade, findings, limitations, and `next_action` are projected from the same authoritative result;
- localized `human_output` ready for the target facade to decorate the authoritative action and then present before the two exact artifact texts.

`human_output` is a non-authoritative progressive projection. Its bounded first layer names the delivery or lifecycle subject, human decision, concrete reason, required-Check outcome, scope impact, at most one primary proof boundary, and one next action. It never labels ordinary host or Workflow availability as blocked. Full findings, Checks, distinct limitations, path details, IDs, and hashes remain exactly once in default-closed details; empty sections and repeated limitations are omitted. A failed required Check is a delivery blocker even when its finding severity is lower, while absent protected proof is described separately as an evidence boundary.

Action authority remains operation-specific: Review uses `presentation.next_action`, status and provisional acceptance use `snapshot.next_action`, Shadow uses its top-level `next_action`, and plan validation derives `implement-plan` or `correct-plan` only from `result.feasible`. The builder emits canonical tokens and no host invocation syntax. A facade may decorate only that token and must not reassess the result.

Invalid JSON, unsupported schemas, invalid or ambiguous lineage, conflicting bytes, foreign or stale chain material, unknown Checks, and malformed observations return `kind: manual-workflow-error`, `mode: shadow`, `artifacts: []`, and a stable recovery action. The builder never deletes or changes the Root or predecessor bytes held in the task.

Evidence keeps every observed repository-internal path, with delivery `changed_paths` and separate `ambient_paths`. The builder returns a deterministic `path_authority` projection with `allowed_paths`, `outside_allowed_paths`, `approval_required_paths`, `protected_paths`, and `ambient_paths`. Ordinary subject paths outside `allowed_roots` cap Manual delivery at provisional and may be accepted only ephemerally; ambient paths grant no authority and cause no delivery decision. Protected and approval-required subject paths remain visible but force a blocked `clarify` decision. Absolute, traversal, malformed, overlapping, or repository/symlink-escaping paths return Shadow without artifacts. Protected automation and sealing retain hard Root authority.

Authority patterns are repository-relative POSIX paths. Literal roots match themselves and descendants, `*` matches within one segment, and `**` is recursive only as a complete segment and may match zero or more segments. Protected takes precedence over approval-required, then allowed, then outside-allowed. Overlap is valid and resolved by that precedence.

## Transport and authority

The normal transport is the current task. A fresh task must receive the exact current Root and every referenced Evidence/Review artifact explicitly. Review facades place each returned artifact text exactly once, unchanged and unquoted, inside its own default-closed disclosure block. Wrapper markup is presentation only. IDs, cache, handoff, hook state, MCP state, or host memory without the exact bytes are insufficient.

The local builder is deterministic construction, not protected execution. A successful unprotected Review therefore keeps provisional delivery proof, but supported current evidence may still establish an achieved repository outcome with `next_action: none`. Optional protected sealing may later append new Evidence and Review artifacts, but it never edits or upgrades already emitted Manual artifacts.
