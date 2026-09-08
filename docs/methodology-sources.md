# Methodology sources

This repository-only document records the origins and maintenance decisions for external methodology. It is excluded from plugin packages. Packaged skills and references contain the maintained Workflow instructions without external methodology dependencies. Required attribution and license text ship in THIRD_PARTY_NOTICES.md.

## pstack

The original engineering playbook taxonomy was independently adapted from pstack in `cursor/plugins`, commit `bdf7aa355337897f167153e05069aca505dae17c`. The expanded playbooks use the directly inspected source at commit `71ed0d1076fec562c1b74ee353121a8d00f75382`, including adapted text under its [MIT license](https://github.com/cursor/plugins/blob/71ed0d1076fec562c1b74ee353121a8d00f75382/pstack/LICENSE), Copyright (c) 2026 Lauren Tan.

The following mapping records the source comparison for all 14 methods. Original names refer to files in the pinned [playbook directory](https://github.com/cursor/plugins/tree/71ed0d1076fec562c1b74ee353121a8d00f75382/pstack/skills/poteto-mode/playbooks); each Workflow ID names its reference in `skills/engineering-work/references/`.

| Workflow ID | Original file | Retained substance and deliberate adaptation |
|---|---|---|
| `investigation` | `investigation.md` | Evidence-backed explanation, history for motivation, tradeoffs, and a defensible judgment. Replace how/why/unslop routing and fixed output sections with direct investigation and task-appropriate reporting. |
| `runtime-forensics` | `runtime-forensics.md` | Capture, reduce, confirm, and attribute the runtime mechanism. Live access and instrumentation require applicable authorization; repository edits and automatic live hotfixes do not follow from diagnosis. |
| `trace-forensics` | `trace-forensics.md` | Fixed artifact, queryable data, hot paths and retaining chains, symbols, paired comparison, and uncertainty. Choose suitable parsing tools rather than requiring SQLite or a subagent for every artifact. |
| `bug-fix` | `bug-fix.md` | Reproduce, eliminate competing hypotheses, confirm the mechanism, make a supported correction, and repeat the original reproduction. Preserve useful failing-before-passing tests without mandatory commits, model routing, loops, or PR creation. |
| `feature` | `feature.md` | Ground the subsystem, choose a domain shape, consider designs, identify prerequisites, independent work and shared state, then verify coherent units and all affected consumers. Keep decomposition proportional; no mandatory delegation, arena, checkpoint syntax, or delivery chain. |
| `refactoring` | `refactoring.md` | Pin behavior, name the target, subtract supported redundancy, migrate callers, prove equivalence, and assess reader load. Reuse adequate existing coverage, preserve agreed compatibility and boundary checks, and remove only authorized obsolete paths. |
| `performance` | `perf-issue.md` | Baseline, eight strategy families, one supported change, comparable post-change measurement, and delta. Make noise, invalidation, resource costs, and duplicate-effect safety explicit; no required control skill, model, or PR. |
| `hillclimb` | `hillclimb.md` | Representative workload, sensitive frozen measurement, baseline and regression gate, one hypothesis at a time, decision trail, retain/revert, and a justified stop. Honor budgets without a mandatory attempt floor, TSV file, commits, or wake mechanism; changed measurement conditions require re-baselining. |
| `prototype` | `prototype.md` | Decision first, references where useful, isolated cheap variants, observation on the relevant surface, and recommendation. Keep Workflow planning and execution authority; no universal ban on tests or automatic production handoff. |
| `visual-parity` | `visual-parity.md` | Fixed baseline, anti-tampering, shared prerequisites, per-unit image comparison, and concrete results. Use the commissioned tolerance, including zero for exact parity; no mandatory worktrees, infinite loop, or PR. |
| `skill-authoring` | `authoring-a-skill.md` | Precise discovery, progressive references, structural sources, action-oriented prose, metadata and link checks, and meaningful validation. Use available authoring guidance without a vendor dependency or subjective exact-text tests. |
| `evaluation` | `eval.md` | Organic prompts, isolated equivalent contexts, hidden rubric and identities, one judging scale, actual artifacts and scoped execution records, and human synthesis. Prevent condition leakage without banning legitimate task vocabulary; no fixed model family, agent count, or transcript directory. |
| `session-pickup` | `session-pickup.md` | Read the supplied trail efficiently, inspect operational state, separate done from pending, locate the next assignment, and check inherited claims. Prior agent assertions are not approval; recheck changed claims without recreating unaffected work. |
| `pause-safely` | `pause-safely.md` | Stop new work, settle owned operations, preserve saved state, and provide a cold-start resume point. Dirty and incomplete states stay visible; no automatic WIP commit, external note, or pause merely because context compacts. |

## Project verification sources

Project verification adapts the directly inspected [setup offer (step 7)](https://github.com/cursor/plugins/blob/main/pstack/skills/setup-pstack/SKILL.md#7-offer-a-verification-skill-optional), [create-verification-skill](https://github.com/cursor/plugins/blob/main/pstack/skills/create-verification-skill/SKILL.md), and [maintain-verification-skill](https://github.com/cursor/plugins/blob/main/pstack/skills/maintain-verification-skill/SKILL.md) from `cursor/plugins`, read on 2026-09-08 at `main`. These are mutable source links; no immutable revision was resolved for this comparison. Adapted verification text is covered by the pstack MIT notice in THIRD_PARTY_NOTICES.md.

Creation retains repository-grounded launch, doctor, drive, evidence, cleanup, isolation, executable helpers, a feature index with per-feature files, and an end-to-end proof. Workflow makes the offer specific to the current plan and requires explicit acceptance before including creation or maintenance in scope. The first required trial takes place at implementation close once product and verifier are ready together. Headings remain flexible and usable existing verifiers keep their location and structure.

Maintenance retains index hygiene, source comparison, user-path recipes, live coverage, diagnosis after surprises, evidence-preserving cleanup, and the distinction between documentation drift, harness gaps, and product regressions. Workflow defaults to affected features; explicitly selected full maintenance covers the agreed full map. It does not import mandatory subagents, fixed outcome codes, branches, or PRs. Review separately checks the verifier against the accepted proposal, approved plan, actual implementation, and current trial evidence without editing it. Creation and maintenance details load only for the applicable action.

## Shared integration decisions

Each method remains one reference file. Catalog and skill entrypoints load only the selected method. The playbooks describe useful result content, not mandatory user-document headings, metadata, or machine state.

The working agreement governs phase assignments and authority. A method can inform planning or execution but cannot commission implementation, a fresh Review, correction, or learning. An implementation's own diff and evidence checks are self-verification, not a separately commissioned Review. Host permissions and project instructions govern commands, tools, models, runtime access, and any collaboration.

Mandatory pstack skill calls are replaced with their relevant methodological substance. Model names, blanket fan-out, fixed logs and task lists, automatic commits and PRs, and background wake mechanisms are omitted. Verification follows the relevant behavior and evidence surface rather than prescribing live access for every kind of change. Failed attempts remove only their own changes, and success criteria cannot be relaxed to produce a positive report.

Ideas for ordered prerequisites, verifiable units, checkable exit conditions, and resumable progress stay within the existing methods and catalog. No additional autonomous-run, multi-phase-plan, PR, shipping, autopilot, or cleanup playbooks are introduced. Workflow does not load upstream instructions at runtime or automatically adopt later upstream changes.
