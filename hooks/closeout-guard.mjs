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
import { canonicalRepositoryRoot, withNativeStateLock } from "../src/core/native-task-review-state.mjs";
import { hashWorkflowIdentifier, workflowStateRoot } from "./model-inheritance-state.mjs";
import {
  authorizeNativeReviewShell,
  beginNativeCorrection,
  cleanupNativeTaskReviewContext,
  failNativeReview,
  markNativeRepositoryMutation,
  observeNativeCreatePlan,
  observeNativeCreatePlanAtStop,
  observeNativeReviewResult,
  prepareNativeReviewReceipt,
  recoverNativeReviewSelection,
  selectNativeReviewRoot,
} from "./native-task-review-context.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const MUTATING_TOOL = /^(?:Write|Edit|Delete|Task|Agent|spawn_agent|CreatePlan|ApplyPatch|apply_patch|DeleteFile|StrReplace|EditNotebook|Computer.*|Browser.*)$/i;
const READONLY_REVIEW_MARKER = "[workflow-readonly-review-v1]";
const READONLY_REVIEW_AGENTS = new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);
const READONLY_REVIEW_MCP = new Set([
  "mcp:workflow_plan_preflight",
  "mcp:workflow_artifact_context",
  "mcp:workflow_status",
]);

const deny = (user_message) => ({ permission: "deny", user_message });

function conversationHash(input) {
  return hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
}

function generationHash(input) {
  return hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id ?? "unknown");
}

function stateRoots(input, options = {}) {
  if (typeof options.stateRoot === "string" && options.stateRoot) return [options.stateRoot];
  const roots = [
    ...(Array.isArray(input?.workspace_roots) ? input.workspace_roots : []),
    input?.workspace_root,
    input?.cwd ?? options.cwd ?? process.cwd(),
  ].map((entry) => canonicalWorkspace(entry, options)).filter(Boolean);
  return [...new Set(roots)].map((root) => workflowStateRoot(root, options));
}

function canonicalWorkspace(path, options = {}) {
  try { return canonicalRepositoryRoot(path, options); } catch { return null; }
}

