import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const MODEL_INCIDENT_CAUSES = Object.freeze([
  "explicit-child-model",
  "actual-child-mismatch",
  "parent-model-unavailable",
  "child-model-unavailable",
  "uncorrelated-subagent-start",
  "deny-not-enforced",
]);

const CAUSES = new Set(MODEL_INCIDENT_CAUSES);
const TRANSIENT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT = 256;

const digest = (value) => createHash("sha256").update(String(value)).digest("hex");

export function hashWorkflowIdentifier(kind, value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return digest(`${kind}\0${value}`).slice(0, 32);
}

export function workflowStateRoot(workspaceRoot, options = {}) {
  const home = options.home ?? homedir();
  return join(home, ".cursor", "geldmacher-workflow", "state", digest(resolve(workspaceRoot)).slice(0, 20));
}

const modelRoot = (stateRoot) => join(stateRoot, "model-inheritance");
const parentPath = (stateRoot, conversationHash) => join(modelRoot(stateRoot), "parents", `${conversationHash}.json`);
const taskDirectory = (stateRoot, taskHash) => join(modelRoot(stateRoot), "correlations", taskHash);
const taskPath = (stateRoot, taskHash, event) => join(taskDirectory(stateRoot, taskHash), `${event}.json`);
const incidentDirectory = (stateRoot, incidentId) => join(modelRoot(stateRoot), "incidents", incidentId);
const incidentPath = (stateRoot, incidentId) => join(incidentDirectory(stateRoot, incidentId), "incident.json");
const observationPath = (stateRoot, incidentId, event) => join(incidentDirectory(stateRoot, incidentId), "observations", `${event}.json`);

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  try { chmodSync(path, 0o700); } catch { /* best effort on filesystems without POSIX modes */ }
}

function atomicJson(path, value) {
  ensureDirectory(dirname(path));
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort on filesystems without POSIX modes */ }
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

const safeText = (value) => typeof value === "string" && value.trim() !== ""
  ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, MAX_TEXT)
  : null;

export function normalizeModelParameters(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 32).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const id = safeText(entry.id);
    if (!id) return [];
    const parameterValue = ["string", "number", "boolean"].includes(typeof entry.value)
      ? String(entry.value).slice(0, MAX_TEXT)
      : null;
    return parameterValue === null ? [] : [{ id, value: parameterValue }];
  }).sort((left, right) => left.id.localeCompare(right.id));
}

export function writeParentModel(stateRoot, conversationHash, value) {
  if (!conversationHash) return;
  atomicJson(parentPath(stateRoot, conversationHash), {
    conversation_hash: conversationHash,
    model: safeText(value.model),
    model_id: safeText(value.model_id),
    model_params: normalizeModelParameters(value.model_params),
    cursor_version: safeText(value.cursor_version),
    captured_by: value.captured_by === "beforeSubmitPrompt" ? "beforeSubmitPrompt" : "sessionStart",
    captured_at: safeText(value.captured_at),
  });
}

export function readParentModel(stateRoot, conversationHash) {
  return conversationHash ? readJson(parentPath(stateRoot, conversationHash)) : null;
}

export function writeTaskEvent(stateRoot, taskHash, event, value) {
  if (!taskHash || !["request", "start", "stop", "result"].includes(event)) return;
  atomicJson(taskPath(stateRoot, taskHash, event), value);
}

export function readTaskEvent(stateRoot, taskHash, event) {
  if (!taskHash || !["request", "start", "stop", "result"].includes(event)) return null;
  return readJson(taskPath(stateRoot, taskHash, event));
}

export function incidentIdFor(taskHash, cause) {
  if (!CAUSES.has(cause)) throw new Error(`unsupported model incident cause ${cause}`);
  return `mi-${digest(`${taskHash ?? "uncorrelated"}\0${cause}`).slice(0, 24)}`;
}

export function recordModelIncident(stateRoot, value) {
  if (!CAUSES.has(value.cause)) throw new Error(`unsupported model incident cause ${value.cause}`);
  const incidentId = value.incident_id ?? incidentIdFor(value.task_hash, value.cause);
  atomicJson(incidentPath(stateRoot, incidentId), {
    incident_id: incidentId,
    cause: value.cause,
    status: ["deviated", "unattestable"].includes(value.status) ? value.status : "unattestable",
    phase: safeText(value.phase) ?? "workflow",
    subagent_type: safeText(value.subagent_type),
    parent_model: safeText(value.parent_model),
    parent_model_id: safeText(value.parent_model_id),
    parent_model_params: normalizeModelParameters(value.parent_model_params),
    requested_child_model: safeText(value.requested_child_model),
    observed_child_model: safeText(value.observed_child_model),
    match_mode: safeText(value.match_mode),
    policy_mode: safeText(value.policy_mode),
    cursor_version: safeText(value.cursor_version),
    enforcement: safeText(value.enforcement) ?? "unknown",
    task_hash: safeText(value.task_hash),
    recorded_at: safeText(value.recorded_at),
  });
  return incidentId;
}

