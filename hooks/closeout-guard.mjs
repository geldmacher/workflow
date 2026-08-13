#!/usr/bin/env node
/**
 * Cursor Manual closeout attestation.
 * Observes workflow_closeout structuredContent, denies completing plan-closeout todos
 * without recorded Evidence, validates the final delivery-report, records active Roots
 * on Implement Plan prompts, and issues one stop follow-up when attestation is missing.
 * Stop recovery is follow-up, not an unbypassable hard completion block.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import {
  beginManualCheckReceipt,
  completeManualCheckReceipt,
  evaluateDeliveryCompletion,
  expectedLineageFromArtifacts,
  formatDeliveryReportFence,
  inspectArtifactText,
  invalidateManualCheckReceipts,
  isReadOnlyShell,
  captureRepositorySnapshot,
  assertChangedPathAuthority,
  directMutationTargets,
  deriveRepositoryDelta,
  parseCloseoutInput,
  performNativeCloseout,
  readCloseoutRecord,
  rootContentHash,
  manualJourneyDecision,
  createManualBoundaryReceipt,
  verifyManualBoundaryReceipt,
} from "../scripts/validate-artifact.mjs";
import {
  hashWorkflowIdentifier,
  workflowStateRoot,
} from "./model-inheritance-state.mjs";
const MAX_INPUT_BYTES = 1024 * 1024;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const IMPLEMENT_PLAN_MARKER = /\b(?:implement(?:\s+(?:this|the))?\s+plan|plan\s+implementieren|implementiere\s+(?:diesen\s+)?plan)\b/i;
const IMPLEMENTATION_MARKER = /\[workflow-model-inherit-v1\]|\/(?:correct-work|close-work)\b|\b(?:implement(?:\s+(?:this|the))?\s+plan|plan\s+implementieren|implementiere\s+(?:diesen\s+)?plan)\b/i;
const REVIEW_MARKER = /\/(?:review-work)\b|\[workflow-codex-review-v1\]/;
const MUTATING_TOOL = /^(?:Write|Edit|Delete|Task|Agent|spawn_agent|ApplyPatch|apply_patch|DeleteFile|StrReplace|EditNotebook)$/i;
const ROOT_ID = /\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/;
const READONLY_REVIEW_MARKER = "[workflow-readonly-review-v1]";
const READONLY_REVIEW_AGENTS = new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);
const PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
  schema: 1,
  kind: "plan-closeout",
  action: "delivery-closeout",
});
const LEGACY_PLAN_CLOSEOUT_ACTION = "workflow_closeout";

const deny = (user_message) => ({ permission: "deny", user_message });

function conversationHash(input) {
  return hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
}

function generationHash(input) {
  return hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id ?? "unknown");
}

function absoluteRootsFrom(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((entry) => typeof entry === "string" && entry.startsWith("/"))
    .map((entry) => resolve(entry)))];
}

export function stateRoots(input, options = {}) {
  if (typeof options.stateRoot === "string" && options.stateRoot !== "") return [options.stateRoot];
  const supplied = Array.isArray(input?.workspace_roots) ? input.workspace_roots : options.workspaceRoots;
  const roots = absoluteRootsFrom(supplied);
  const singular = typeof input?.workspace_root === "string" && input.workspace_root.startsWith("/")
    ? resolve(input.workspace_root)
    : null;
  if (singular && !roots.includes(singular)) roots.push(singular);
  if (roots.length === 0) {
    const cwd = typeof input?.cwd === "string" && input.cwd.startsWith("/")
      ? input.cwd
      : (typeof options.cwd === "string" && options.cwd.startsWith("/") ? options.cwd : process.cwd());
    roots.push(resolve(cwd));
  }
  return roots.map((root) => workflowStateRoot(root, options));
}

function closeoutPath(stateRoot, conversation, generation) {
  return join(stateRoot, "manual-closeout", conversation, `${generation}.json`);
}

function activeRootPath(stateRoot, conversation) {
  return join(stateRoot, "manual-active-root", `${conversation}.json`);
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  try { chmodSync(path, 0o700); } catch { /* best effort */ }
}

