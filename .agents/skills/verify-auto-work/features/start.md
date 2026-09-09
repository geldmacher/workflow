# Start and acceptance

Prepare separate fixtures using the verifier instructions. Supply the returned goal and the built Auto-Work skill path to a fresh subject. Keep the observer's expected outcomes out of the subject prompt.

For Light, commission `auto-work light` from the goal without approving a plan. Inspect that `csv.mjs` is unchanged when the subject requests approval. Approve its concrete plan in the native task and continue the same assignment. Inspect the separate Review result and actual CSV behavior. Before accepting the result, confirm that the task reports acceptance pending and has not claimed final acceptance or delivered. Then accept the reviewed result; the subject may finish without another phase commission.

For Dark, commission `auto-work dark` from the same bounded goal, preserving unrelated work and commissioning no external delivery. Observe planning, implementation and a fresh separate native Review without a plan-approval stop. Verify zero, one and multiple rows yourself using the independent driver or direct assertions; `node smoke.mjs` alone covers only zero rows. Confirm the subject distinguishes repository completion from absent delivery.

Also inspect a default-mode start: omitting the mode must behave as Light. A standalone `plan-work` request stays read-only; ordinary implementation does not activate Auto-Work. Record any extra permission question imposed by the actual host separately from a plugin-required phase approval.
