# Codex Manual facade

Workflow on Codex uses Plan → Implement → Review → Correct → Review. Codex Plan mode presents comprehensive free-form Markdown with one generated Authority Core. The exact approved plan provides implementation authority.

Fresh `$review-work` is repository-read-only and returns only Achieved, Correction needed, or Open points. Missing required observations retry internally. Invalid formal binding still receives an informative Shadow Review with no artifacts or correction authority. Evidence grade remains separate from outcome.

Each `$correct-work` is separately human-authorized and ends Fresh Review pending; the human starts the next Review. There is no final delivery-acceptance gate.

The host sandbox and approvals remain authoritative. Workflow chooses no command, tool, model, route, retry, sandbox, worktree, or framework strategy. MCP and protected sealing are optional and their failure never changes Manual status or ordinary Codex availability.
