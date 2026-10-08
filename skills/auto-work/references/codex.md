# Codex delegation

Use the active spawn schema. Where offered, model selection uses `model` and reasoning uses `reasoning_effort`; `model_reasoning_effort` is a configuration key, not automatically a spawn field. Check existing custom agent definitions: their configured model/effort can override spawn values. Choose a compatible definition or supported explicit invocation without rewriting configuration.

If full-history forks disallow overrides, use an allowed fresh/partial context with a complete phase handoff; for a schema offering `fork_turns`, obey its restrictions on `all`, `none` and numeric values. Do not combine full-history inheritance with unsupported overrides. Use available workspace/read restrictions and describe their actual effect; a read-only prompt is not a separate sandbox. An active read-only Plan mode cannot implement.

Set every shell call's native `workdir` explicitly to the handoff cwd, including rule reads. Use [accessible raw proof](handoff.md); do not retype tool output in reports.
