#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectArtifactText, validateArtifactText } from "../scripts/validate-artifact.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const deny = (user_message) => ({ permission: "deny", user_message });

function schema5Claim(plan, root) {
  const inspected = inspectArtifactText(plan, root);
  if (inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.schema === 5) return true;
  return /```yaml artifact-envelope[\s\S]*?\bartifact:\s*work-plan\b[\s\S]*?\bschema:\s*5\b[\s\S]*?```/i.test(plan);
}

function nativePlanText(input) {
  const todos = input.todos.map((todo) => ({ ...todo, status: todo.status ?? "pending" }));
  const wrapper = {
    name: input.name,
    overview: input.overview,
    todos,
    isProject: typeof input.isProject === "boolean" ? input.isProject : true,
  };
  return `---\n${JSON.stringify(wrapper)}\n---\n${input.plan}`;
}

export function evaluateCreatePlanGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return deny("Workflow CreatePlan policy received invalid input and failed closed.");
  if (input.hook_event_name !== "preToolUse" || input.tool_name !== "CreatePlan") return {};
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput) || typeof toolInput.plan !== "string") {
    return deny("Workflow CreatePlan policy received an invalid CreatePlan payload and failed closed.");
  }
  const root = options.pluginRoot ?? pluginRoot;
  if (!schema5Claim(toolInput.plan, root)) return {};
  if (!Array.isArray(toolInput.todos) || toolInput.todos.length === 0) {
    return deny("Workflow Schema-5 CreatePlan denied: native todos are required, and the last todo must perform deterministic closeout.");
  }
  const failures = validateArtifactText(nativePlanText(toolInput), root);
  if (failures.length === 0) return {};
  const details = failures.slice(0, 8).map((failure) => String(failure).replace(/\s+/g, " ").slice(0, 300)).join("; ");
  return deny(`Workflow Schema-5 CreatePlan denied: ${details}. Repair the Root/todos and call CreatePlan again; no Plan was created.`);
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
    process.stdout.write(JSON.stringify(evaluateCreatePlanGuard(await readInput())));
  } catch {
    process.stdout.write(JSON.stringify(deny("Workflow CreatePlan policy was unavailable and failed closed.")));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
