#!/usr/bin/env node
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  childAllowedByPolicy,
  resolveManualSubagentPolicy,
} from "./manual-subagent-policy.mjs";
import {
  cleanupTransientModelState,
  hashWorkflowIdentifier,
  incidentIdFor,
  readParentModel,
  readTaskEvent,
  recordIncidentObservation,
  recordModelIncident,
  workflowStateRoot,
  writeParentModel,
  writeTaskEvent,
} from "./model-inheritance-state.mjs";
import { evaluateCreatePlanGuard } from "./plan-integrity-guard.mjs";
import { evaluateCloseoutGuard } from "./closeout-guard.mjs";

export const MODEL_INHERIT_MARKER = "[workflow-model-inherit-v1]";
export const READONLY_REVIEW_MARKER = "[workflow-readonly-review-v1]";

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024;
const ALLOWED_READONLY_AGENTS = new Set([
  "delivery-auditor",
  "risk-auditor",
  "work-design-auditor",
  "work-explainer",
  "work-plan-auditor",
]);
const LEGACY_PRIMARY_WRITER_MARKER = "[workflow-primary-writer-v1]";
const WORKFLOW_COMMAND = /(?:^|\s)\/(?:plan-work|correct-work|review-work|explain-work|close-work|learn-from-work|work-status|work-watch|work-control|work-models|work-verification|accept-work|auto-work)(?:\s|$)/i;
const READONLY_COMMAND = /(?:^|\s)\/(?:review-work|explain-work)(?:\s|$)/i;

const deny = (user_message) => ({ permission: "deny", user_message });
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const cleanModel = (value) => typeof value === "string" && value.trim() !== "" && value.trim().toLowerCase() !== "unknown"
  ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 256)
  : null;
const safeType = (value) => typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 256) : null;