function writeJson(path, value) {
  ensureDirectory(dirname(path));
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function parseToolOutput(input) {
  if (input.tool_output != null) {
    if (typeof input.tool_output === "string") {
      try { return JSON.parse(input.tool_output); } catch { return null; }
    }
    if (typeof input.tool_output === "object") return input.tool_output;
  }
  if (input.tool_response != null) return input.tool_response;
  if (typeof input.result_json === "string") {
    try { return JSON.parse(input.result_json); } catch { return null; }
  }
  return null;
}

function isWorkflowCloseoutTool(name) {
  const value = String(name ?? "");
  return /(?:^|:)workflow_closeout$/i.test(value) || /mcp__[^_]+__workflow_closeout$/i.test(value);
}

/** Lean Evidence omits strategy_revision / baseline_or_patched; those interpretative fills are not authority drift. */
const LEAN_INTERPRETIVE_NORMALIZATION = /^(?:lean evidence: interpreted missing strategy_revision as 0|lean evidence: interpreted CHECK-[1-9][0-9]* baseline_or_patched as patched)$/;

function inspectForCloseoutRecord(text, root) {
  const inspected = inspectArtifactText(text, root);
  const normalizations = (inspected.normalizations ?? []).filter((entry) => !LEAN_INTERPRETIVE_NORMALIZATION.test(String(entry)));
  return { ...inspected, normalizations };
}

function toolInputObject(input) {
  const value = input.tool_input;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isMutatingTool(input) {
  const name = String(input.tool_name ?? "");
  if (/^(?:Shell|Bash)$/i.test(name)) {
    const source = toolInputObject(input);
    return !isReadOnlyShell(source.command ?? source.cmd);
  }
  return MUTATING_TOOL.test(name);
}

function isHostEnforcedReadOnlyReviewAgent(input) {
  if (!/^(?:Task|Agent|spawn_agent)$/i.test(String(input.tool_name ?? ""))) return false;
  const source = toolInputObject(input);
  const prompt = String(source.prompt ?? source.task ?? "");
  const agent = String(source.subagent_type ?? source.agent_type ?? "");
  return source.readonly === true
    && prompt.includes(READONLY_REVIEW_MARKER)
    && READONLY_REVIEW_AGENTS.has(agent);
}

function isPlanCloseoutAttestation(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.schema === PLAN_CLOSEOUT_ATTESTATION.schema
    && value.kind === PLAN_CLOSEOUT_ATTESTATION.kind
    && [PLAN_CLOSEOUT_ATTESTATION.action, LEGACY_PLAN_CLOSEOUT_ACTION].includes(value.action)
    && Object.keys(value).length === 3,
  );
}

function isNativePlanCloseoutAttestation(value) {
  return isPlanCloseoutAttestation(value) && value.action === PLAN_CLOSEOUT_ATTESTATION.action;
}

export function isPlanCloseoutTodo(todo) {
  if (!todo || typeof todo !== "object" || Array.isArray(todo)) return false;
  if (isPlanCloseoutAttestation(todo.workflow_attestation)) return true;
  const content = String(todo.content ?? "");
  return content.startsWith("[workflow-model-inherit-v1]") && /close\s*out/i.test(content);
}

function todoListFromToolInput(toolInput) {
  if (Array.isArray(toolInput.todos)) return toolInput.todos;
  if (Array.isArray(toolInput.merge)) return toolInput.merge;
  return [];
}

function completingCloseoutTodos(toolInput) {
  return todoListFromToolInput(toolInput).filter((todo) => (
    isPlanCloseoutTodo(todo) && String(todo.status ?? "").toLowerCase() === "completed"
  ));
}

function extractRootPlanText(source) {
  const text = String(source ?? "");
  const fenced = text.match(/```yaml artifact-envelope\s*([\s\S]*?)```([\s\S]*)$/i);
  if (fenced?.[1]) {
    return `---\n${fenced[1].trim()}\n---\n${String(fenced[2] ?? "").trimStart()}`;
  }
  const bare = text.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n[\s\S]*)?)$/m);
  if (bare?.[1] && /\bartifact:\s*work-plan\b/.test(bare[1]) && /\bschema:\s*5\b/.test(bare[1])) {
    return bare[1];
  }
  return null;
}

function exactSchemaArtifact(source, artifactType, options = {}) {
  const text = String(source ?? "");
  const starts = [...text.matchAll(/^---\r?$/gm)].map((match) => match.index).filter(Number.isInteger);
  for (const start of starts) {
    const candidate = text.slice(start);
    const inspected = (options.inspectArtifactText ?? inspectArtifactText)(candidate, options.pluginRoot ?? pluginRoot);
    if (inspected.errors.length === 0 && inspected.artifact?.fields?.artifact === artifactType && inspected.artifact.fields.schema === 5) return candidate;
  }
  const inspected = (options.inspectArtifactText ?? inspectArtifactText)(text, options.pluginRoot ?? pluginRoot);
  return inspected.errors.length === 0 && inspected.artifact?.fields?.artifact === artifactType && inspected.artifact.fields.schema === 5 ? text : null;
}

function nativeCloseoutErrorCode(error) {
  const message = String(error?.message ?? error);
  if (/different immutable bytes|conflicting text|Root-content hash|Root mismatch/i.test(message)) return "artifact-text-conflict";
  if (/outside Root authority|protected by the Root|requires separate human approval|path escapes|resolves outside/i.test(message)) return "authority-violation";
  if (/repository baseline.*unavailable/i.test(message)) return "baseline-unavailable-after-mutation";
  if (/repository baseline|repository delta|repository snapshot|repository root changed|HEAD changed/i.test(message)) return "repository-observation-conflict";
  return "native-closeout-failed";
}