function authorityLocation(input, options = {}) {
  if (typeof options.stateRoot === "string" && options.stateRoot) {
    const workspaceRoot = typeof options.workspaceRoot === "string"
      ? canonicalWorkspace(options.workspaceRoot, options)
      : Array.isArray(input?.workspace_roots) && input.workspace_roots.length === 1
        ? canonicalWorkspace(input.workspace_roots[0], options)
        : typeof input?.cwd === "string" && input.cwd.startsWith("/")
          ? canonicalWorkspace(input.cwd, options)
          : null;
    return { status: "selected", stateRoots: [options.stateRoot], workspaceRoot };
  }
  const supplied = Array.isArray(input?.workspace_roots) ? input.workspace_roots : [];
  const canonical = supplied.map((value) => canonicalWorkspace(value, options));
  if (canonical.some((value) => !value)) return { status: "unavailable", stateRoots: [], workspaceRoot: null };
  const workspaces = [...new Set(canonical)];
  const cwd = canonicalWorkspace(input?.cwd, options);
  if (workspaces.length === 0 && cwd) return { status: "selected", stateRoots: [workflowStateRoot(cwd, options)], workspaceRoot: cwd };
  if (workspaces.length === 1) {
    if (cwd && cwd !== workspaces[0]) return { status: "ambiguous", stateRoots: [], workspaceRoot: null };
    return { status: "selected", stateRoots: [workflowStateRoot(workspaces[0], options)], workspaceRoot: workspaces[0] };
  }
  return { status: workspaces.length > 1 ? "ambiguous" : "unavailable", stateRoots: [], workspaceRoot: null };
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

function withTurnLock(path, callback, options = {}) {
  return withNativeStateLock(`${path}.lock`, callback, options);
}

function readTurnState(input, options = {}) {
  let found = null;
  for (const root of stateRoots(input, options)) {
    const path = turnPath(root, input);
    if (!path || !existsSync(path)) continue;
    const value = readJson(path);
    if (value?.schema !== 4 || value?.kind !== "manual-native-plan-review-turn") return { status: "invalid", value: null };
    found ??= value;
  }
  return found ? { status: "valid", value: found } : { status: "absent", value: null };
}

function writeTurn(input, valueOrUpdater, options = {}) {
  for (const root of stateRoots(input, options)) {
    const path = turnPath(root, input);
    if (!path) continue;
    withTurnLock(path, () => {
      const current = readJson(path);
      const value = typeof valueOrUpdater === "function"
        ? valueOrUpdater(current)
        : valueOrUpdater;
      writeJson(path, {
        ...value,
        schema: 4,
        kind: "manual-native-plan-review-turn",
        revision: current?.schema === 4 && Number.isInteger(current.revision) ? current.revision + 1 : 1,
        updated_at: new Date().toISOString(),
      });
    }, options);
  }
}

function phaseFromPrompt(input) {
  const prompt = String(input.prompt ?? input.command ?? "");
  if (/^\s*\/(?:plan-work)(?:\s|$)/i.test(prompt)) return "planning";
  if (/^\s*\/(?:review-work)(?:\s|$)|\[workflow-codex-review-v1\]/i.test(prompt)) return "review";
  if (/^\s*\/(?:correct-work)(?:\s|$)/i.test(prompt)) return "correction";
  return null;
}

function eventTimestamp(options = {}) {
  const value = options.now ? options.now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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
  if (/^MCP:/i.test(name)) return !READONLY_REVIEW_MCP.has(name.toLowerCase());
  return MUTATING_TOOL.test(name);
}

function isPotentialRepositoryMutation(input) {
  const name = String(input.tool_name ?? "");
  if (/^(?:Shell|Bash)$/i.test(name)) {
    const source = toolInput(input);
    return !isReadOnlyShell(source.command ?? source.cmd);
  }
  if (/^MCP:/i.test(name)) {
    return !/^MCP:workflow_closeout$/i.test(name) && !READONLY_REVIEW_MCP.has(name.toLowerCase());
  }
  return /^(?:Write|Edit|Delete|Task|Agent|spawn_agent|ApplyPatch|apply_patch|DeleteFile|StrReplace|EditNotebook|Computer.*|Browser.*)$/i.test(name);
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
  const reasons = value.reason_codes ?? [];
  if (reasons.includes("native-plan-file-ambiguous")) {
    return deny("[native-plan-file-ambiguous] Workflow found more than one native Plan file created in the observed Plan turn, so none can grant Root authority. Create one fresh Plan in this task, then repeat /review-work.");
  }
  if (reasons.includes("native-plan-transcript-unavailable") && reasons.includes("native-plan-file-missing")) {
    return deny("[native-plan-root-unavailable] Cursor supplied no task transcript and no unique recent native Plan file for the observed Plan turn. Create one fresh Plan in this task, then repeat /review-work.");
  }
  if (reasons.some((reason) => reason.startsWith("native-plan-transcript-"))) {
    return deny("[native-plan-transcript-invalid] Workflow could not bind exactly one completed CreatePlan from the current task transcript. Create one fresh Plan in this task, then repeat /review-work.");
  }
  const failures = {
    unavailable: ["native-task-root-unavailable", "No current validated Schema-5 CreatePlan Root is available in this Cursor task. Create a fresh Plan in this task, then repeat /review-work."],
    ambiguous: ["native-workspace-ambiguous", "Workflow cannot bind this Review to exactly one Cursor workspace. Open the intended repository by itself, then repeat /review-work."],
    invalid: ["native-task-root-invalid", "The host-observed native Plan or predecessor chain is invalid. Create one fresh valid Plan, then repeat /review-work."],
    busy: ["native-review-busy", "Another protected Review call is already in flight for this task. Wait for it to finish or start a fresh /review-work turn after failure."],
    expired: ["native-task-receipt-expired", "The protected Cursor Review receipt expired. Repeat /review-work in the same native Plan task."],
    replayed: ["native-task-receipt-replayed", "The protected Cursor Review receipt was already consumed. Start a fresh /review-work turn."],
    mismatch: value.reason === "repository-mutated-during-review"
      ? ["native-review-repository-mutated", "The repository changed after Review began, so this observation is invalid. Restore or authorize the change, then start a fresh /review-work turn."]
      : ["native-task-receipt-mismatch", `The Review call conflicts with the host-selected Cursor task${value.expected_root_plan_id ? `; expected Root ${value.expected_root_plan_id}` : ""}. Repeat /review-work without model-supplied Root or receipt transport.`],
  };
  const [code, message] = failures[value.status] ?? failures.unavailable;
  return deny(`[${code}] ${message}`);
}

export function evaluateCloseoutGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const event = input.hook_event_name;
  const roots = stateRoots(input, options);
  const authority = authorityLocation(input, options);
  const authorityOptions = { ...options, ...(authority.workspaceRoot ? { workspaceRoot: authority.workspaceRoot } : {}) };
  const nativeContextEvent = event === "beforeSubmitPrompt"
    || event === "stop"
    || (event === "postToolUse" && /^(?:CreatePlan|MCP:workflow_closeout)$/i.test(String(input.tool_name ?? "")))
    || (event === "postToolUseFailure" && /^MCP:workflow_closeout$/i.test(String(input.tool_name ?? "")))
    || (event === "preToolUse" && /^MCP:workflow_closeout$/i.test(String(input.tool_name ?? "")));
  if (nativeContextEvent) {
    for (const root of roots) {
      try { cleanupNativeTaskReviewContext(root, options); } catch { /* availability is handled only in explicit Review */ }
    }
  }
  if (event === "beforeSubmitPrompt") {
    const phase = phaseFromPrompt(input);
    if (phase === "planning") {
      writeTurn(input, {
        phase,
        authority_status: authority.status,
        workspace_root: authority.workspaceRoot,
        plan_observation_started_at: eventTimestamp(options),
        plan_observation_status: "armed",
        implementation_authorization: "host-owned-unattested",
      }, options);
    } else if (phase === "review") {
      let selection = { status: authority.status };
      if (authority.status === "selected") {
        try {
          selection = selectNativeReviewRoot({
            stateRoots: authority.stateRoots,
            input,
            pluginRoot: options.pluginRoot ?? pluginRoot,
            options: authorityOptions,
          });
        } catch { selection = { status: "invalid" }; }
      }
      writeTurn(input, {
        phase,
        authority_status: selection.status,
        authority_reason_codes: selection.reason_codes ?? [],
        root_plan_id: selection.root_plan_id ?? null,
        review_enforcement: selection.status === "selected"
          ? { status: "enforced", reason_codes: [] }
          : { status: "unavailable", reason_codes: ["review-observer-unavailable"] },
        implementation_authorization: "host-owned-unattested",
        observed_review_auditors: [],
      }, options);
    } else if (phase === "correction" && authority.status === "selected") {
      try {
        beginNativeCorrection({
          stateRoots: authority.stateRoots,
          input,
          pluginRoot: options.pluginRoot ?? pluginRoot,
          options: authorityOptions,
        });
      } catch { /* correction without a valid current review stays non-authoritative */ }
    }
    return {};
  }
  if (event === "stop") {
    const planningTurn = readTurnState(input, options);
    const marker = planningTurn.status === "valid" && planningTurn.value?.phase === "planning"
      ? planningTurn.value
      : null;
    if (marker && marker.plan_observation_status === "armed" && input.status === "completed") {
      let observation = { status: authority.status, reason_codes: ["native-plan-workspace-unavailable"] };
      if (authority.status === "selected" && marker.workspace_root === authority.workspaceRoot) {
        try {
          observation = observeNativeCreatePlanAtStop({
            stateRoots: authority.stateRoots,
            input,
            markerStartedAt: marker.plan_observation_started_at,
            pluginRoot: options.pluginRoot ?? pluginRoot,
            options: authorityOptions,
          });
        } catch {
          observation = { status: "invalid", reason_codes: ["native-plan-stop-observer-failed"] };
        }
      } else if (authority.status === "selected") {
        observation = { status: "mismatch", reason_codes: ["native-plan-workspace-mismatch"] };
      }
      try {
        writeTurn(input, (current) => ({
          ...(current?.schema === 4 && current?.kind === "manual-native-plan-review-turn" ? current : marker),
          plan_observation_status: observation.status,
          plan_observation_reason_codes: observation.reason_codes ?? [],
          root_plan_id: observation.root_plan_id ?? null,
          root_binding: observation.root_binding ?? null,
          plan_observation_completed_at: eventTimestamp(options),
        }), options);
      } catch { /* stop remains passive even when diagnostic state is unavailable */ }
    }
    return {};
  }
  if (event === "postToolUse" && input.tool_name === "CreatePlan") {
    if (authority.status === "selected") {
      try {
        observeNativeCreatePlan({
          stateRoots: authority.stateRoots,
          input,
          pluginRoot: options.pluginRoot ?? pluginRoot,
          options: authorityOptions,
        });
      } catch { /* CreatePlan itself already completed; next explicit Review exposes unavailability */ }
    }
    return {};
  }
  let turnState = readTurnState(input, options);
  let turn = turnState.value;
  const closeoutCall = event === "preToolUse"
    && /^MCP:workflow_closeout$/i.test(String(input.tool_name ?? ""))
    && (toolInput(input).artifact_kind ?? "delivery-evidence") === "work-review";
  if (closeoutCall && !turn && authority.status === "selected") {
    let recovered;
    try {
      recovered = recoverNativeReviewSelection({
        stateRoots: authority.stateRoots,
        input,
        pluginRoot: options.pluginRoot ?? pluginRoot,
        options: authorityOptions,
      });
    } catch (error) {
      recovered = { status: error?.code === "native-state-busy" ? "busy" : "invalid" };
    }
    if (recovered.status === "selected-provisional") {
      turn = {
        phase: "review",
        authority_status: "selected-provisional",
        root_plan_id: recovered.root_plan_id,
        review_enforcement: recovered.review_enforcement,
        implementation_authorization: "host-owned-unattested",
        observed_review_auditors: [],
      };
      writeTurn(input, turn, options);
      turnState = { status: "valid", value: turn };
    } else {
      return deny("[review-observer-unavailable] Workflow could not confirm this Review activation. Verify Hook Trust, reload Cursor, then submit exactly /review-work again in this task.");
    }
  }
  const guardedTool = /^(?:Shell|Bash)$/i.test(String(input.tool_name ?? "")) || isMutatingTool(input);
  // Corrupt or unreadable Workflow state cannot establish an active Review.
  // Host-native tools stay available; without valid state the protected Review
  // receipt cannot be issued, so Workflow delivery evidence still fails safe.
  if (turn?.phase === "review"
    && turn.authority_status === "ambiguous"
    && event === "preToolUse"
    && guardedTool
    && !readOnlyReviewAgent(input)) {
    return nativeReviewDenial({ status: "ambiguous", reason_codes: turn.authority_reason_codes ?? [] });
  }
  if (closeoutCall && turn?.phase === "review") {
    let prepared;
    try {
      prepared = prepareNativeReviewReceipt({
        stateRoots: authority.stateRoots,
        input,
        pluginRoot: options.pluginRoot ?? pluginRoot,
        options: authorityOptions,
      });
    } catch (error) {
      prepared = { status: error?.code === "native-state-busy" ? "busy" : "invalid" };
    }
    if (!["ignored", "prepared"].includes(prepared.status)) return nativeReviewDenial(prepared);
    if (prepared.status === "prepared") return { updated_input: prepared.updated_input };
  }
  if (event === "preToolUse" && turn?.phase === "review" && /^(?:Shell|Bash)$/i.test(String(input.tool_name ?? ""))) {
    let shell;
    try {
      shell = authorizeNativeReviewShell({
        stateRoots: authority.stateRoots,
        input,
        pluginRoot: options.pluginRoot ?? pluginRoot,
        options: authorityOptions,
      });
    } catch (error) {
      shell = { status: "denied", reason: error?.code === "native-state-busy" ? "native-state-busy" : "shell-authority-invalid" };
    }
    if (shell.status === "allowed") return {};
    return deny(manualJourneyDecision({
      state: "blocked",
      blocker: `Review Shell is limited to one exact machine-verifiable Check from the active Root (${shell.reason ?? "unapproved-root-check"}).`,
      action: "retry-review",
      trace: { root_plan_id: turn.root_plan_id ?? null },
    }));
  }
  if (event === "preToolUse" && turn?.phase === "review" && isMutatingTool(input) && !readOnlyReviewAgent(input)) {
    return deny(manualJourneyDecision({
      state: "blocked",
      blocker: "Review is repository-read-only; repository writes require a separately approved correction.",
      action: "retry-review",
      trace: { root_plan_id: null },
    }));
  }
  if (event === "preToolUse"
    && isPotentialRepositoryMutation(input)
    && !readOnlyReviewAgent(input)) {
    try {
      const mutationStateRoots = authority.status === "selected" ? authority.stateRoots : roots;
      for (const stateRoot of [...new Set(mutationStateRoots)]) {
        markNativeRepositoryMutation({
          stateRoots: [stateRoot],
          input,
          options: authorityOptions,
        });
      }
    } catch { /* observation failure cannot block a host-native mutation */ }
  }
  if (!turn) return {};
  if (event === "postToolUse" && turn.phase === "review") {
    if (/^MCP:workflow_closeout$/i.test(String(input.tool_name ?? ""))) {
      try {
        observeNativeReviewResult({
          stateRoots: authority.stateRoots,
          input,
          pluginRoot: options.pluginRoot ?? pluginRoot,
          options: authorityOptions,
        });
      } catch { /* MCP result remains authoritative in current task */ }
    }
    const auditor = readOnlyReviewAgent(input);
    if (auditor) writeTurn(input, (current) => {
      const active = current?.schema === 4 && current?.kind === "manual-native-plan-review-turn" ? current : turn;
      return {
        ...active,
        observed_review_auditors: [...new Set([...(active.observed_review_auditors ?? []), auditor])].sort(),
      };
    }, options);
  }
  if (event === "postToolUseFailure" && turn.phase === "review" && /^MCP:workflow_closeout$/i.test(String(input.tool_name ?? ""))) {
    try { failNativeReview({ stateRoots: authority.stateRoots, input, options: authorityOptions }); } catch { /* fresh Review clears stale state */ }
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
  const enforcement = process.argv.includes("--enforce");
  try { process.stdout.write(JSON.stringify(evaluateCloseoutGuard(await readInput(), { enforcementMode: enforcement }))); }
  catch (error) {
    if (enforcement) {
      process.stderr.write(`Workflow enforcement unavailable; host action remains available: ${String(error?.message ?? error)}\n`);
    }
    process.stdout.write("{}");
  }
}
