---
name: verify-project-setup
description: Verify Workflow project setup, maintenance, readiness offers, and verifier cooperation in isolated native trials.
---

# Verify project setup

Use for commissioned implementation or verification of these Workflow features. Read the [feature index](features/README.md) and only affected recipes. This repository-only verifier is not part of distributed plugins.

Build the candidate once with `npm run build:targets`. From the repository run `node .agents/skills/verify-project-setup/scripts/fixture.mjs prepare SCENARIO`, choosing the recipe's feedback or `northstar-*` fixture. The returned workspace is the subject's only writable project. Keep the returned evidence directory and observer driver outside the subject's assignment. Record the built package digest, host/version, model, exact assignment and native task references in evidence.

Before each drive, run the driver's `inspect BASE` and `probe BASE`. The regression fixture intentionally fails the observer's product probe; other fixtures must pass it. There is no service, port, login or production dependency. A fixture failure must be diagnosed before attributing it to the skill. For native CLI trials, inspect actual binary/version and supported options, model compatibility and authentication first. Diagnose nested macOS sandbox failures without removing protection. Missing host access is unavailable proof.

Start fresh native subjects with inherited model settings and the built candidate's relevant skill path, raw fixture files and realistic assignment. Keep expected findings and these recipes out of the subject prompt. In Codex, use native subject agents restricted by assignment to the fixture; use available host restrictions. For Cursor selection trials, inspect `agent --help` and use its supported `--plugin-dir` and `--workspace` options with the built Cursor package. Give the subject the candidate plugin root and fixture workspace as its read boundaries, without naming the expected skill. Exclude observer evidence, recipes, source checkouts, user plans, and installed Workflow copies from that assignment. Record competing installed instructions; a run that reads observer recipes or only another plugin copy is contaminated evidence, not a passing candidate trial. Do not install plugins or change host settings.

Observe actual skill reads, tool actions, check outputs and before/after files; a subject's final claim is insufficient. Use `inspect BASE` between turns and `probe BASE` after mutations. Retain raw events or accessible task references plus retrieved messages. Save the observer's judgments outside the workspace. Preserve evidence of failed attempts and rerun only affected behavior after a justified correction. Keep the built candidate fixed during a trial.

At implementation close, exercise affected recipes, including [playbook packages](features/playbooks.md) and [project roles](features/subagents.md), in native Codex. Run the selection contrasts and affected package/role cases in Cursor. Use the existing [Auto-Work verifier](../verify-auto-work/SKILL.md) and its Light/Dark start and review recipes for affected transitions; a separate native reviewer remains necessary there. These fixture trials are behavioral checks, not the separately commissioned Workflow Review of the plugin change.

For project-direction changes, use [north-star continuity](features/north-star.md), including fresh continuation and read-only boundaries. Exercise the affected cases in Codex and Cursor; unavailable authentication remains missing proof.

After capturing evidence, run `cleanup BASE`. It retains baseline, final file contents and observations outside the deleted workspace. Verify transcripts or task references and snapshots still exist. Clean only owned resources, including failed attempts. Report exercised features and hosts, unavailable proof, actual outcomes, cleanup and remaining learning candidates. A necessary failed or missing trial prevents a positive verification completion claim.