function captureBoundaryReceipt(input, turn, active, errorCode, options = {}) {
  if (turn.phase !== "review" || typeof active?.root_plan_text !== "string") return null;
  try {
    const workspaceRoot = workspaceRootForInput(input, options);
    const receipt = (options.createManualBoundaryReceipt ?? createManualBoundaryReceipt)({
      rootPlanText: active.root_plan_text,
      pluginRoot: options.pluginRoot ?? pluginRoot,
      workspaceRoot,
      recoveryErrorCode: errorCode,
      captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
      now: options.now,
      options: options.receiptOptions ?? {},
    });
    return { receipt, workspaceRoot };
  } catch {
    return null;
  }
}

export function recordActiveRootPlan(input, {
  rootPlanId,
  rootContentHash: providedHash = null,
  rootPlanText = null,
  phase = null,
} = {}, options = {}) {
  const conversation = conversationHash(input);
  if (!conversation || typeof rootPlanId !== "string" || !/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(rootPlanId)) return false;
  const hash = typeof providedHash === "string" && /^[a-f0-9]{64}$/.test(providedHash)
    ? providedHash
    : (typeof rootPlanText === "string" ? rootContentHash(rootPlanText) : null);
  for (const root of stateRoots(input, options)) {
    writeJson(activeRootPath(root, conversation), {
      root_plan_id: rootPlanId,
      root_content_hash: hash,
      ...(typeof rootPlanText === "string" ? { root_plan_text: rootPlanText } : {}),
      ...(typeof phase === "string" ? { phase } : {}),
      recorded_at: new Date().toISOString(),
      conversation_hash: conversation,
    });
  }
  return true;
}

export function readActiveRootPlan(input, options = {}) {
  if (typeof options.activeRootPlanId === "string") {
    return {
      root_plan_id: options.activeRootPlanId,
      root_content_hash: typeof options.activeRootContentHash === "string" ? options.activeRootContentHash : null,
      root_plan_text: typeof options.activeRootPlanText === "string" ? options.activeRootPlanText : null,
      phase: typeof options.phase === "string" ? options.phase : null,
    };
  }
  const conversation = conversationHash(input);
  if (!conversation) return null;
  for (const root of stateRoots(input, options)) {
    const path = activeRootPath(root, conversation);
    if (!existsSync(path)) continue;
    const value = readJson(path);
    if (value?.root_plan_id) return value;
  }
  return null;
}

export function clearActiveRootPlan(input, options = {}) {
  const conversation = conversationHash(input);
  if (!conversation) return false;
  let cleared = false;
  for (const root of stateRoots(input, options)) {
    const path = activeRootPath(root, conversation);
    if (!existsSync(path)) continue;
    rmSync(path, { force: true });
    cleared = true;
  }
  return cleared;
}

function readTurn(input, options = {}) {
  const conversation = conversationHash(input);
  const generation = generationHash(input);
  if (!conversation || !generation) return null;
  for (const root of stateRoots(input, options)) {
    const path = closeoutPath(root, conversation, generation);
    if (existsSync(path)) return { ...readJson(path), _path: path, _stateRoot: root };
  }
  return null;
}

function writeTurn(input, value, options = {}) {
  const conversation = conversationHash(input);
  const generation = generationHash(input);
  if (!conversation || !generation) return;
  for (const root of stateRoots(input, options)) {
    writeJson(closeoutPath(root, conversation, generation), {
      ...value,
      conversation_hash: conversation,
      generation_hash: generation,
      updated_at: new Date().toISOString(),
    });
  }
}

function invalidateTurn(input, options = {}) {
  const turn = readTurn(input, options);
  if (!turn) return;
  writeTurn(input, {
    ...turn,
    closeout_recorded: false,
    delivery_report_ok: false,
    invalidated: true,
    invalidate_reason: "mutating-tool-after-closeout",
  }, options);
}

function findRecordedCloseout(input, options = {}) {
  const turn = readTurn(input, options);
  if (turn?.closeout_recorded === true && turn.invalidated !== true) return turn;
  const conversation = conversationHash(input);
  if (!conversation) return null;
  for (const root of stateRoots(input, options)) {
    const directory = join(root, "manual-closeout", conversation);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) {
      if (!name.endsWith(".json")) continue;
      const value = readJson(join(directory, name));
      if (value?.closeout_recorded === true && value.invalidated !== true) return value;
    }
  }
  return null;
}

function conversationHasRecordedCloseout(input, options = {}) {
  return findRecordedCloseout(input, options) != null;
}

function closeoutRequired(input, options = {}) {
  const active = readActiveRootPlan(input, options);
  const turn = readTurn(input, options);
  if (turn?.required === true || turn?.closeout_recorded === true) {
    return Boolean(active?.root_plan_id);
  }
  const prompt = String(input.prompt ?? "");
  return Boolean(active?.root_plan_id && IMPLEMENTATION_MARKER.test(prompt));
}

