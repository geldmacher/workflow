---
name: verify-auto-work
description: Verify built Workflow Auto-Work behavior in isolated native-agent trials and local delivery simulations.
---

# Verify Auto-Work

Use this repository-only verifier for an expressly commissioned implementation or verification assignment. Read [the feature index](features/README.md) and only the selected feature recipes. Package checks, content walkthroughs, native runs, and local delivery simulations are different evidence.

From the Workflow repository, build once with `rtk npm run build:targets`. Prepare an owned fixture with `rtk node .agents/skills/verify-auto-work/scripts/fixture.mjs prepare`. Its JSON returns the actual base, workspace, evidence directory and goal. Inspect with the same driver using `inspect BASE`; confirm the baseline and built package exist before starting an agent. The fixture has no persistent service, ports, login, or production dependencies.

Start a fresh native subject agent in the returned workspace, explicitly supplying the absolute built package's `skills/auto-work/SKILL.md` path. Use the host's native task tools and inherit the selected model. In Codex, a separate native subject can spawn fresh reviewer children; keep the outer verification observer out of its implementation and review decisions. Where using the installed CLI, inspect `codex exec --help` first and use its supported workspace sandbox, workspace selection and JSON output options. Supply the skill path directly; do not install or activate a plugin to run this trial. Current CLI availability is not evidence that authentication or delegation succeeds.

Give the subject only the real assignment, fixture and built instructions, not expected findings or the observer's oracle. The subject may edit its workspace, never the verifier, built package, evidence directory or delivery driver. Save subject and reviewer task references, actual messages, check outputs and file snapshots under the returned evidence directory. Observe separate reviewer identities and compare workspace contents around Review. A subject without native delegation must report the gap; do not label a manual observer review as native Auto-Work success.

The driver simulates an external gate under the observer's ownership. Only the observer invokes `deliver BASE REVIEWED_DIGEST authorized-local-simulation`, and only for a commissioned local simulation after examining the actual review evidence. This demonstrates gate behavior and candidate binding, not a production authorization boundary against a malicious process. Without verified real project enforcement, the subject must not claim a real Dark delivery is available.

After each drive, inspect actual files and outcomes against the selected recipe. On failure, inspect fixture health and source/package drift before fixing only commissioned product or verifier defects. Use the same observed failure to choose a targeted rerun; do not tune the expected result to accept it. Cancel only owned native agents if needed. Run `cleanup BASE` after saving evidence: it removes the owned workspace and retains evidence. Verify the reported evidence directory still contains the raw transcript and final snapshot. Never kill by process name or remove arbitrary temporary directories.

At implementation close, run Light and Dark in the available native Codex host, including one seeded-defect correction and fresh re-review. Record exercised and unexercised features and hosts explicitly. Finish with observed results, evidence paths, cleanup outcome, limitations and the complete open learning collection; a separately commissioned Workflow Review remains required for the plugin change.
