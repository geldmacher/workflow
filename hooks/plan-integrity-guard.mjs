#!/usr/bin/env node
/** Cursor CreatePlan policy: validate the native Root without creating independent authority. */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractEmbeddedWorkPlanText,
  inspectArtifactText,
  preflightRootPlan,
  validateArtifactText,
} from "../scripts/validate-artifact.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const deny = (user_message) => ({ permission: "deny", user_message });

function workflowRootClaim(plan, root) {
  const inspected = inspectArtifactText(plan, root);
  if (inspected.artifact?.fields?.artifact === "work-plan") return true;
  return /```yaml artifact-envelope[\s\S]*?\bartifact:\s*work-plan\b[\s\S]*?```/i.test(plan);
}

function nativePlanText(input) {
  const wrapper = {
    name: input.name,
    overview: input.overview,
    todos: input.todos.map((todo) => ({ ...todo, status: todo.status ?? "pending" })),
    isProject: typeof input.isProject === "boolean" ? input.isProject : true,
  };
  return `---\n${JSON.stringify(wrapper)}\n---\n${input.plan}`;
}

function validateNativeCreatePlan(input, options = {}) {
  if (input.tool_name !== "CreatePlan") return {};
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput) || typeof toolInput.plan !== "string") {
    return deny("Workflow CreatePlan policy received an invalid CreatePlan payload and failed closed.");
  }
  const root = options.pluginRoot ?? pluginRoot;
  if (!workflowRootClaim(toolInput.plan, root)) return {};
  if (!Array.isArray(toolInput.todos) || toolInput.todos.length === 0) {
    return deny("Workflow Schema-6 CreatePlan denied: the native Plan requires at least one implementation todo.");
  }
  const failures = validateArtifactText(nativePlanText(toolInput), root);
  if (failures.length > 0) {
    const detail = failures.slice(0, 8).map((failure) => String(failure).replace(/\s+/g, " ").slice(0, 300)).join("; ");
    return deny(`Workflow Schema-6 CreatePlan denied: ${detail}. Repair the native Plan and call CreatePlan again.`);
  }
  const rootText = extractEmbeddedWorkPlanText(nativePlanText(toolInput));
  if (!rootText) return deny("Workflow Schema-6 CreatePlan denied: the native Plan does not contain one extractable exact Root.");
  const preflight = (options.preflightRootPlan ?? preflightRootPlan)(rootText, root);
  if (!preflight.feasible) {
    const detail = (preflight.blocking_issues ?? []).slice(0, 8)
      .map((issue) => String(issue.message ?? issue).replace(/\s+/g, " ").slice(0, 300))
      .join("; ");
    return deny(`Workflow Schema-6 CreatePlan denied: Root validation failed${detail ? `: ${detail}` : ""}. Repair the Root and call CreatePlan again.`);
  }
  return {};
}

export function evaluateCreatePlanGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return deny("Workflow CreatePlan policy received invalid input and failed closed.");
  }
  return input.hook_event_name === "preToolUse" ? validateNativeCreatePlan(input, options) : {};
}

async function readInput() {
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source) > MAX_INPUT_BYTES) throw new Error("hook input exceeds limit");
  }
  return JSON.parse(source);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.stdout.write(JSON.stringify(evaluateCreatePlanGuard(await readInput()))); }
  catch { process.stdout.write("{}"); }
}
