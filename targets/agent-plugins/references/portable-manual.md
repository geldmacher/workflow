# Portable Manual facade

This target implements the direct Schema-6 loop: Plan → Implement → Review → Correct → Review. The human separately authorizes planning, implementation, each correction, each fresh Review, and learning.

`build-plan` generates one Authority Core for free-form Markdown. `build-review` returns Achieved, Correction needed, Open points, an internal retry, or Shadow. `status` derives only human-relevant states. Exact task bytes are authority; cache, MCP, hooks, and IDs without bytes are not.

Presentation follows the shared Manual Workflow contract; that contract is the single mapping source for human-facing actions.

The project harness owns every repository discovery, command, tool, model, framework, sandbox, worktree, retry strategy, and verification mechanism. Review is read-only. Correct Work mutates only under its exact human authorization and ends Fresh Review pending.

Missing protected proof never masquerades as verified but does not alone prevent Achieved. Missing observations retry internally; explicit limits become Open Points. Invalid binding receives an informative Shadow Review without artifacts or correction authority. Ordinary client use remains available when Workflow infrastructure fails.

No action merges, pushes, publishes, deploys, installs, or learns without a separate explicit request.
