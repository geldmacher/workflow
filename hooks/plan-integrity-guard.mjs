#!/usr/bin/env node
/** Cursor CreatePlan policy: validate the native Root without creating independent authority. */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractEmbeddedWorkPlanText,
  preflightRootPlan,
  validateArtifactText,
} from "../scripts/validate-artifact.mjs";
import { readTurnState } from "./closeout-guard.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const deny = (user_message) => ({ permission: "deny", user_message });

function nativePlanText(input) {
  const wrapper = {
    name: input.name,
    overview: input.overview,
    todos: Array.isArray(input.todos) ? input.todos.map((todo) => ({ ...todo, status: todo.status ?? "pending" })) : [],
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
  let activePlanWork = options.activePlanWork === true;
  if (!activePlanWork) {
    try {
      const turn = readTurnState(input, options);
      activePlanWork = turn.status === "valid" && turn.value?.phase === "planning" && turn.value?.plan_observation_status === "armed";
    } catch { /* ordinary CreatePlan stays fail-open when Workflow state is unavailable */ }
  }
  if (!activePlanWork) return {};
  const failures = validateArtifactText(nativePlanText(toolInput), root);
  if (failures.length > 0) {
    const detail = failures.slice(0, 8).map((failure) => String(failure).replace(/\s+/g, " ").slice(0, 300)).join("; ");
    return deny(`[workflow-plan-repair-required] CreatePlan denied: ${detail}. Rebuild the Authority Core internally and call CreatePlan again; no human workflow decision is required.`);
  }
  const rootText = extractEmbeddedWorkPlanText(nativePlanText(toolInput));
  if (!rootText) return deny("[workflow-plan-repair-required] CreatePlan denied: the native Plan has no valid generated Authority Core. Rebuild it internally and call CreatePlan again.");
  const preflight = (options.preflightRootPlan ?? preflightRootPlan)(rootText, root);
  if (!preflight.feasible) {
    const detail = (preflight.blocking_issues ?? []).slice(0, 8)
      .map((issue) => String(issue.message ?? issue).replace(/\s+/g, " ").slice(0, 300))
      .join("; ");
    return deny(`[workflow-plan-repair-required] CreatePlan denied: Authority validation failed${detail ? `: ${detail}` : ""}. Repair it internally and call CreatePlan again.`);
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
