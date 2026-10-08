# Cursor delegation

Use Cursor Agent Mode and the current native Task schema. Select the exact model ID/variant and options that schema accepts. Parameterized `model` strings in agent frontmatter are configuration syntax, not automatically valid Task arguments. Use an existing compatible native agent definition only when its effective settings are known; inspect overriding settings and permitted read restrictions.

The editor picker, CLI catalog and Task tool can expose different capabilities. Catalog evidence alone does not establish that Task can express a choice. Cursor can substitute a configured model because of account or team restrictions: use host metadata when accessible, stop on a known mismatch, and otherwise report execution settings unconfirmed. Never invent reasoning fields or silently remove requested options.

Use native Shell at explicit `working_directory` for [raw rule transport](handoff.md), where that field is offered. Display/save complete `cat` output; Read status/line counts are not the text. No rule retyping.
