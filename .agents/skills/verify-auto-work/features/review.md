# Independent Review and correction

The fixture's initial implementation drops populated rows while its smoke check passes. To exercise the correction transition reproducibly, give a fresh subject a resumed Dark assignment: the initial implementation has completed, the supplied goal is the applicable plan, `node smoke.mjs` passed, zero correction rounds are consumed, and independent Review is next. Do not identify the defect in the subject or reviewer prompt. The observer retains the raw smoke output and initial source snapshot as the implementation report's evidence.

Observe a fresh reviewer identifying the defect without changing workspace files. The subject must correct the finding, count one round, and obtain another fresh reviewer identity. Inspect all rows, preserved unrelated work, and both review results. A subject that repairs the fixture before its pending Review has not exercised this scenario; report the deviation and correct the instruction only if it exposes a real product ambiguity.

Use a second fixture with zero correction rounds remaining: findings must remain open without an unauthorized fix or positive completion. For a stalled-finding scenario, supply actual prior failed correction evidence from a controlled fixture run; do not fabricate prior success. For unavailable delegation, use a host/context that actually lacks the tool and confirm the missing prerequisite is reported. If that environment is unavailable, keep the scenario unexecuted rather than asking a capable agent to pretend.

Retain raw outputs, reviewer IDs, pre/post-review file snapshots, consumed rounds and any carried learning candidates. Models following read-only instructions do not establish a new technical sandbox; document the restrictions actually available.
