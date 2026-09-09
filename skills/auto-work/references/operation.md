# Auto-Work operating rules

Light and Dark share the same phases and evidence requirements. Light places human judgment at plan approval and acceptance of the reviewed result. Dark delegates those individual decisions only within an expressly commissioned goal; it does not grant general authority. The human still owns scope, consequential choices, and delivery permissions.

## Start and transitions

Use one identifiable assignment and plan in the native task. Existing applicable approvals remain valid. Before mutation, resolve consequential product, architecture, scope, permission, and acceptance ambiguities. In Dark, a sufficiently specified human goal authorizes preparing its implementation plan without a second approval; it never authorizes inventing consequential missing requirements. Plan-only requests remain read-only in either mode.

After planning, Light waits for approval unless the applicable plan is already approved. Implement, report, obtain independent Review, correct named findings, and re-review. A verification-only correction may collect missing proof without code changes. Each phase remains distinct, but the Auto-Work assignment commissions its in-scope transitions in advance. The reviewer returns its judgment to the executor; it does not repair findings or run delivery.

After positive Review, Light presents the result and supporting evidence for human acceptance. Plan approval, silence, a status question, or approval of one earlier revision is not acceptance of a changed result. Once the reviewed result is accepted, finish repository work or execute the already commissioned delivery. Dark can finish repository work after positive Review and necessary checks; delivery has its own requirements.

## Limits and progress

The default is the initial implementation and Review, followed by at most three correction rounds, each including its subsequent Review. The human may set a different nonnegative whole-number limit. Record a round when correction begins, including verification-only correction; retain consumed rounds if interrupted. The final permitted correction still receives its Review. An exhausted budget with unresolved findings stops the loop, not its reporting. Stop earlier when the same finding recurs without new evidence or an effective correction, or when required access or a consequential decision is missing. Host time, token, cancellation, and permission limits remain controlling; do not invent unavailable usage measurements.

A reviewer failure is missing review evidence, not approval. A bounded retry is useful only for a concrete transient failure; do not bypass an unavailable reviewer or run endless infrastructure retries. A new budget requires an explicit human instruction, not a mode change, renamed task, or resumed conversation.

## Switch, pause, and resume

An explicit switch to Light or Dark changes only remaining steps. Preserve the plan, scope, permissions, consumed rounds, findings, and still-applicable proof. Before entering Dark, check the assignment's completeness, reviewer availability, and any requested delivery prerequisites. An unavailable required capability leaves the switch pending with the specific gap; do not silently enter Dark. A question during Dark pauses for that decision without silently switching to Light. A switch to Light requires acceptance of the resulting reviewed work before completion, even if implementation began in Dark.

Apply new instructions before the next affected action. For cancellation, stop initiating work, use available native cancellation for owned in-flight agents or operations, and report any operation whose outcome is still uncertain. Do not claim an external action was undone. Rollback requires an applicable assignment and project mechanism.

At a pause or handoff, preserve the assignment, plan, active or pending mode, current working state, consumed and remaining rounds, open findings, actual evidence, acceptance still needed, delivery actions and outcomes, complete learning collection, and next action. Use understandable task reports, without a mandatory schema or separate state file. References must be accessible to the receiver; otherwise supply the relevant text. Missing history is a gap, not permission to reset the budget or reconstruct approvals.

On resume, compare the reports with the actual repository and external state. Relevant changes invalidate affected evidence and acceptance. Recheck before dependent work; do not repeat uncertain delivery effects without observing whether they already happened. Native task resumption needs no new approval for unchanged scope, but this skill cannot wake a stopped host or guarantee unattended continuation.