function workspaceRootForInput(input, options = {}) {
  if (typeof options.workspaceRoot === "string" && options.workspaceRoot.startsWith("/")) return resolve(options.workspaceRoot);
  const supplied = Array.isArray(input?.workspace_roots) ? input.workspace_roots : [];
  const first = supplied.find((entry) => typeof entry === "string" && entry.startsWith("/"));
  if (first) return resolve(first);
  if (typeof input?.workspace_root === "string" && input.workspace_root.startsWith("/")) return resolve(input.workspace_root);
  if (typeof input?.cwd === "string" && input.cwd.startsWith("/")) return resolve(input.cwd);
  return process.cwd();
}

function inspectBoundActiveRoot(active, options = {}) {
  if (!active?.root_plan_id || typeof active.root_plan_text !== "string") {
    return { ok: false, reason: "No exact task-bound Schema-5 Root is available." };
  }
  const inspected = (options.inspectArtifactText ?? inspectArtifactText)(active.root_plan_text, options.pluginRoot ?? pluginRoot);
  const fields = inspected.artifact?.fields;
  if (inspected.errors.length > 0 || fields?.artifact !== "work-plan" || fields?.schema !== 5 || fields.id !== active.root_plan_id) {
    return { ok: false, reason: `The task-bound Root is invalid: ${inspected.errors[0] ?? "Root identity mismatch"}` };
  }
  if (active.root_content_hash !== rootContentHash(active.root_plan_text)) {
    return { ok: false, reason: "The task-bound Root bytes no longer match their recorded hash." };
  }
  return { ok: true, fields };
}

function captureBaselineBeforeMutation(input, options = {}) {
  if (!isMutatingTool(input) || isWorkflowCloseoutTool(input.tool_name)) return { ok: true };
  const active = readActiveRootPlan(input, options);
  const turn = readTurn(input, options) ?? {};
  const phase = turn.phase ?? null;
  if (!active?.root_plan_id || turn.required !== true || !["implementation", "correction"].includes(phase)) return { ok: false, reason: "This mutation is not bound to an approved implementation or correction phase." };
  if (turn.repository_baseline) return { ok: true };
  if (turn.repository_baseline_error) return { ok: false, reason: turn.repository_baseline_error };
  try {
    const capture = options.captureRepositorySnapshot ?? captureRepositorySnapshot;
    writeTurn(input, {
      ...turn,
      required: true,
      phase,
      repository_baseline: capture(workspaceRootForInput(input, options)),
      repository_baseline_error: null,
    }, options);
    return { ok: true };
  } catch (error) {
    const reason = String(error?.message ?? error);
    writeTurn(input, {
      ...turn,
      required: true,
      phase,
      repository_baseline_error: reason,
    }, options);
    return { ok: false, reason };
  }
}

function evaluateMutationAuthorityGate(input, options = {}) {
  if (!isMutatingTool(input) || isWorkflowCloseoutTool(input.tool_name)) return {};
  const turn = readTurn(input, options) ?? {};
  if (turn.phase === "review") {
    if (isHostEnforcedReadOnlyReviewAgent(input)) return {};
    return deny(manualJourneyDecision({
      state: "blocked",
      blocker: "Review is repository-read-only; repository writes require a separately approved correction.",
      action: "retry-review",
      trace: { root_plan_id: readActiveRootPlan(input, options)?.root_plan_id ?? null },
    }));
  }
  if (!["implementation", "correction"].includes(turn.phase)) return {};
  const active = readActiveRootPlan(input, options);
  const bound = inspectBoundActiveRoot(active, options);
  if (!bound.ok) return deny(`Workflow · Blocked. ${bound.reason} Next: return to the approved Plan or correction before editing.`);
  const baseline = captureBaselineBeforeMutation(input, options);
  if (!baseline.ok) return deny(`Workflow · Blocked. The pre-mutation repository baseline could not be captured: ${baseline.reason} Next: resolve the repository observation problem, then retry the same approved phase.`);
  try {
    const repositoryRoot = workspaceRootForInput(input, options);
    const targets = directMutationTargets({
      toolName: input.tool_name,
      toolInput: input.tool_input,
      repositoryRoot,
    });
    assertChangedPathAuthority(bound.fields, targets, repositoryRoot);
  } catch (error) {
    return deny(`Workflow · Blocked. ${String(error?.message ?? error)} Next: use /plan-work replan if the required path is outside the approved Root.`);
  }
  return {};
}

