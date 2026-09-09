# Workflow for Agent Plugins

**Clear plans. Reviewed results. You set the direction.**

Workflow brings structure to AI-assisted development in compatible coding agents. Turn a goal into an actionable plan, implement it, review the changes, and resolve findings—with clear reports of what changed, what was checked, and what remains open.

The shared `install-release` skill supports Workflow release installation for Cursor and Codex only. In another harness it explains those supported targets and requires an explicit supported target before installation; it does not install an Agent Plugins release. See the [installation guide](../../docs/installation.md#install-from-your-harness).

Use `plan-work`, then explicitly commission `implement-work`. For manual work, commission review, correction, and learning separately. Keep the approved plan and reports in the native task, and supply an explicit handoff when changing tasks.

Use `auto-work` for an expressly commissioned Light or Dark sequence. Light is the default and waits for plan approval and final result acceptance. Explicit Dark can plan within the human goal and complete verified repository work automatically. Both require a fresh separate native reviewer, default to three correction rounds, and preserve scope and budget across explicit mode switches. Optional delivery needs a specific assignment; Dark delivery additionally needs existing technically enforced project gates. Native capabilities and permissions control what can actually run. See [Auto-Work](../../skills/auto-work/SKILL.md).

Workflow also helps the project improve from one task to the next:

- **Keep demonstrated lessons.** Implementation and correction carry reusable discoveries through the reports. Every review confirms applicable lessons and offers `learn-from-work`; when commissioned, it reconciles and saves them in project guidance or skills. Later planning reads and rechecks that knowledge.
- **Keep verification aligned.** Planning reuses suitable checks and proactively offers verifier creation or maintenance for concrete gaps. Accepted verifier work becomes part of implementation, including a closing trial. `workflow-doctor` inspects readiness; `verification-work` handles inspection and commissioned creation or maintenance. There is no background maintenance service.
- **Choose a useful approach.** Planning offers relevant engineering playbooks, such as `bug-fix`, `feature`, or `performance`, with a recommendation and an option to use none. Only selected methods enter the plan; playbook and verifier offers are independent.

See [learning across reviews](../../docs/manual-workflow.md#learning-across-reviews), [verification in the process](../../docs/manual-workflow.md#verification-in-the-process), and the [playbook catalog](../../skills/engineering-work/references/catalog.md).

The package contains skills and reference documents. It requires no Workflow runtime, Node executable, hooks, or MCP support. Your host controls permissions and execution.

[Installation](../../docs/installation.md) · [Working guide](../../docs/manual-workflow.md)

Repository and package validation do not prove that this package was installed or activated in a compatible host.
