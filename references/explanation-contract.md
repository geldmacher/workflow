# Work explanation

`/explain-work [wp-id]` is read-only and chat-only. It is never success evidence, a review result, an approval, or a learning closeout.

Artifact `extensions` are opaque audit metadata and are excluded from explanations and explainer handoffs.

Resolve by `artifact`, never filename, and require a complete schema-3 chain. Report schema-2/mixed chains as incompatible; replan is the next safe action and their delivery is not explained.

Return compact sections for intent and outcome; architecture/control/data flow; change map; decisions and invariants; verification; operational risks; current state and blockers; and where future changes belong. Cite Workflow IDs plus repository paths or symbols for material claims. Distinguish executor claims from independently inspected repository evidence.

When no unique root resolves, ask only for the root ID. When state is not `achieved`, mark the explanation preliminary and include the next safe action. Do not persist documentation even when the explanation is final; repository documentation remains a separate explicitly authorized task.
