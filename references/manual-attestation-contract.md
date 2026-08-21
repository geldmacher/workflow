# Manual task authority

Cursor and Codex Manual authority comes only from human actions in the current task: native planning, **Implement Plan**, Review, correction, replan, provisional acceptance, and learning remain separate. Pre-5.5 active-root, plan-transaction, chain, closeout, and handoff state is inert.

Native implementation and correction use no closeout attestation. They emit no `closeout-input`, `delivery-report`, Evidence ID, automatic persistence request, Stop continuation, or recovery command. Normal host sandboxing and approval prompts remain authoritative.

Fresh Review resolves the exact Schema-5 Root from the current native Plan context. Cursor receives it from protected observation of successful `CreatePlan` plus the same-conversation human **Implement Plan** action; Codex supplies exact native Plan bytes. Resolution is one of:

- `resolved { root_text, root_id, root_hash, source }`
- `unavailable { attempted_sources[], resolution }`
- `unapproved { attempted_sources[], resolution }`
- `invalid { rejected_sources[], resolution }`
- `ambiguous { candidate_ids[], attempted_sources[], resolution }`

Unavailable or ambiguous Root blocks Review before substantive inspection and names the native sources attempted. The only remedy is to restore the Plan in the same task or create and approve a new native Plan. Caches, active-root files, artifact handoff, IDs without bytes, or another task never substitute.

The reviewer calls `workflow_closeout` once in work-review mode. Cursor supplies semantic Review input while a matching five-minute single-use host receipt supplies exact Root/predecessor bytes; Codex and portable clients keep the exact-input path. `structuredContent` returns exact paired Evidence and Review bytes, IDs, hashes, authoritative fields, repository observation, and `handoff_persisted: false`. Cursor also returns native binding/source and predecessor mode. Those returned bytes are authoritative within the current task even when persistence is unavailable.

Legacy typed closeout parsing and delivery-evidence mode remain closed, wire-compatible portable-client inputs. Free-form markers, prose IDs, caller-authored aggregate grades, or supplied path scope never grant authority.
