import { join } from "node:path";
import { readProtectedRecord, writeProtectedRecord } from "../../src/core/protected-record-store.mjs";

const [stateRoot, runId] = process.argv.slice(2);
if (!stateRoot || !/^run-[a-f0-9]{24}$/.test(String(runId ?? ""))) process.exit(2);

const root = join(stateRoot, "workflow-6-runs");
const path = join(root, "runs", `${runId}.json`);
const run = readProtectedRecord(path, root, { maxBytes: 2 * 1024 * 1024 });
if (!run?.pending_transition || run.pending_transition.status !== "prepared") process.exit(3);

writeProtectedRecord(path, {
  ...run,
  phase_status: "executing",
  pending_transition: {
    ...run.pending_transition,
    status: "executing",
    handoff_status: "not-started",
    execution_lease: {
      owner_id: `crashed-child-${process.pid}`,
      pid: process.pid,
      acquired_at: new Date().toISOString(),
    },
  },
}, root);

process.exit(86);
