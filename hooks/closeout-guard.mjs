#!/usr/bin/env node
/** Cursor Manual lifecycle: task-local phase marker plus read-only Review. */

import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isReadOnlyShell, manualJourneyDecision } from "../scripts/validate-artifact.mjs";
import { hashWorkflowIdentifier, workflowStateRoot } from "./model-inheritance-state.mjs";
import {
  approveNativeImplementPlan,
  cleanupNativeTaskReviewContext,
  observeNativeCreatePlan,
  observeNativeReviewResult,
  prepareNativeReviewReceipt,
} from "./native-task-review-context.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const MUTATING_TOOL = /^(?:Write|Edit|Delete|Task|Agent|spawn_agent|ApplyPatch|apply_patch|DeleteFile|StrReplace|EditNotebook)$/i;
const READONLY_REVIEW_MARKER = "[workflow-readonly-review-v1]";
const READONLY_REVIEW_AGENTS = new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);

const deny = (user_message) => ({ permission: "deny", user_message });

function conversationHash(input) {
  return hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
}

function generationHash(input) {
  return hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id ?? "unknown");
}

function stateRoots(input, options = {}) {
  if (typeof options.stateRoot === "string" && options.stateRoot) return [options.stateRoot];
  const roots = Array.isArray(input?.workspace_roots)
    ? input.workspace_roots
      .filter((entry) => typeof entry === "string" && entry.startsWith("/"))
      .map((entry) => resolve(entry))
    : [];
  if (typeof input?.workspace_root === "string" && input.workspace_root.startsWith("/")) roots.push(resolve(input.workspace_root));
  if (roots.length === 0) roots.push(resolve(input?.cwd ?? options.cwd ?? process.cwd()));
  return [...new Set(roots)].map((root) => workflowStateRoot(root, options));
}

function turnPath(stateRoot, input) {
  const conversation = conversationHash(input);
  const generation = generationHash(input);
  return conversation && generation
    ? join(stateRoot, "manual-native-plan-review", conversation, `${generation}.json`)
    : null;
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function readTurn(input, options = {}) {
  for (const root of stateRoots(input, options)) {
    const path = turnPath(root, input);
    if (!path || !existsSync(path)) continue;
    const value = readJson(path);
    if (value?.schema === 2 && value?.kind === "manual-native-plan-review-turn") return value;
  }
  return null;
}

function writeTurn(input, value, options = {}) {
  for (const root of stateRoots(input, options)) {
    const path = turnPath(root, input);
    if (!path) continue;
    writeJson(path, {
      schema: 2,
      kind: "manual-native-plan-review-turn",
      ...value,
      updated_at: new Date().toISOString(),
    });
  }
}

function phaseFromPrompt(input) {
  const prompt = String(input.prompt ?? input.command ?? "");
  if (/^\s*\/(?:review-work)(?:\s|$)|\[workflow-codex-review-v1\]/i.test(prompt)) return "review";
  return null;
}

function toolInput(input) {
  if (input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input)) return input.tool_input;
  if (typeof input.tool_input !== "string") return {};
  try { return JSON.parse(input.tool_input); } catch { return {}; }
}

function isMutatingTool(input) {
  const name = String(input.tool_name ?? "");
  if (/^(?:Shell|Bash)$/i.test(name)) {
    const source = toolInput(input);
    return !isReadOnlyShell(source.command ?? source.cmd);
  }
  return MUTATING_TOOL.test(name);
}

function readOnlyReviewAgent(input) {
  if (!/^(?:Task|Agent|spawn_agent)$/i.test(String(input.tool_name ?? ""))) return null;
  const source = toolInput(input);
  const agent = String(source.subagent_type ?? source.agent_type ?? "");
  const prompt = String(source.prompt ?? source.task ?? "");
  return source.readonly === true && prompt.includes(READONLY_REVIEW_MARKER) && READONLY_REVIEW_AGENTS.has(agent)
    ? agent
    : null;
}

