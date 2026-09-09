# hillclimb

Use for sustained improvement of one measurable outcome under an agreed budget and checkable stop condition. A one-off fix belongs to [performance](./performance.md) or [bug-fix](./bug-fix.md). An applicable plan and execution instruction are required for changes; the method creates no unattended execution or scheduling authority.

## Establish a trustworthy experiment

1. Ground the architecture and realistic workload dimensions, such as data size, history, state, and concurrency. Select a case that exhibits the problem. If it does not, improve the reproduction before optimizing.
2. Fix the metric, improvement direction, success target, regression floor, resource budget, and stop condition. Use the user's numbers. Resolve consequential missing limits before running a sustained search; do not invent a mandatory minimum number of attempts.
3. Establish a repeatable measurement procedure and test its sensitivity with contrasting representative workloads. If the instrument cannot distinguish meaningful cases, repair the measurement before accepting a baseline. Sample enough to characterize noise, for example repeated measurements with a median and spread.
4. Record the baseline and a passing regression gate, then freeze the workload and measurement method. A later change to the instrument or environment requires re-baselining; earlier values are not silently comparable.

## Iterate one hypothesis at a time

5. Keep a concise decision trail in the native task: hypothesis, bounded change, before/after result, relevant checks, and keep-or-revert decision. Read prior attempts so the search accumulates evidence. No fixed file, schema, or commit is required.
6. Ground each hypothesis in a specific mechanism. Make one bounded change, measure with the fixed procedure, and run the regression gate. Accept improvement only beyond noise with the guardrails green. A simplification with equivalent performance can be retained only if the approved scope includes that benefit; it is not a metric win.
7. Remove a failed attempt's own changes before proceeding. Do not revert pre-existing work or combine unmeasured changes. Any parallel experiments need authorized collaboration and isolated mutable state, chosen by the executor.
8. On a plateau, inspect rejected ideas and reconsider the cost mechanism. Try another justified strategy while budget and useful hypotheses remain. Do not lower correctness or success criteria to claim progress.
9. Stop when the target is met, the budget is exhausted, a real blocker prevents useful work, or remaining ideas do not justify their marginal cost. Explain which condition ended the run. A budget stop or plateau is not success when the target remains unmet.

## Result

Report the metric and target, baseline and final value, meaningful delta, noise, attempts retained or reverted, regression results, and remaining budget or stop reason. Identify accepted changes and the next useful hypothesis, if any. Preserve enough context for a handoff without automatically committing, publishing, or scheduling more work.
