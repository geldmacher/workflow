# Workflow

Compact Cursor workflows for model-agnostic delegation:

1. `compile-handoff` turns an idea or plan into a normal Cursor plan artifact containing an executor-ready handoff.
2. `execute-handoff` implements the active Cursor handoff plan or the latest review-delivery improvement plan and stops instead of guessing.
3. `review-delivery` delegates a readonly check of the result against intent, scope, and evidence, then optionally returns the next improvement handoff.

The user chooses which model or agent performs each role. The plugin does not assume a model hierarchy.

The typical split: a planner compiles the handoff into a durable Cursor plan artifact, an executor implements it, and a readonly reviewer checks delivery when risk justifies it. When review finds useful follow-up work, it emits a compile-compatible `Recommended next handoff`; `/execute-handoff` treats that improvement plan as the preferred scope for the next loop. Because the roles stay model-agnostic, any assignment works.

## Installation

Copy or clone this plugin to `~/.cursor/plugins/local/geldmacher-workflow/` so Cursor discovers it automatically, or install it from a marketplace that lists this repository.

## Usage

The intended flow:

1. Run `/compile-handoff` to produce a normal Cursor plan artifact whose body is the canonical handoff packet.
2. For risky, large, or ambiguous handoffs, the `handoff-readiness-reviewer` agent validates the packet before handoff.
3. Run `/execute-handoff` (with any model or agent) to implement exactly that packet, ideally with each numbered plan step tracked as visible execution progress in Cursor.
4. Run `/review-delivery` when risk justifies it; it delegates to the readonly `delivery-reviewer` agent.
5. If the review returns `Recommended next handoff`, run `/execute-handoff` again to implement that improvement plan.
6. Repeat review and execution as often as the user wants.

## Components

- **Commands**: `/compile-handoff`, `/execute-handoff`, `/review-delivery` — explicit entry points for each role. `/compile-handoff` creates a Cursor plan artifact by default.
- **Skills**: `handoff-plan-compiler`, `handoff-executor`, `delivery-review` — auto-triggered counterparts of the commands; they carry the detailed instructions.
- **Agents**: `handoff-readiness-reviewer` (readonly check that a packet is executable without guessing), `delivery-reviewer` (independent readonly review of delivered work).
- **Rule**: `handoff-quality` — quality bar for handoffs and the canonical definition of the handoff packet.

## Publishing Notes

Before publishing or submitting the plugin, check that `.cursor-plugin/plugin.json` is valid JSON, `logo` points to an existing relative asset, and all commands, skills, agents, and rules keep their required frontmatter. Hooks, MCP servers, and scripts are intentionally omitted because this workflow only needs commands, skills, agents, and one rule.

## Handoff Packet

All handoff plan artifacts use the same packet as their body:

1. `Intent and success condition`
2. `Scope and non-goals`
3. `Context packet`
4. `Target files and symbols`
5. `References to existing patterns`
6. `Executable agent plan`
7. `Verification`
8. `Escalate instead of guessing when`
9. `Open questions`

The canonical definition lives in `rules/handoff-quality.mdc`; keep all other copies in sync with it. The rule defines the packet content, while the `compile-handoff` command and `handoff-plan-compiler` skill define Cursor's default delivery surface: a normal plan artifact.

Every `Recommended next handoff` from delivery review must use the same packet format and executable step quality as a compiled handoff, so it can become the next `/execute-handoff` scope without reinterpretation.

Keep output short by default. Add detail only when it reduces execution ambiguity.
