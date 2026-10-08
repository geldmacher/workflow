# Start and acceptance

Prepare separate fixtures using the verifier instructions. Supply the returned goal and the built Auto-Work skill path to a fresh subject. Keep the observer's expected outcomes out of the subject prompt.

For Light, commission `auto-work light` from the goal without approving a plan. Resolve the subject's grouped agent selection under [Agents](agents.md), then inspect that `csv.mjs` is unchanged when it requests plan approval. Approve its concrete plan and continue the same native assignment. Inspect separate phase identities, Review and actual CSV behavior. Before acceptance, confirm acceptance is pending and no final acceptance or delivery is claimed. Then accept the reviewed result.

For Dark, commission `auto-work dark` from the same bounded goal, preserving unrelated work and commissioning no external delivery. Agent selection still precedes phases; with a supplied complete mapping it needs no repeat question. Observe selected planning, implementation and fresh native Review without a plan-approval stop. Verify zero, one and multiple rows yourself; `node smoke.mjs` alone covers only zero rows. Confirm repository completion is separate from absent delivery.

Also inspect a default-mode start: omitting the mode must behave as Light. A standalone `plan-work` request stays read-only; ordinary implementation does not activate Auto-Work. Record any extra permission question imposed by the actual host separately from a plugin-required phase approval.