export function recordIncidentObservation(stateRoot, incidentId, event, value) {
  if (!incidentId || !["start", "stop", "result"].includes(event)) return;
  atomicJson(observationPath(stateRoot, incidentId, event), {
    event,
    observed_at: safeText(value.observed_at),
    child_executed: value.child_executed === true,
    result_returned: value.result_returned === true,
  });
}

function readIncident(stateRoot, incidentId) {
  const incident = readJson(incidentPath(stateRoot, incidentId));
  if (!incident) return null;
  const observationsDirectory = join(incidentDirectory(stateRoot, incidentId), "observations");
  let childExecuted = false;
  let resultReturned = false;
  let lastObservedAt = incident.recorded_at;
  if (existsSync(observationsDirectory)) {
    for (const name of readdirSync(observationsDirectory).sort()) {
      if (!name.endsWith(".json")) continue;
      const observation = readJson(join(observationsDirectory, name));
      if (!observation) continue;
      childExecuted ||= observation.child_executed === true;
      resultReturned ||= observation.result_returned === true;
      if (observation.observed_at && (!lastObservedAt || observation.observed_at > lastObservedAt)) lastObservedAt = observation.observed_at;
    }
  }
  return {
    ...incident,
    child_executed: childExecuted,
    result_returned: resultReturned,
    last_observed_at: lastObservedAt,
  };
}

function publicIncident(value) {
  if (!value) return null;
  return {
    incident_id: value.incident_id,
    cause: value.cause,
    status: value.status,
    phase: value.phase,
    subagent_type: value.subagent_type,
    parent_model: value.parent_model,
    parent_model_id: value.parent_model_id,
    parent_model_params: value.parent_model_params,
    requested_child_model: value.requested_child_model,
    observed_child_model: value.observed_child_model,
    match_mode: value.match_mode ?? null,
    policy_mode: value.policy_mode ?? null,
    cursor_version: value.cursor_version,
    enforcement: value.enforcement,
    child_executed: value.child_executed,
    result_returned: value.result_returned,
    recorded_at: value.recorded_at,
    last_observed_at: value.last_observed_at,
  };
}

function cleanSummary(overrides = {}) {
  return {
    authoritative: false,
    status: "clean",
    incident_count: 0,
    last_incident: null,
    enforcement: "no-incident",
    evidence_effect: "none",
    result_policy: "verified-results-remain-usable",
    qualification_policy: "exact-model-attestation-still-required",
    match_policy: "parent-or-configured-approved-candidates",
    ...overrides,
  };
}

export function modelInheritanceSummary(stateRoot) {
  const incidentsRoot = join(modelRoot(stateRoot), "incidents");
  if (!existsSync(incidentsRoot)) return cleanSummary();
  let incidentEntries;
  try { incidentEntries = readdirSync(incidentsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()); }
  catch {
    return cleanSummary({
      status: "unattestable",
      enforcement: "diagnostic-state-unavailable",
    });
  }
  let unreadable = false;
  const incidents = incidentEntries
    .map((entry) => {
      const incident = readIncident(stateRoot, entry.name);
      unreadable ||= !incident;
      return incident;
    })
    .filter(Boolean)
    .sort((left, right) => String(left.last_observed_at ?? "").localeCompare(String(right.last_observed_at ?? "")));
  const hasDeviation = incidents.some((entry) => entry.status === "deviated");
  const lastIncident = incidents.at(-1) ?? null;
  return cleanSummary({
    status: hasDeviation ? "deviated" : incidents.length > 0 || unreadable ? "unattestable" : "clean",
    incident_count: incidents.length,
    last_incident: publicIncident(lastIncident),
    enforcement: lastIncident?.enforcement ?? (unreadable ? "diagnostic-state-unavailable" : "no-incident"),
  });
}

export function cleanupTransientModelState(stateRoot, nowMs = Date.now()) {
  for (const name of ["parents", "correlations"]) {
    const root = join(modelRoot(stateRoot), name);
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      try {
        if (nowMs - statSync(path).mtimeMs > TRANSIENT_TTL_MS) rmSync(path, { recursive: true, force: true });
      } catch { /* another hook process may have refreshed or removed the entry */ }
    }
  }
}
