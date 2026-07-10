# Workflow

Cursor workflows for evidence-based planning, controlled execution, and delivery review.

1. `compile-handoff` turns an idea or plan into a normal Cursor plan artifact with confirmed repository evidence, acceptance criteria, verification, and risk boundaries.
2. `execute-handoff` implements the active handoff through a preflight, step-level checks, controlled deviations, and final evidence reconciliation.
3. `review-delivery` checks the actual diff and evidence against the active handoff, then creates a precise next handoff when corrective work is justified.

The user chooses which model or agent performs each role. The plugin keeps the roles model-agnostic while giving each role a concrete contract.

## Installation

Copy or clone this plugin to `~/.cursor/plugins/local/geldmacher-workflow/` so Cursor discovers it automatically, or install it from a marketplace that lists this repository.

## Usage

The intended flow:

1. Run `/compile-handoff` in Plan Mode to produce a durable Cursor plan artifact.
2. For medium- and high-risk work, the `handoff-readiness-reviewer` checks the packet before implementation.
3. Run `/execute-handoff` with the implementation model.
4. Run `/review-delivery` when risk, uncertainty, or incomplete validation justifies review.
5. In Ask Mode, the selected main model performs the delivery review directly. In a mode that can edit files, review is delegated to the readonly `delivery-reviewer`.
6. If review emits an explicitly linked `Recommended next handoff`, run `/execute-handoff` again.

## Handoff Packet

Every handoff plan artifact uses this packet as its body:

1. `Handoff metadata`
2. `Intent and acceptance criteria`
3. `Scope boundaries and non-goals`
4. `Repository evidence`
5. `Target files and symbols`
6. `Reference patterns`
7. `Executable agent plan`
8. `Verification matrix`
9. `Risk and deviation policy`
10. `Escalate instead of guessing when`
11. `Delivery evidence requirements`
12. `Open questions`

The canonical definition lives in `rules/handoff-quality.mdc`. The packet establishes a complete execution contract:

- Metadata identifies the handoff, source, status, predecessor when applicable, planning baseline, and risk level.
- Acceptance criteria use observable IDs such as `AC-1`; steps and checks name the criteria they cover.
- Repository evidence distinguishes confirmed facts from assumptions.
- Target files separate required, permitted, incidental, and prohibited changes.
- Every verification entry names its working directory, exact command or inspection, expected result, required status, and acceptance criteria.
- The risk policy controls when an executor may continue, must ask, or must stop.
- The executor ends with delivery summary, verification evidence, deviation log, residual risks, and review recommendation.

`Open questions` is only for non-blocking follow-ups. Anything that could change intent, scope, targets, exact edits, verification, risk, or stop conditions must be resolved before the handoff is emitted.

## Deviation Policy

- `low`: explicitly permitted mechanical deviations may proceed and must be logged.
- `medium`: only explicitly permitted minor deviations may proceed; material changes require approval before editing.
- `high`: every deviation requires approval before editing.
- Architecture, public API, data, migration, authentication, security, dependency, destructive, and required-verification changes always stop for a tightened handoff.

## Components

- **Commands**: `/compile-handoff`, `/execute-handoff`, `/review-delivery`.
- **Skills**: `handoff-plan-compiler`, `handoff-executor`, `delivery-review`.
- **Agents**: `handoff-readiness-reviewer` and `delivery-reviewer`, both readonly and configured to inherit the active model.
- **Rule**: `handoff-quality`, the canonical packet and quality contract.
- **Validator**: `scripts/validate-plugin.mjs`, which checks plugin structure and packet consistency.

## Validation

Run the following before publishing or reloading the local plugin:

```bash
node scripts/validate-plugin.mjs
git diff --check
```

The validator checks the manifest, logo, expected plugin files, frontmatter, reviewer configuration, packet-section order, and required execution language.