function capturePendingCheckReceipt(input, options = {}) {
  const active = readActiveRootPlan(input, options);
  const turn = readTurn(input, options) ?? {};
  if (!active?.root_plan_id || typeof active.root_plan_text !== "string") return;
  if (!["implementation", "correction", "review"].includes(turn.phase)) return;
  try {
    const candidate = beginManualCheckReceipt({
      rootPlanText: active.root_plan_text,
      pluginRoot: options.pluginRoot ?? pluginRoot,
      workspaceRoot: workspaceRootForInput(input, options),
      toolName: input.tool_name,
      toolInput: toolInputObject(input),
      captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
      now: options.now,
    });
    writeTurn(input, {
      ...turn,
      pending_check_receipt: candidate,
      check_receipt_status: candidate ? "pending" : null,
    }, options);
  } catch (error) {
    writeTurn(input, {
      ...turn,
      pending_check_receipt: null,
      check_receipt_status: "unavailable",
      check_receipt_error: String(error?.message ?? error),
    }, options);
  }
}

function invalidateCurrentRootReceipts(input, options = {}) {
  const active = readActiveRootPlan(input, options);
  if (!active?.root_plan_text) return;
  invalidateManualCheckReceipts({
    rootPlanText: active.root_plan_text,
    workspaceRoot: workspaceRootForInput(input, options),
    options: options.receiptOptions ?? {},
  });
}

function recordCompletedCheckReceipt(input, options = {}) {
  const turn = readTurn(input, options) ?? {};
  const candidate = turn.pending_check_receipt;
  const active = readActiveRootPlan(input, options);
  if (!candidate || !active?.root_plan_text) return null;
  try {
    const completed = completeManualCheckReceipt({
      candidate,
      rootPlanText: active.root_plan_text,
      workspaceRoot: workspaceRootForInput(input, options),
      toolResponse: parseToolOutput(input),
      captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
      now: options.now,
      options: options.receiptOptions ?? {},
    });
    writeTurn(input, {
      ...turn,
      pending_check_receipt: null,
      check_receipt_status: completed.status,
      check_receipt_hash: completed.receipt_hash ?? null,
      check_receipt_error: null,
    }, options);
    return completed;
  } catch (error) {
    writeTurn(input, {
      ...turn,
      pending_check_receipt: null,
      check_receipt_status: "unavailable",
      check_receipt_error: String(error?.message ?? error),
    }, options);
    return null;
  }
}

function evaluateTodoWriteGate(input, options = {}) {
  if (String(input.tool_name ?? "") !== "TodoWrite") return {};
  const toolInput = toolInputObject(input);
  const completing = completingCloseoutTodos(toolInput);
  if (completing.length === 0) return {};
  if (!closeoutRequired(input, options)) return {};
  if (completing.every((todo) => isNativePlanCloseoutAttestation(todo.workflow_attestation))) {
    const turn = readTurn(input, options) ?? {};
    writeTurn(input, { ...turn, required: true, native_closeout_pending: true }, options);
    return {};
  }
  if (conversationHasRecordedCloseout(input, options)) return {};
  return deny(
    "Workflow Schema-5 closeout todo cannot be marked completed before workflow_closeout records Delivery Evidence for the active Root. Call workflow_closeout with the exact Root/chain and Check observations, then complete the closeout todo.",
  );
}

function evaluateBeforeSubmitPrompt(input, options = {}) {
  const prompt = String(input.prompt ?? input.command ?? "");
  const phase = REVIEW_MARKER.test(prompt)
    ? "review"
    : /\/correct-work\b/.test(prompt)
      ? "correction"
      : IMPLEMENTATION_MARKER.test(prompt)
        ? "implementation"
        : null;
  if (!phase) return {};
  const requiresBoundRoot = phase === "correction" || (phase === "implementation" && IMPLEMENT_PLAN_MARKER.test(prompt));
  const selectedRootId = prompt.match(ROOT_ID)?.[0] ?? null;
  const rootText = extractRootPlanText(prompt);
  if (!rootText) {
    const active = readActiveRootPlan(input, options);
    if (active?.root_plan_id) {
      const bound = inspectBoundActiveRoot(active, options);
      if (requiresBoundRoot && !bound.ok) return deny(`Workflow · Plan required. ${bound.reason} Next: present and approve one valid Schema-5 Root.`);
      if (requiresBoundRoot && selectedRootId && selectedRootId !== active.root_plan_id) {
        return deny(`Workflow · Blocked. The approved selector ${selectedRootId} does not match the task-bound Root ${active.root_plan_id}. Next: approve the exact current Root only.`);
      }
      recordActiveRootPlan(input, {
        rootPlanId: active.root_plan_id,
        rootContentHash: active.root_content_hash,
        rootPlanText: active.root_plan_text,
        phase,
      }, options);
      writeTurn(input, { required: phase !== "review", phase }, options);
    } else if (requiresBoundRoot) {
      return deny("Workflow · Plan required. Implement Plan and correction need one exact valid Root bound to this conversation. Next: present and approve the Schema-5 Plan.");
    }
    return {};
  }
  const inspected = (options.inspectArtifactText ?? inspectArtifactText)(rootText, options.pluginRoot ?? pluginRoot);
  const rootPlanId = inspected.artifact?.fields?.id ?? null;
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact?.fields?.schema !== 5 || !rootPlanId) {
    return requiresBoundRoot
      ? deny(`Workflow · Plan required. The supplied Root is invalid: ${inspected.errors[0] ?? "invalid Schema-5 Root"}. Next: repair and approve the Plan.`)
      : {};
  }
  if (requiresBoundRoot && selectedRootId && selectedRootId !== rootPlanId) {
    return deny(`Workflow · Blocked. The approved selector ${selectedRootId} does not match the supplied Root ${rootPlanId}. Next: use one exact Root only.`);
  }
  const active = readActiveRootPlan(input, options);
  if (requiresBoundRoot && active?.root_plan_id && active.root_plan_id !== rootPlanId) {
    return deny(`Workflow · Blocked. The supplied Root ${rootPlanId} does not match the task-bound Root ${active.root_plan_id}. Next: return to the exact approved Plan or correction.`);
  }
  recordActiveRootPlan(input, { rootPlanId, rootPlanText: rootText, phase }, options);
  writeTurn(input, { required: phase !== "review", phase }, options);
  return {};
}

