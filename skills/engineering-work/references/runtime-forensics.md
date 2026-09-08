# runtime-forensics

Use to diagnose a live symptom such as a leak, idle CPU activity, a latency spike, or an intermittent visual glitch. Capture and explain the mechanism; do not turn a diagnosis into an unrequested fix. Repository work stays read-only. Access to a live or production surface, instrumentation, and changes to a running process require the matching existing authorization.

## Capture, reduce, confirm

1. Identify the affected process, environment, workload, and symptom. Establish which observation tools can reach that surface and what access is authorized. Do not substitute a different environment without naming the limit of the comparison.
2. Capture the appropriate signal: a CPU profile for a spinning process, a heap snapshot for a leak, a trace for a timing or rendering glitch. Record the capture context and artifact location so the observation can be understood later.
3. Reduce the artifact to a specific mechanism: the hot function, a retained object's path to a GC root, repeated scheduling without input, or the wait that dominates latency. Query or summarize large artifacts with the available tools; keep the reduced finding and its supporting locations in the task.
4. Test the explanation with targeted observation. Compare controlled conditions or repeated captures. Additional instrumentation can distinguish competing causes only when authorized; do not patch or hotfix the live process merely because it is convenient. Repository edits remain outside this diagnostic method.
5. Map the mechanism to source: file, symbol, allocation, scheduling point, or dependency boundary. Connect that location to the captured signal rather than treating a suspicious source line as proof.

If the control surface is inaccessible, capture is incomplete, or further intervention lacks permission, report exactly what was observed and what remains a hypothesis. Do not claim a confirmed cause from a plausible explanation alone. Preserve diagnostic artifacts and avoid leaving temporary runtime interventions active; any authorized intervention needs a bounded restoration procedure.

## Result and handoff

Report the signal, workload, reduced finding, confirmation attempt and outcome, source location, and artifact paths. Hand a confirmed cause to [bug-fix](./bug-fix.md) or [performance](./performance.md) when useful. Correction requires its own matching assignment.