function nativeReviewDenial(value) {
  const failures = {
    unavailable: ["native-task-root-unavailable", "No human-approved native Schema-5 Plan is available in this Cursor task. Restore the native Plan context in this task, then repeat /review-work."],
    unapproved: ["native-task-root-unapproved", "The native Schema-5 Plan was created but no matching human Implement Plan action was observed. Select Implement Plan before repeating /review-work."],
    ambiguous: ["native-task-root-ambiguous", "More than one native Plan candidate could match this Cursor task. Approve exactly one native Plan, then repeat /review-work."],
    invalid: ["native-task-root-invalid", "The host-observed native Plan or predecessor chain is invalid. Repair and approve one native Plan, then repeat /review-work."],
    expired: ["native-task-receipt-expired", "The protected Cursor Review receipt expired. Repeat /review-work in the same approved native Plan task."],
    replayed: ["native-task-receipt-replayed", "The protected Cursor Review receipt was already consumed. Start a fresh /review-work turn."],
    mismatch: ["native-task-receipt-mismatch", `The Review call names a different Root than the host-approved Cursor task${value.expected_root_plan_id ? `; expected ${value.expected_root_plan_id}` : ""}. Repeat /review-work without model-supplied Root transport.`],
  };
  const [code, message] = failures[value.status] ?? failures.unavailable;
  return deny(`[${code}] ${message}`);
}

export function evaluateCloseoutGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const event = input.hook_event_name;
  const roots = stateRoots(input, options);
  const nativeContextEvent = event === "beforeSubmitPrompt"
    || (event === "postToolUse" && /^(?:CreatePlan|MCP:workflow_closeout)$/i.test(String(input.tool_name ?? "")))
    || (event === "preToolUse" && /^MCP:workflow_closeout$/i.test(String(input.tool_name ?? "")));
  if (nativeContextEvent) {
    for (const root of roots) {
      try { cleanupNativeTaskReviewContext(root, options); } catch { /* availability is handled only in explicit Review */ }
    }
  }
  if (event === "beforeSubmitPrompt") {
    try { approveNativeImplementPlan({ stateRoots: roots, input, options }); } catch { /* native non-Workflow prompts stay passive */ }
    const phase = phaseFromPrompt(input);
    if (phase) writeTurn(input, { phase, observed_review_auditors: [] }, options);
    return {};
  }
  if (event === "postToolUse" && input.tool_name === "CreatePlan") {
    try { observeNativeCreatePlan({ stateRoots: roots, input, pluginRoot: options.pluginRoot ?? pluginRoot, options }); } catch { /* preToolUse already owns CreatePlan denial */ }
    return {};
  }
  const turn = readTurn(input, options);
  if (!turn) return {};
  if (event === "preToolUse" && turn.phase === "review" && /^MCP:workflow_closeout$/i.test(String(input.tool_name ?? ""))) {
    let prepared;
    try {
      prepared = prepareNativeReviewReceipt({ stateRoots: roots, input, pluginRoot: options.pluginRoot ?? pluginRoot, options });
    } catch {
      prepared = { status: "invalid" };
    }
    if (!["ignored", "prepared"].includes(prepared.status)) return nativeReviewDenial(prepared);
  }
  if (event === "preToolUse" && turn.phase === "review" && isMutatingTool(input) && !readOnlyReviewAgent(input)) {
    return deny(manualJourneyDecision({
      state: "blocked",
      blocker: "Review is repository-read-only; repository writes require a separately approved correction.",
      action: "retry-review",
      trace: { root_plan_id: null },
    }));
  }
  if (event === "postToolUse" && turn.phase === "review") {
    if (/^MCP:workflow_closeout$/i.test(String(input.tool_name ?? ""))) {
      try { observeNativeReviewResult({ stateRoots: roots, input, pluginRoot: options.pluginRoot ?? pluginRoot, options }); } catch { /* MCP result remains authoritative in current task */ }
    }
    const auditor = readOnlyReviewAgent(input);
    if (auditor) writeTurn(input, {
      ...turn,
      observed_review_auditors: [...new Set([...(turn.observed_review_auditors ?? []), auditor])].sort(),
    }, options);
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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.stdout.write(JSON.stringify(evaluateCloseoutGuard(await readInput()))); }
  catch { process.stdout.write("{}"); }
}