function missingCloseoutFollowUp() {
  return {
    followup_message: [
      "Workflow closeout attestation is incomplete.",
      "This is a Cursor recovery follow-up, not an unbypassable hard stop.",
      "Return exactly one typed closeout-input attestation so the lifecycle hook can derive and persist Evidence. Alternatively, call workflow_closeout as optional compatibility transport with the exact Root/chain and structured Check observations.",
      "Do not invent Evidence IDs, Root hashes, aggregate grades, status, or a delivery-report before a closeout path returns them.",
    ].join(" "),
  };
}

function missingActiveRootFollowUp() {
  return {
    followup_message: [
      "Workflow closeout was not started because this conversation has no bound Schema-5 Root for the current task.",
      "Continue the original request without closeout.",
      "Recover an older Root only when the user explicitly selects it in this conversation.",
    ].join(" "),
  };
}

function nativeCloseoutFailureFollowUp(reason) {
  return {
    followup_message: [
      "Workflow native closeout failed closed.",
      String(reason ?? "The typed closeout-input could not be attested."),
      "Correct the typed closeout-input or use optional workflow_closeout with the exact Root/chain; do not claim delivery success.",
    ].join(" "),
  };
}

function reviewRecoveryFollowUp(turn) {
  return {
    followup_message: [
      `Workflow recovered and persisted exact Evidence ${turn.delivery_evidence_id}.`,
      "Continue the same read-only review once using the hydrated exact chain.",
      "Do not mutate the repository and keep provisional, failed, or verified status unchanged.",
    ].join(" "),
  };
}

function missingDeliveryReportFollowUp(turn) {
  const expectedId = turn?.delivery_evidence_id ?? "de-*";
  const attachHint = turn?.handoff_persisted === false
    ? " Attach the exact Evidence artifact once, then include this delivery-report:"
    : " Do not dump the artifact. Include this delivery-report:";
  return {
    followup_message: [
      "Workflow closeout attestation is incomplete.",
      "This is a Cursor recovery follow-up, not an unbypassable hard stop.",
      "workflow_closeout already returned Evidence.",
      `${attachHint}`,
      formatDeliveryReportFence(expectedId),
    ].join(" "),
  };
}

