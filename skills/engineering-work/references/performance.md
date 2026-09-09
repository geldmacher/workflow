# performance

Use for one measured slowness. A sustained search against a metric belongs to [hillclimb](./hillclimb.md). Repository changes require an applicable plan and implementation or correction authority; measurement access follows the project and host permissions.

## Measure before choosing a fix

1. Capture a representative baseline on the affected surface. Record the workload, environment, metric, sampling method, and artifact. Do not infer a performance ceiling from source inspection.
2. Ground hypotheses in the observed cost and affected architecture. Select a strategy only when its signal fits; the following families generate hypotheses, not a checklist to implement:
   - **Elimination.** Remove work that nobody needs. A trace establishes cost, not dispensability; confirm consumers and required behavior before deleting it.
   - **Divide and conquer.** When cost scales with input, reduce the working set, prune the search, chunk the work, or separate genuinely independent pieces.
   - **Caching.** Reuse repeated work on equivalent inputs. Name invalidation, freshness, and memory costs before claiming a gain.
   - **Indirection.** Replace expensive work with a cheaper intermediate, such as an index instead of a scan or a queue outside the interactive path. The extra layer must remove more cost than it adds.
   - **Batching.** Combine operations that repeatedly pay fixed query, RPC, syscall, or rendering overhead. Check the resulting delay and batch size.
   - **Redundancy.** Replicas or hedged attempts may reduce tail latency when a slow wait dominates. Establish capacity, cancellation, duplicate-effect safety, and load cost before trying them.
   - **Lazy evaluation.** Defer results that are unused or not needed yet. Measure first-use behavior as well as startup.
   - **Scheduling.** Move necessary work outside the moment the user waits, including precomputation or background cleanup. Measure interactive latency separately from total work.
3. Choose the smallest change supported by the dominant cost. Implement and check one hypothesis before stacking another. Preserve the approved functional behavior and operating constraints.
4. Capture the result with comparable workload, environment, and instrumentation. Use repeated or interleaved measurements when needed to distinguish the effect from warmup, caches, drift, and noise. If conditions changed, re-establish comparability instead of calculating a misleading ratio.
5. Run the relevant regression checks and inspect resource tradeoffs. A faster result that violates correctness or the agreed resource budget is not an accepted improvement. Remove failed own experiments while preserving other changes.

## Result

Report baseline, result, absolute and relative delta when meaningful, measurement conditions, artifact paths, and noise or coverage limits. Explain the mechanism and its costs. Source plausibility, incomparable traces, or a result within noise cannot support an improvement claim.
