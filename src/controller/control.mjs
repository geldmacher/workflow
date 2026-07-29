import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const WORKER_CONTROL_FILE = "worker-control.json";
export const DEFAULT_CANCEL_GRACE_MS = 5_000;

export function workerControlPath(subjectDirectory) {
  return join(subjectDirectory, WORKER_CONTROL_FILE);
}

export function writeWorkerControl(subjectDirectory, action, metadata = {}) {
  if (!["pause", "stop", "budget"].includes(action)) throw new Error(`unsupported worker control action: ${action}`);
  const path = workerControlPath(subjectDirectory);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const value = { schema: 1, action, requested_at: new Date().toISOString(), ...metadata };
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  return value;
}

export function clearWorkerControl(subjectDirectory) {
  const path = workerControlPath(subjectDirectory);
  const existed = existsSync(path);
  rmSync(path, { force: true });
  return existed;
}

export function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

export async function awaitCooperativeExit(pid, graceMs = DEFAULT_CANCEL_GRACE_MS) {
  if (!processAlive(pid)) return { exited: true, hard_kill_required: false, waited_ms: 0 };
  const started = Date.now();
  while (Date.now() - started < graceMs) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    if (!processAlive(pid)) return { exited: true, hard_kill_required: false, waited_ms: Date.now() - started };
  }
  return { exited: false, hard_kill_required: true, waited_ms: Date.now() - started };
}