export function evaluateCloseoutGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const event = input.hook_event_name;

  if (event === "beforeSubmitPrompt") {
    return evaluateBeforeSubmitPrompt(input, options);
  }

  if (event === "preToolUse") {
    const mutationGate = evaluateMutationAuthorityGate(input, options);
    if (mutationGate.permission === "deny") return mutationGate;
    capturePendingCheckReceipt(input, options);
    return evaluateTodoWriteGate(input, options);
  }

  if (event === "postToolUse" || event === "afterMCPExecution") {
    const toolName = input.tool_name;
    const completedReceipt = recordCompletedCheckReceipt(input, options);
    if (["recorded", "failed", "missing-result"].includes(completedReceipt?.status)) return {};
    if (isMutatingTool(input) && !isWorkflowCloseoutTool(toolName)) {
      try { invalidateCurrentRootReceipts(input, options); } catch { /* closeout will not find eligible proof */ }
      const existing = readTurn(input, options);
      if (existing?.closeout_recorded) invalidateTurn(input, options);
      return {};
    }
    if (!isWorkflowCloseoutTool(toolName)) return {};

    const response = parseToolOutput(input);
    const toolInput = toolInputObject(input);
    const closeoutRootPlanId = typeof toolInput.root_plan_id === "string" ? toolInput.root_plan_id : null;
    const activeRoot = readActiveRootPlan(input, options);
    const activeRootPlanId = activeRoot?.root_plan_id ?? null;
    const activeRootContentHash = typeof activeRoot?.root_content_hash === "string"
      ? activeRoot.root_content_hash
      : null;
    if (!activeRootPlanId) {
      writeTurn(input, {
        closeout_recorded: false,
        delivery_report_ok: false,
        record_reason: "missing-active-root",
        required: true,
      }, options);
      return {};
    }
    if (!activeRootContentHash || !/^[a-f0-9]{64}$/.test(activeRootContentHash)) {
      writeTurn(input, {
        closeout_recorded: false,
        delivery_report_ok: false,
        record_reason: "missing-active-root-content-hash",
        required: true,
        active_root_plan_id: activeRootPlanId,
      }, options);
      return {};
    }
    const inspectArtifact = options.inspectArtifactText ?? inspectForCloseoutRecord;
    const expectedLineage = expectedLineageFromArtifacts(toolInput.artifacts, closeoutRootPlanId ?? activeRootPlanId, {
      inspectArtifactText: inspectArtifact,
      pluginRoot: options.pluginRoot ?? pluginRoot,
    });
    const recorded = readCloseoutRecord(response, {
      inspectArtifactText: inspectArtifact,
      pluginRoot: options.pluginRoot ?? pluginRoot,
      activeRootPlanId,
      activeRootContentHash,
      closeoutRootPlanId,
      expectedLineage,
    });
    if (!recorded.ok) {
      writeTurn(input, {
        closeout_recorded: false,
        delivery_report_ok: false,
        record_reason: recorded.reason,
        required: true,
        active_root_plan_id: activeRootPlanId,
        active_root_content_hash: activeRootContentHash,
      }, options);
      return {};
    }
    writeTurn(input, {
      closeout_recorded: true,
      delivery_report_ok: false,
      required: true,
      delivery_evidence_id: recorded.record.id,
      delivery_evidence_artifact: recorded.record.artifact,
      delivery_evidence_hash: recorded.record.hash,
      handoff_persisted: recorded.record.handoff_persisted,
      delivery_evidence_root_plan_id: recorded.record.root_plan_id,
      active_root_plan_id: activeRootPlanId,
      active_root_content_hash: activeRootContentHash,
      expected_lineage: expectedLineage,
      enforcement: "cursor-followup",
    }, options);
    return {};
  }

  if (event === "afterAgentResponse") {
    const turn = readTurn(input, options) ?? {};
    const text = typeof input.text === "string" ? input.text : "";
    const active = readActiveRootPlan(input, options);
    const phase = turn.phase ?? null;
    const workflowBound = Boolean(
      active?.root_plan_id
      && (turn.required === true || ["implementation", "correction", "review"].includes(phase)),
    );
    if (!workflowBound) return {};
    const native = parseCloseoutInput(text);
    if (native.ok) {
      try {
        if (!["implementation", "correction", "review"].includes(phase)) {
          throw new Error("native closeout has no independently captured Manual phase");
        }
        if (!active?.root_plan_id || typeof active.root_plan_text !== "string") {
          throw new Error("independently captured exact Root text is unavailable");
        }
        if (active.root_plan_id !== native.report.root_plan_id) {
          throw new Error(`active Root ${active.root_plan_id} does not match ${native.report.root_plan_id}`);
        }
        const expectedPhase = phase === "review" ? "review-recovery" : phase;
        if (native.report.phase !== expectedPhase) {
          throw new Error(`closeout-input phase must be ${expectedPhase}`);
        }
        const capture = options.captureRepositorySnapshot ?? captureRepositorySnapshot;
        const current = capture(workspaceRootForInput(input, options));
        const derive = options.deriveRepositoryDelta ?? deriveRepositoryDelta;
        const repositoryDelta = derive(turn.repository_baseline ?? null, current);
        const closeout = (options.performNativeCloseout ?? performNativeCloseout)({
          attestation: native.report,
          expectedPhase,
          rootPlanText: active.root_plan_text,
          artifacts: options.artifacts ?? [],
          repositoryDelta,
          pluginRoot: options.pluginRoot ?? pluginRoot,
          handoffOptions: options.handoffOptions ?? {},
          receiptOptions: options.receiptOptions ?? {},
        });
        writeTurn(input, {
          ...turn,
          required: true,
          phase,
          closeout_recorded: true,
          native_closeout: true,
          native_closeout_error: null,
          delivery_report_ok: phase !== "review",
          delivery_evidence_id: closeout.fields.id,
          delivery_evidence_artifact: closeout.artifact,
          delivery_evidence_hash: closeout.artifact_hash,
          handoff_persisted: closeout.handoff_persisted,
          delivery_evidence_root_plan_id: closeout.fields.root_plan_id,
          active_root_plan_id: active.root_plan_id,
          active_root_content_hash: active.root_content_hash,
          review_recovery_pending: phase === "review",
          recovery_issued: false,
          final_text: text.slice(0, 200_000),
        }, options);
      } catch (error) {
        const errorCode = nativeCloseoutErrorCode(error);
        const boundary = captureBoundaryReceipt(input, turn, active, errorCode, options);
        writeTurn(input, {
          ...turn,
          required: true,
          phase,
          closeout_recorded: false,
          native_closeout: false,
          native_closeout_error: String(error?.message ?? error),
          native_closeout_error_code: errorCode,
          ...(boundary ? {
            boundary_receipt: boundary.receipt,
            boundary_receipt_workspace_root: boundary.workspaceRoot,
          } : {}),
          delivery_report_ok: false,
          final_text: text.slice(0, 200_000),
        }, options);
      }
      return {};
    }
    if (/\bkind\s*:\s*closeout-input\b|\bcloseout-input\b/i.test(text)) {
      writeTurn(input, {
        ...turn,
        required: true,
        native_closeout_error: native.issues.join("; "),
        delivery_report_ok: false,
        final_text: text.slice(0, 200_000),
      }, options);
      return {};
    }
    if (phase === "review") {
      const reviewText = exactSchemaArtifact(text, "work-review", options);
      if (reviewText) {
        const inspected = (options.inspectArtifactText ?? inspectArtifactText)(reviewText, options.pluginRoot ?? pluginRoot);
        const fields = inspected.artifact.fields;
        if (fields.root_plan_id !== active.root_plan_id) {
          writeTurn(input, { ...turn, review_artifact_error: `review Root ${fields.root_plan_id} does not match ${active.root_plan_id}`, final_text: text.slice(0, 200_000) }, options);
          return {};
        }
        if (fields.review_basis === "root-boundary") {
          const expected = turn.boundary_receipt;
          const verified = expected?.receipt_id === fields.boundary_receipt?.receipt_id
            ? (options.verifyManualBoundaryReceipt ?? verifyManualBoundaryReceipt)({
              receipt: fields.boundary_receipt,
              rootPlanText: active.root_plan_text,
              pluginRoot: options.pluginRoot ?? pluginRoot,
              workspaceRoot: turn.boundary_receipt_workspace_root,
              captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
              now: options.now,
              options: options.receiptOptions ?? {},
            })
            : { ok: false, reason: "no matching task-bound protected host receipt" };
          if (verified?.ok !== true) {
            writeTurn(input, { ...turn, review_artifact_error: `root-boundary review receipt is not trusted: ${verified?.reason ?? "host verification failed"}`, final_text: text.slice(0, 200_000) }, options);
            return {};
          }
        }
        writeTurn(input, {
          ...turn,
          required: false,
          review_artifact_id: fields.id,
          review_artifact_error: null,
          native_closeout_error: null,
          native_closeout_error_code: null,
          boundary_receipt: null,
          final_text: text.slice(0, 200_000),
        }, options);
        return {};
      }
    }
    if (!turn?.required) return {};
    const completion = evaluateDeliveryCompletion(text, turn);
    writeTurn(input, {
      ...turn,
      final_text: text.slice(0, 200_000),
      delivery_report_ok: completion.ok,
      delivery_report_reason: completion.reason,
    }, options);
    return {};
  }

  if (event === "stop") {
    if (input.status && input.status !== "completed") return {};
    const turn = readTurn(input, options);
    const active = readActiveRootPlan(input, options);
    if (!active?.root_plan_id && turn?.record_reason === "missing-active-root") {
      return missingActiveRootFollowUp();
    }
    const required = Boolean(
      active?.root_plan_id
      && (turn?.required === true || turn?.closeout_recorded === true),
    );
    if (!required) return {};

    if (turn?.review_recovery_pending) {
      if (turn.recovery_issued) return {};
      writeTurn(input, { ...turn, recovery_issued: true }, options);
      return reviewRecoveryFollowUp(turn);
    }
    if (turn?.review_artifact_error) return nativeCloseoutFailureFollowUp(turn.review_artifact_error);
    if (turn?.boundary_receipt) {
      return nativeCloseoutFailureFollowUp(`Evidence recovery is deterministically unavailable. Use only an insufficient-evidence/blocked/replan root-boundary review with this internal receipt: ${JSON.stringify(turn.boundary_receipt)}`);
    }
    if (turn?.native_closeout_error) return nativeCloseoutFailureFollowUp(turn.native_closeout_error);
    if (turn?.closeout_recorded && turn.delivery_report_ok) return {};
    if (turn?.closeout_recorded) return missingDeliveryReportFollowUp(turn);
    if (conversationHasRecordedCloseout(input, options)) {
      const recorded = findRecordedCloseout(input, options);
      return missingDeliveryReportFollowUp(recorded);
    }
    return missingCloseoutFollowUp();
  }

  return {};
}

async function readInput() {
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source) > MAX_INPUT_BYTES) throw new Error("hook input exceeds limit");
  }
  return source ? JSON.parse(source) : {};
}

async function main() {
  try {
    process.stdout.write(JSON.stringify(evaluateCloseoutGuard(await readInput())));
  } catch {
    process.stdout.write(JSON.stringify({
      followup_message: "Workflow closeout attestation was unavailable and failed closed. Re-run workflow_closeout and report the typed delivery-report before finishing.",
    }));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
