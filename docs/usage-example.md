# Complete workflow example

## 1. Plan in Cursor Plan Mode

Run:

```text
/plan-work Add a resumable CSV import with clear failure reporting.
```

The planner first inspects only enough repository behavior to separate facts from execution-critical human decisions. When one remains, it uses Cursor's native Ask Question Tool with concrete options, effects, and a recommendation, then waits. A failed native invocation may use a compact blocking prose fallback, but no plan draft appears before the answer. Clear intent skips the interview. Only then does the planner create one native `wp-*` with Objectives, scope, Checks, operational expectations, and adaptive assurance. External instructions are copied into that root rather than represented as separate Workflow artifacts.

## 2. Implement natively

Inspect the root plan and choose Cursor's **Implement Plan** action. This is the initial human approval. The implementation classifies work through Completion Probes, changes pending/partial work, verifies the result, and returns full root evidence. Resume remains reconstructable from the repository and this evidence.

## 3. Review in Cursor Ask Mode

Run:

```text
/review-work
```

In a fresh task, attach the root and newest evidence. Ask may use any capability Cursor provides—repository inspection, semantic search, browser/documentation access, MCPs, or subagents—to assess the cumulative delivery without changing it. Lean/standard begins with the cheapest sufficient inspection and escalates only when the evidence warrants it.

An `achieved` review needs complete root Objective and Check proof. A correctable gap produces one embedded `cp-*`; an unresolved decision produces `clarify`, changed intent/scope/risk produces `replan`, and genuinely missing decision evidence may produce `retry-review`.

## 4. Correct in Cursor Agent Mode

After inspecting the proposed correction, run:

```text
/correct-work
```

Invocation approves the newest unique actionable correction. Agent Mode uses its available capabilities to apply only pending/partial in-scope FIXes. Verification-only corrections need no code change. Delta evidence records affected/executed work and a defensible basis for reused proof.

## 5. Continue the human loop

Return to Ask Mode and run `/review-work` again. Every review evaluates the effective cumulative delivery against the original root. Repeated no-progress Findings create a churn warning and normally suggest clarification or replanning, while the human retains the decision to try another in-scope approach or stop.
