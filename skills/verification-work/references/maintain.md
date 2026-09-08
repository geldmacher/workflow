# Maintain a project verifier

Use this reference for explicitly accepted maintenance or to prepare that proposal during read-only planning. The [shared verification guidance](../../../references/verification-work.md) governs authority, trial timing, and evidence boundaries. `maintain` covers agreed affected features; `maintain full` covers the agreed full map. Neither action expands its own scope.

## Locate and compare

Resolve the target through repository guidance and the planned product surface. Keep the existing location and usable structure, including a suitable verifier without separate map files. Narrow multiple candidates from source; ask only if the consequential choice remains unresolved. If none exists, propose creation rather than creating a replacement under maintenance authority.

Read the feature index and feature files, or equivalent coverage in the existing verifier. Check for missing, duplicate, stale, and dead entries within scope. Trace affected features to current source and the approved plan, checking actual entry points, prerequisites, driving recipes, expected results, and relevant side effects. Inspect changed user-facing surfaces for missing coverage using concrete source paths. `maintain full` performs this comparison for every agreed feature. Unrelated drift is a future task.

Distinguish the cause before changing guidance:

- Approved product behavior changed but the description or map did not: update the documented behavior from plan and source evidence.
- The product works but the harness cannot reach or observe it: correct the harness or recipe within the verifier directory.
- The product violates the plan or expected behavior: report a product regression; do not relax the oracle to make verification pass. Product repair requires its own applicable assignment.

Modify only the authorized verifier directory, including its map and owned helpers. Do not migrate a suitable existing verifier merely to match a template. Keep helper invocations documented and scripts executable.

## Exercise the maintained behavior at implementation close

Once product and verifier are ready together, follow the verifier's launch model. Merge overlapping recipes into a small number of useful app states; isolate short-lived sessions and avoid concurrent driving of shared state. Source inspection alone is insufficient even when guidance looks current. Exercise each affected behavior, or every feature in the agreed full map for `maintain full`.

Run Doctor before the first drive, on fresh sessions, and after failures or surprises. If the process looks healthy but the interaction is stuck, reset to a known state or relaunch only an owned instance. For a Doctor failure caused by verifier drift, correct it within scope and retry once, restarting only what the correction invalidates. If readiness still fails, report the blocker. Re-drive behavior affected by any harness correction.

Capture actions, outcomes, and relevant side effects. For an unreachable feature, record the attempted route and concrete missing prerequisite rather than claiming it passed; add missing prerequisites to guidance only when supported. A necessary unreachable check leaves verification incomplete. Clean owned residue after failed attempts and finish with teardown of owned resources. Confirm accumulated evidence survives each cleanup; shared instances and unrelated work are not cleanup targets.

Report changed paths or that no change was needed, source and live coverage, observed drift or product defects, evidence location, and remaining gaps on the resulting working state. Failed or unavailable necessary checks prevent a successful verification completion claim. Hand over changes for separately commissioned Review; maintenance does not start a PR or another phase.