function transcriptTail(path) {
  if (typeof path !== "string" || !isAbsolute(path)) return "";
  let descriptor;
  try {
    descriptor = openSync(path, "r");
    const size = fstatSync(descriptor).size;
    const length = Math.min(size, MAX_TRANSCRIPT_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(descriptor, buffer, 0, length, Math.max(0, size - length));
    return buffer.toString("utf8");
  } catch {
    return "";
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function timestamp(options) {
  const value = options.now ? options.now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function conversationHash(input) {
  const identifier = input.conversation_id ?? input.session_id ?? input.transcript_path;
  return hashWorkflowIdentifier("conversation", identifier);
}

function taskHash(input) {
  return hashWorkflowIdentifier("task", input.tool_use_id ?? input.tool_call_id);
}

function stateRoots(input, options) {
  if (typeof options.stateRoot === "string" && options.stateRoot !== "") return [options.stateRoot];
  const supplied = Array.isArray(input.workspace_roots) ? input.workspace_roots : options.workspaceRoots;
  const roots = Array.isArray(supplied)
    ? [...new Set(supplied.filter((entry) => typeof entry === "string" && isAbsolute(entry)))]
    : [];
  if (roots.length === 0) roots.push(resolve(options.cwd ?? process.cwd()));
  return roots.map((root) => workflowStateRoot(root, options));
}

function taskText(input) {
  if (input.hook_event_name === "preToolUse") {
    const candidate = input.tool_input?.prompt ?? input.tool_input?.task;
    return typeof candidate === "string" ? candidate : "";
  }
  return typeof input.task === "string" ? input.task : "";
}

function isWorkflowContext(task, transcript) {
  return task.includes(MODEL_INHERIT_MARKER)
    || transcript.includes(MODEL_INHERIT_MARKER)
    || task.includes(LEGACY_PRIMARY_WRITER_MARKER)
    || transcript.includes(LEGACY_PRIMARY_WRITER_MARKER)
    || task.includes(READONLY_REVIEW_MARKER)
    || WORKFLOW_COMMAND.test(task)
    || WORKFLOW_COMMAND.test(transcript);
}

function workflowPhase(task, transcript) {
  const source = `${task}\n${transcript}`;
  if (/\/(?:review-work)(?:\s|$)|\[workflow-readonly-review-v1\]/i.test(source)) return "review";
  if (/\/(?:explain-work)(?:\s|$)/i.test(source)) return "explanation";
  if (/\/(?:plan-work)(?:\s|$)/i.test(source)) return "planning";
  if (/\/(?:correct-work)(?:\s|$)/i.test(source)) return "correction";
  if (/\/(?:close-work|accept-work)(?:\s|$)/i.test(source)) return "closeout";
  if (/\/(?:learn-from-work)(?:\s|$)/i.test(source)) return "learning";
  if (/\/(?:auto-work|work-status|work-watch|work-control|work-models|work-verification)(?:\s|$)/i.test(source)) return "automation";
  return "implementation";
}

function requestModel(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput) || !own(toolInput, "model")) {
    return { allowed: true, value: null, display: "<omitted>" };
  }
  if (typeof toolInput.model === "string" && toolInput.model.trim().toLowerCase() === "inherit") {
    return { allowed: true, value: "inherit", display: "inherit" };
  }
  if (typeof toolInput.model === "string" && toolInput.model.trim() !== "") {
    return { allowed: false, value: toolInput.model.trim().slice(0, 256), display: toolInput.model.trim().slice(0, 256) };
  }
  return { allowed: false, value: "<invalid-model-value>", display: "<invalid-model-value>" };
}

function parentModel(snapshot) {
  return cleanModel(snapshot?.model ?? snapshot?.parent_model)
    ?? cleanModel(snapshot?.model_id ?? snapshot?.parent_model_id);
}

function findTask(states, hash, event) {
  for (const stateRoot of states) {
    const value = readTaskEvent(stateRoot, hash, event);
    if (value) return value;
  }
  return null;
}

function writeTask(states, hash, event, value) {
  for (const stateRoot of states) writeTaskEvent(stateRoot, hash, event, value);
}

function makeIncident(states, request, cause, overrides = {}) {
  const incidentId = incidentIdFor(request.task_hash, cause);
  const value = {
    incident_id: incidentId,
    cause,
    status: ["parent-model-unavailable", "child-model-unavailable", "uncorrelated-subagent-start"].includes(cause) ? "unattestable" : "deviated",
    phase: request.phase,
    subagent_type: request.subagent_type,
    parent_model: request.parent_model,
    parent_model_id: request.parent_model_id,
    parent_model_params: request.parent_model_params,
    requested_child_model: request.requested_child_model,
    observed_child_model: request.observed_child_model,
    cursor_version: request.cursor_version,
    enforcement: overrides.enforcement ?? request.enforcement ?? "unknown",
    task_hash: request.task_hash,
    recorded_at: overrides.recorded_at ?? request.recorded_at,
    ...overrides,
  };
  for (const stateRoot of states) recordModelIncident(stateRoot, value);
  return incidentId;
}

function incidentMessage({ incidentId, cause, parent, requested = null, observed = null }) {
  const fields = [
    `Parent: ${parent ?? "<unavailable>"}`,
    requested !== null ? `requested child: ${requested}` : null,
    observed !== null ? `observed child: ${observed}` : null,
    `cause: ${cause}`,
    `incident: ${incidentId}`,
  ].filter(Boolean);
  return `Workflow model inheritance denied. ${fields.join("; ")}.`;
}

function captureParent(input, options) {
  const states = stateRoots(input, options);
  const hash = conversationHash(input);
  const capturedAt = timestamp(options);
  for (const stateRoot of states) {
    writeParentModel(stateRoot, hash, {
      model: input.model,
      model_id: input.model_id,
      model_params: input.model_params,
      cursor_version: input.cursor_version,
      captured_by: input.hook_event_name,
      captured_at: capturedAt,
    });
    cleanupTransientModelState(stateRoot, Date.parse(capturedAt));
  }
  return {};
}

function evaluatePreToolUse(input, options) {
  if (input.tool_name !== "Task") return {};
  const task = taskText(input);
  const readTranscript = options.readTranscript ?? transcriptTail;
  const transcript = readTranscript(input.transcript_path);
  if (!isWorkflowContext(task, transcript)) return {};

  const states = stateRoots(input, options);
  const conversation = conversationHash(input);
  const hash = taskHash(input) ?? hashWorkflowIdentifier("task", `${conversation ?? "unknown"}:missing-tool-id`);
  const phase = workflowPhase(task, transcript);
  const subagentType = safeType(input.tool_input?.subagent_type ?? input.subagent_type);
  const requested = requestModel(input.tool_input);
  const capturedAt = timestamp(options);
  const parent = states.map((stateRoot) => readParentModel(stateRoot, conversation)).find(Boolean) ?? null;
  const canonicalParent = parentModel(parent);
  const reportedParent = cleanModel(input.model);
  const parentConsistent = !reportedParent || reportedParent === cleanModel(parent?.model) || reportedParent === cleanModel(parent?.model_id);
  let pretoolDecision = "allow";
  let incidentId = null;
  let cause = null;
  if (!canonicalParent || !parentConsistent) {
    pretoolDecision = "deny";
    cause = "parent-model-unavailable";
  } else if (!requested.allowed) {
    pretoolDecision = "deny";
    cause = "explicit-child-model";
  }
  const request = {
    task_hash: hash,
    conversation_hash: conversation,
    phase,
    subagent_type: subagentType,
    parent_model: cleanModel(parent?.model),
    parent_model_id: cleanModel(parent?.model_id),
    parent_model_params: parent?.model_params ?? [],
    requested_child_model: requested.value,
    observed_child_model: null,
    cursor_version: safeType(input.cursor_version ?? parent?.cursor_version),
    pretool_decision: pretoolDecision,
    incident_id: null,
    recorded_at: capturedAt,
  };
  if (cause) {
    incidentId = makeIncident(states, request, cause, { enforcement: "denied-before-start" });
    request.incident_id = incidentId;
  }
  writeTask(states, hash, "request", request);
  for (const stateRoot of states) cleanupTransientModelState(stateRoot, Date.parse(capturedAt));
  if (!cause) return {};
  return deny(incidentMessage({
    incidentId,
    cause,
    parent: canonicalParent,
    requested: requested.display,
  }));
}

function uncorrelatedRequest(input, task, transcript, hash, recordedAt, parent) {
  return {
    task_hash: hash,
    phase: workflowPhase(task, transcript),
    subagent_type: safeType(input.subagent_type),
    parent_model: cleanModel(parent?.model),
    parent_model_id: cleanModel(parent?.model_id),
    parent_model_params: parent?.model_params ?? [],
    requested_child_model: null,
    observed_child_model: cleanModel(input.subagent_model),
    cursor_version: safeType(input.cursor_version),
    recorded_at: recordedAt,
  };
}

function evaluateSubagent(input, options) {
  const task = taskText(input);
  const readTranscript = options.readTranscript ?? transcriptTail;
  const transcript = readTranscript(input.transcript_path);
  const states = stateRoots(input, options);
  const conversation = conversationHash(input);
  const hash = taskHash(input) ?? hashWorkflowIdentifier("task", `${conversation ?? "unknown"}:uncorrelated-start`);
  const request = findTask(states, hash, "request");
  if (!request && !isWorkflowContext(task, transcript)) return {};
  const recordedAt = timestamp(options);
  if (!request) {
    const parent = states.map((stateRoot) => readParentModel(stateRoot, conversation)).find(Boolean) ?? null;
    const incidentRequest = uncorrelatedRequest(input, task, transcript, hash, recordedAt, parent);
    const incidentId = makeIncident(states, incidentRequest, "uncorrelated-subagent-start", { enforcement: "denied-at-start" });
    return deny(incidentMessage({ incidentId, cause: "uncorrelated-subagent-start", parent: parentModel(parent), observed: incidentRequest.observed_child_model ?? "<unavailable>" }));
  }

  const canonicalParent = parentModel(request);
  const observedChild = cleanModel(input.subagent_model);
  const policy = options.manualSubagentPolicy ?? resolveManualSubagentPolicy(options);
  const allowance = childAllowedByPolicy({
    parentModel: canonicalParent,
    observedChild,
    hostPolicy: policy.hosts?.cursor,
    mode: policy.mode,
  });
  let cause = null;
  if (request.pretool_decision === "deny") {
    cause = request.incident_id ? null : "parent-model-unavailable";
  } else if (!canonicalParent) cause = "parent-model-unavailable";
  else if (!observedChild) cause = "child-model-unavailable";
  else if (!allowance.allowed) cause = "actual-child-mismatch";

  let incidentId = request.incident_id ?? null;
  if (cause) {
    incidentId = makeIncident(states, {
      ...request,
      observed_child_model: observedChild,
      match_mode: allowance.match_mode,
      policy_mode: policy.mode,
    }, cause, { enforcement: "denied-at-start", recorded_at: recordedAt });
  }
  if (request.pretool_decision === "deny" && incidentId) {
    for (const stateRoot of states) recordIncidentObservation(stateRoot, incidentId, "start", { observed_at: recordedAt });
  }

  const readonlyContext = task.includes(READONLY_REVIEW_MARKER) || READONLY_COMMAND.test(task) || READONLY_COMMAND.test(transcript);
  const readonlyDenied = readonlyContext && (!task.includes(READONLY_REVIEW_MARKER) || !ALLOWED_READONLY_AGENTS.has(input.subagent_type));
  const decision = request.pretool_decision === "deny" || cause || readonlyDenied ? "deny" : "allow";
  writeTask(states, hash, "start", {
    task_hash: hash,
    decision,
    incident_id: incidentId,
    observed_child_model: observedChild,
    match_mode: decision === "allow" ? allowance.match_mode : null,
    policy_mode: policy.mode,
    observed_at: recordedAt,
  });

  if (readonlyDenied) return deny("Workflow review permits only a marked, named read-only plugin agent.");
  if (decision === "allow") return {};
  const messageCause = cause ?? (request.requested_child_model && request.requested_child_model !== "inherit" ? "explicit-child-model" : "parent-model-unavailable");
  return deny(incidentMessage({
    incidentId,
    cause: messageCause,
    parent: canonicalParent,
    requested: request.requested_child_model ?? "<omitted>",
    observed: observedChild ?? "<unavailable>",
  }));
}

function observeCompletion(input, options) {
  if (input.hook_event_name === "postToolUse" && input.tool_name !== "Task") return {};
  const states = stateRoots(input, options);
  const hash = taskHash(input);
  if (!hash) return {};
  const request = findTask(states, hash, "request");
  if (!request) return {};
  const start = findTask(states, hash, "start");
  const recordedAt = timestamp(options);
  const isResult = input.hook_event_name === "postToolUse";
  const event = isResult ? "result" : "stop";
  writeTask(states, hash, event, {
    task_hash: hash,
    child_executed: true,
    result_returned: isResult,
    observed_at: recordedAt,
  });
  const denyWasIssued = request.pretool_decision === "deny" || start?.decision === "deny";
  if (!denyWasIssued) return {};

  if (request.incident_id) {
    for (const stateRoot of states) recordIncidentObservation(stateRoot, request.incident_id, event, {
      observed_at: recordedAt,
      child_executed: true,
      result_returned: isResult,
    });
  }
  const incidentId = makeIncident(states, {
    ...request,
    observed_child_model: start?.observed_child_model ?? null,
  }, "deny-not-enforced", { enforcement: "deny-not-enforced", recorded_at: recordedAt });
  for (const stateRoot of states) recordIncidentObservation(stateRoot, incidentId, event, {
    observed_at: recordedAt,
    child_executed: true,
    result_returned: isResult,
  });
  return {};
}

export function evaluateHookEvent(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return deny("Workflow subagent policy received invalid input and failed closed.");
  }
  if (["sessionStart", "beforeSubmitPrompt"].includes(input.hook_event_name)) return captureParent(input, options);
  if (input.hook_event_name === "preToolUse") return evaluatePreToolUse(input, options);
  if (input.hook_event_name === "subagentStart") return evaluateSubagent(input, options);
  if (["subagentStop", "postToolUse"].includes(input.hook_event_name)) return observeCompletion(input, options);
  return {};
}

export function evaluateSubagentStart(input, options = {}) {
  return evaluateHookEvent(input, options);
}

function isBlockingResult(value) {
  return value?.permission === "deny" || value?.continue === false;
}

/** One Cursor process per host event; individual policies stay independently testable. */
export function evaluateLifecycleHook(input, options = {}) {
  const subagent = evaluateHookEvent(input, options);
  if (isBlockingResult(subagent)) return subagent;
  const planning = evaluateCreatePlanGuard(input, options);
  if (isBlockingResult(planning)) return planning;
  const closeout = evaluateCloseoutGuard(input, options);
  if (isBlockingResult(closeout)) return closeout;
  for (const result of [closeout, planning, subagent]) {
    if (result && Object.keys(result).length > 0) return result;
  }
  return {};
}

async function readInput() {
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source) > MAX_INPUT_BYTES) throw new Error("hook input exceeds limit");
  }
  return JSON.parse(source);
}

async function main() {
  let input;
  try {
    input = await readInput();
  } catch {
    process.stdout.write(JSON.stringify(deny("Workflow subagent policy received malformed input and failed closed.")));
    return;
  }
  try {
    process.stdout.write(JSON.stringify(evaluateLifecycleHook(input)));
  } catch {
    const event = input.hook_event_name;
    const observational = ["sessionStart", "subagentStop"].includes(event);
    const stop = event === "stop";
    process.stdout.write(JSON.stringify(observational
      ? {}
      : stop
        ? { followup_message: "Workflow lifecycle state was unavailable and failed closed once. Do not claim delivery; restart from the exact current Root chain." }
        : deny("Workflow lifecycle policy was unavailable and failed closed.")));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
