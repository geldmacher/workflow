#!/usr/bin/env node
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export function evaluateSubagentStart(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || input.hook_event_name !== "subagentStart"
    || typeof input.subagent_type !== "string"
    || input.subagent_type.trim() === "") {
    return deny("Workflow subagent policy received invalid input and failed closed.");
  }

  const task = typeof input.task === "string" ? input.task : "";
  const readTranscript = options.readTranscript ?? transcriptTail;
  const transcript = readTranscript(input.transcript_path);
  const markedReadonlyTask = task.includes(READONLY_REVIEW_MARKER);
  const workflowContext = task.includes(MODEL_INHERIT_MARKER)
    || transcript.includes(MODEL_INHERIT_MARKER)
    || task.includes(LEGACY_PRIMARY_WRITER_MARKER)
    || transcript.includes(LEGACY_PRIMARY_WRITER_MARKER)
    || markedReadonlyTask
    || WORKFLOW_COMMAND.test(task)
    || WORKFLOW_COMMAND.test(transcript);
  if (!workflowContext) return {};

  // Cursor omits parent-model fields when a Task explicitly selects a child model.
  if (typeof input.subagent_model === "string" && input.subagent_model.trim() !== "") {
    return deny("Workflow subagents must inherit the model selected in Cursor; remove the explicit subagent model override.");
  }

  const reportedParentModel = typeof input.model_id === "string" && input.model_id.trim() !== ""
    ? input.model_id.trim()
    : typeof input.model === "string" ? input.model.trim() : "";
  if (reportedParentModel === "" || reportedParentModel.toLowerCase() === "unknown") {
    return deny("Workflow could not verify the Cursor-selected parent model, so subagent inheritance failed closed.");
  }

  const readonlyContext = markedReadonlyTask || READONLY_COMMAND.test(task) || READONLY_COMMAND.test(transcript);
  if (!readonlyContext) return {};

  if (!markedReadonlyTask || !ALLOWED_READONLY_AGENTS.has(input.subagent_type)) {
    return deny("Workflow review permits only a marked, named read-only plugin agent.");
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
  try {
    process.stdout.write(JSON.stringify(evaluateSubagentStart(await readInput())));
  } catch {
    process.stdout.write(JSON.stringify(deny("Workflow subagent policy received malformed input and failed closed.")));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
