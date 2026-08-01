# Work explanation

`/explain-work [wp-id]` is read-only and chat-only. It is never success evidence, a review result, an approval, or a learning closeout.

Artifact `extensions` are opaque audit metadata and are excluded from explanations and explainer handoffs.

Resolve by `artifact`, never filename, and require a complete Schema-5 chain. Report Workflow-3/4 history as read-only and mixed or invalid chains as incompatible; their delivery is not promoted as current proof.

Return compact sections for intent and outcome; architecture/control/data flow; change map; decisions and invariants; verification; operational risks; current state and blockers; and where future changes belong. Cite Workflow IDs plus repository paths or symbols for material claims. Distinguish executor claims from independently inspected repository evidence.

Resolve an explicit Root first, then the active native Cursor Plan, then a unique active controller Run. Only when no unique Root resolves ask for its ID. When state is not `achieved`, mark the explanation preliminary and include the next safe action. Do not persist documentation even when the explanation is final; repository documentation remains a separate explicitly authorized task.
