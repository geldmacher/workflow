# Migrating from Workflow 4 to Workflow 5

Workflow 5 is a clean protocol cut, not an in-place artifact migration. Finish active Workflow-4 work before upgrading, or start it again from a fresh Schema-5 Intent Root. Workflow-3/4 artifacts, Preparations, and Runs remain status/watch-readable, immutable, non-blocking, and non-qualifying.

## New version bindings

- Plugin `5.3.0`
- Artifact Schema `5`
- Controller Protocol `5`
- Run/Preparation Record Schema `2`
- Capability Receipt Schema `4`
- User Config and Project Policy Schema `2`

Capability Receipts must be repeated because Plugin 5.3 and the canonical release hash changed. Workflow-5 Run, Preparation, and handoff records remain compatible across minor releases when their record, Artifact, and Controller schemas match.

The profile meaning is unchanged: Manual is human-driven, supervised delegates execution but not delivery acceptance, and autonomous may omit final acceptance only for an exact qualified Run with complete verified evidence. See the [profile guide](profiles.md) for the current requirements.

## Manual delivery

The Lean Intent Root and `/plan-work -> Implement Plan -> /review-work -> optional /correct-work` sequence remain unchanged. In 5.3, Implement Plan ends with one strict native `closeout-input`; Cursor and Codex lifecycle hooks independently bind exact Root bytes and lineage, derive repository snapshot and changed paths, call the existing deterministic builder, and persist Evidence without requiring MCP. New plans use `action: delivery-closeout`; legacy `action: workflow_closeout`, all five Manual MCP tools, and their delivery-report wire contracts remain valid. Every Manual Root receives local host preflight, while standalone MCP preflight and record/context are optional transport. Fresh review may recover missing Evidence through one read-only continuation. Repository gates do not certify live host activation. New `delivery-evidence` adds `evidence_mode` and `changed_paths`:

- Manual low/medium risk without Hard Triggers defaults to `lean`; `full` remains valid.
- Manual high risk or any Hard Trigger requires `full`.
- Supervised and autonomous require `full`.

Lean Evidence carries its semantic proof in closed frontmatter and needs only a meaningful `Summary`. Missing `strategy_revision` is interpreted as `0`; a missing per-Check `baseline_or_patched` is interpreted as `patched`. These defaults do not rewrite artifacts.

Manual context commands now share one fail-closed selector contract: an explicit ID wins; otherwise the unique active native Plan lineage of the current task wins. Only when no Manual Plan is active may supported read-only commands use one unique active controller subject. Zero or multiple candidates request context before producing an artifact or mutation.

Exact Schema-5 Roots, Evidences, and reviews can cross fresh Cursor contexts through the root-content external handoff cache, namespaced by the full SHA-256 of exact Root text. It is append-only Schema 1 transport, is revalidated on every read, and never creates authority or workflow state. Append-only Multi-Tips under `handoff/tips/<wp-id>/<root-content-sha256>.json` let different exact Root texts that share one visible `wp-*` ID coexist; exact Root lookup remains deterministic, ID-only lookup succeeds only for one unique hash, and ambiguous ID lookup fails closed. Legacy single-tip files remain readable without deletion. Legacy repository-key stores remain readable and may be migrated with `npm run migrate:handoff`.

`/accept-work provisional` accepts only the unique active Schema-5 Manual provisional review tip; `/accept-work <wp-id> provisional` remains compatible. Its `accepted-provisional` result reports the resolved Root and artifact-set hash, is ephemeral, and creates no controller state, repository artifact, Qualification History, or Learning publication. Verified Manual reviews remain directly `achieved`.

`/plan-work replan [wp-id]` is new. It requires the selected or active Schema-5 Root's current review to say `next_action: replan`, preserves confirmed decisions and unchanged authority boundaries, and emits a fresh approval-required Root. Replan Roots carry both `predecessor_plan_id` and `replan_source_review_id`; initial Roots carry neither. Validators reject incomplete pairs, stale or foreign source reviews, self-reference, cycles, and branched successors. Selectorless commands resolve only a unique lineage tip.
