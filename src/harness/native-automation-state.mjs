import { lstatSync } from "node:fs";
import { join } from "node:path";
import { readProtectedRecord } from "../core/protected-record-store.mjs";

const runPattern = /^run-[a-f0-9]{24}$/;

export function readNativeAutomationRun(stateRoot, runId) {
  if (!runPattern.test(String(runId ?? ""))) throw new Error("native automation run ID is invalid");
  const path = join(stateRoot, "workflow-6-runs", "runs", `${runId}.json`);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error("native automation run record is unavailable");
  const run = readProtectedRecord(path, join(stateRoot, "workflow-6-runs"), { maxBytes: 2 * 1024 * 1024 });
  if (run?.schema !== 1 || run?.kind !== "workflow-6-run" || run?.contract !== "workflow-6-transactional" || run.run_id !== runId) {
    throw new Error("native automation run record is unsupported");
  }
  return run;
}

export function nativeAutomationDecisionContext(stateRoot, runId) {
  const run = readNativeAutomationRun(stateRoot, runId);
  return Object.freeze({
    run_id: run.run_id,
    revision: run.revision,
    lifecycle: run.lifecycle,
    pending_transition: run.pending_transition?.transition_id ?? null,
    evidence_hash: run.delivery_evidence?.artifact_hash ?? null,
    review_hash: run.work_review?.artifact_hash ?? null,
  });
}
