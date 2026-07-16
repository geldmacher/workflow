# Workflow

Cursor-native planning, implementation, evidence-based review, human-approved correction loops, and optional learning closeout for repository delivery.

## Intent and expectations

Workflow gives work a durable root intent and enough evidence for a human to steer the outer loop economically. Plan Mode establishes outcome, scope, checks, and assurance; Cursor's native **Implement Plan** performs initial delivery; Ask Mode reviews the cumulative result; Agent Mode applies only a correction the human explicitly chooses through `/correct-work`. At any human-selected stop, optional `/learn-from-work [instruction]` persists confirmed correction lessons and one manual learning in project-local guidance.

Cursor owns mode capabilities and sandbox boundaries. The plugin does not infer modes from tools or maintain tool allow/deny lists. Ask may use every capability Cursor exposes, including semantic search, browser/documentation access, MCPs, and subagents, while the native Ask boundary keeps the review non-mutating.

Delivery ends at the repository boundary. Workflow does not merge, push, create pull requests, deploy, access production, or infer production health from repository evidence.

## Installation

Clone or link this standalone repository at `~/.cursor/plugins/local/geldmacher-workflow/`, then reload Cursor. No additional mode configuration or bundled MCP server is required.

## Usage

1. Select Cursor Plan Mode and run `/plan-work <goal>`. The planner investigates only enough to identify execution-critical decisions, uses Cursor's native Ask Question Tool when an Intent Interview is needed, and creates the root plan only after those decisions are resolved. Clear intent proceeds directly; a failed native question invocation may fall back to a blocking prose question without a plan draft.
2. Review the plan and choose Cursor's native **Implement Plan** action. That action is the human approval of the immutable `wp-*` root and finishes with `delivery-evidence`.
3. Select Cursor Ask Mode and run `/review-work [<wp-id>]`. In a fresh task, attach the root plan and latest evidence. Ask may use any capabilities available in that mode to compare the cumulative delivery with the root intent.
4. If the review recommends `correct`, inspect its embedded `cp-*`, switch the same task to Agent Mode, and run `/correct-work`. Invocation approves the newest unique actionable correction.
5. Return to Ask Mode and run `/review-work` again. Repeat or stop under human control.
6. Optionally switch to Agent Mode and run `/learn-from-work [instruction]`. The command treats invocation as closeout, skips unconfirmed candidates, and first updates equivalent existing guidance. Otherwise it routes the Learning by purpose to maintained docs, a scoped Rule, Skill, Subagent, or Command; `docs/workflow-learnings.md` is only the last fallback. Repeated closeout remains diff-free.

See [the complete workflow example](docs/usage-example.md).

### Cursor mode boundary

[Cursor Commands](https://docs.cursor.com/en/agent/chat/commands) do not bind a mode declaratively. Select Plan, Ask, or Agent before invoking the corresponding command. Runtime prompts describe Workflow outcomes and authorization boundaries but do not redefine the capabilities of those modes.

## Artifact protocol

The unpublished schema 2 supports:

- `work-plan` (`wp-*`): immutable root intent, scope, checks, and assurance.
- `delivery-evidence` (`de-*`): full initial evidence or a compact correction delta.
- `work-review` (`wr-*`): cumulative assessment against the root and optional embedded correction.
- embedded correction (`cp-*`): Findings-backed in-scope work approved through `/correct-work`, with output-only `LRN-*` candidates for later closeout.

IDs use a stable type-prefixed slug; timestamps are optional and topology follows explicit predecessor links. Constraints are copied directly into the root plan. Resume is reconstructed from repository state, Completion Probes, and the latest effective evidence.

Validation is syntactically tolerant and semantically strict. Additional metadata, heading aliases, reordered content, derived values, and legacy corrections without learning candidates do not block the flow; legacy omissions produce a diagnostic. Ambiguous roots/tips, unsafe reuse, malformed candidates, missing decision evidence, scope/risk expansion, or absent human approval do.

Risk describes possible harm; assurance describes justified proof effort. Lean/standard begins economically and escalates on evidence. Equivalent Checks and change-impact reuse are allowed when evidence strength is preserved. Named auditors help but are not formal success tokens.

## Components

- **Commands**: `/plan-work`, `/review-work`, `/correct-work`, `/learn-from-work`
- **Skills**: `work-planning`, `work-review`, `work-execution`, `work-learning`
- **Agents**: `work-plan-auditor`, `delivery-auditor`, `risk-auditor`
- **Rules, hooks, bundled MCP servers**: none

## Development

```bash
npm ci
npm run build:runtime-validator
npm test
npm run release-check
```

Use the ignored `.tests/` directory for local development and scratch tests. Functional Cursor tests use `cursor-agent` exclusively with `/private/tmp/cursor-plugin-harness`; see [the release checklist](docs/release-checklist.md). Existing harness changes must remain byte-identical.
