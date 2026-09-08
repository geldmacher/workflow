# trace-forensics

Use when a captured profile, trace, dump, or snapshot is supplied for diagnosis. The capture is a fixed dataset. This playbook is repository-read-only and does not recapture or mutate the target. Use [runtime-forensics](./runtime-forensics.md) for a separately authorized live investigation.

## Diagnose from the artifact

1. Identify the artifact, format, capture context, and question. Examples include CPU profiles, compressed trace JSON, thread dumps, and heap snapshots. Select a parser or viewer suited to the format and available in the environment.
2. Reach a queryable representation before scanning large raw dumps. Use the viewer's queries or a temporary derived table of samples, frames, waits, or nodes when needed. Keep the original intact and retain the relationship between the derived data and its source.
3. Narrow to the dominant path. For CPU, inspect time attribution and walk the call tree. For a leak, follow retaining edges to a GC root. For a thread dump, distinguish active execution from blocking and identify the wait reason. Rank findings against the symptom instead of reporting every large entry.
4. Attribute the finding to source through the artifact's symbols and matching build information. Resolve missing symbols where the supplied data permits it. Without a reliable mapping, report the frame or address and the missing mapping; do not invent a file or line.
5. Compare a paired capture when available. Check that workload, build, duration, and capture conditions support the comparison. Distinguish a regression from background activity or measurement noise. Without comparable supporting evidence, state the strongest hypothesis the artifact supports rather than declaring causality proven.
6. Return the reduced diagnosis and its limits. If a correction follows, identify [bug-fix](./bug-fix.md) or [performance](./performance.md) as the next method without beginning it.

## Result

Name the artifact and format, relevant capture conditions, reduced finding, source mapping or its absence, and the evidence locations. State whether a paired capture supports the conclusion and what a further capture would need to settle. Derived views support the diagnosis; they do not replace the original evidence.
