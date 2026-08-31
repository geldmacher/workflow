#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHostDecisionReceiptAdapter } from "../src/harness/host-decision-receipts.mjs";
import { protectedRecordHash, stableProtectedRecordJson } from "../src/core/protected-record-store.mjs";
import { canonicalRepositoryRoot } from "../src/harness/native-task-review-state.mjs";
import { nativeAutomationDecisionContext } from "../src/harness/native-automation-state.mjs";
import { hashWorkflowIdentifier, workflowStateRoot } from "./workflow-state.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const SELECTION_TTL_MS = 10 * 60 * 1000;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const humanActions = new Set(["review", "correct"]);
const deny = (user_message) => ({ permission: "deny", user_message });

export function parseAutomationDecisionPrompt(prompt) {
  const match = String(prompt ?? "").match(/^\s*\/auto-work\s+(review|correct)\s+(run-[a-f0-9]{24})@([0-9]+)\s*$/);
  if (!match) return null;
  return { action: match[1], run_id: match[2], revision: Number(match[3]) };
}

function identity(input) {
  const conversation = hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
  const generation = hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id ?? "unknown");
  return conversation && generation ? { conversation, generation } : null;
}

function workspace(input, options = {}) {
  if (options.workspaceRoot) return canonicalRepositoryRoot(options.workspaceRoot, options);
  const roots = [...(Array.isArray(input.workspace_roots) ? input.workspace_roots : []), input.workspace_root, input.cwd ?? options.cwd]
    .filter((value) => typeof value === "string" && value);
  const canonical = [...new Set(roots.map((value) => { try { return canonicalRepositoryRoot(value, options); } catch { return null; } }).filter(Boolean))];
  return canonical.length === 1 ? canonical[0] : null;
}

function state(input, options = {}) {
  const workspaceRoot = workspace(input, options);
  const ids = identity(input);
  if (!workspaceRoot || !ids) return null;
  const stateRoot = options.stateRoot ?? workflowStateRoot(workspaceRoot, options);
  const path = join(stateRoot, "native-automation-decisions", ids.conversation, `${ids.generation}.json`);
  return { workspaceRoot, stateRoot, path, ...ids };
}

function readSelection(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value?.schema === 1 && value?.kind === "native-automation-decision" ? value : null;
  } catch { return null; }
}

function writeSelection(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function exactDecisionState(action, context) {
  if (context.pending_transition) return false;
  return context.lifecycle === (action === "review" ? "review-needed" : "correction-needed");
}

function sameContext(selection, context) {
  return selection.run_id === context.run_id
    && selection.revision === context.revision
    && selection.evidence_hash === context.evidence_hash
    && selection.review_hash === context.review_hash
    && context.pending_transition === null;
}

function toolInput(input) {
  return input?.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {};
}

function toolInputHash(value) {
  return protectedRecordHash(stableProtectedRecordJson(value));
}

function provenTransportFailure(input) {
  const detail = [input.error, input.error_message, input.message, input.failure_reason]
    .filter((value) => typeof value === "string")
    .join(" ");
  return /\b(transport|connection|disconnected|timeout|timed out|broken pipe|econn(?:reset|refused|aborted)|mcp server (?:closed|unavailable))\b/i.test(detail);
}

export function evaluateAutomationGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const event = input.hook_event_name;
  const location = state(input, options);
  if (event === "beforeSubmitPrompt") {
    const selected = parseAutomationDecisionPrompt(input.prompt ?? input.command);
    if (!selected || !location) return {};
    try {
      const context = nativeAutomationDecisionContext(location.stateRoot, selected.run_id);
      if (context.revision !== selected.revision || !exactDecisionState(selected.action, context)) return {};
      const now = options.now ? options.now() : new Date();
      const selectedAt = (now instanceof Date ? now : new Date(now)).toISOString();
      writeSelection(location.path, {
        schema: 1,
        kind: "native-automation-decision",
        action: selected.action,
        run_id: selected.run_id,
        revision: selected.revision,
        evidence_hash: context.evidence_hash,
        review_hash: context.review_hash,
        workspace_root: location.workspaceRoot,
        conversation_hash: location.conversation,
        generation_hash: location.generation,
        selected_at: selectedAt,
        expires_at: new Date(Date.parse(selectedAt) + SELECTION_TTL_MS).toISOString(),
        transport_retry: null,
        inflight: null,
      });
    } catch { /* exact MCP call exposes the unavailable selection */ }
    return {};
  }

  const prepareCall = /^MCP:workflow_prepare$/i.test(String(input.tool_name ?? ""));
  if (!prepareCall) return {};
  const call = toolInput(input);
  if (event === "preToolUse") {
    if (!humanActions.has(call.action)) {
      return Object.prototype.hasOwnProperty.call(call, "human_decision_receipt")
        ? deny("[automation-caller-receipt] Human decision receipts are host-injected and may not be supplied by the caller.")
        : {};
    }
    if (Object.prototype.hasOwnProperty.call(call, "human_decision_receipt")) return deny("[automation-caller-receipt] Remove the caller-supplied receipt and repeat the exact /auto-work decision prompt.");
    if (!location || !existsSync(location.path)) return deny("[automation-selection-unavailable] Submit the exact /auto-work decision with run-id@revision before this action.");
    const selection = readSelection(location.path);
    if (!selection || selection.action !== call.action || selection.run_id !== call.run_id || selection.revision !== call.expected_revision) return deny("[automation-selection-mismatch] The Workflow call differs from the exact human-selected Run action or revision.");
    const current = options.now ? options.now() : new Date();
    if (Date.parse(selection.expires_at) <= Date.parse((current instanceof Date ? current : new Date(current)).toISOString())) return deny("[automation-selection-expired] Repeat the exact /auto-work decision prompt.");
    if (selection.transport_retry) {
      if (selection.transport_retry.tool_input_hash !== toolInputHash(call)) return deny("[automation-selection-mismatch] The transport retry differs from the exact protected Workflow call.");
      const inflight = { ...selection.transport_retry, tool_use_id: input.tool_use_id ?? null, transport_retry: true };
      writeSelection(location.path, { ...selection, inflight });
      return { updated_input: { ...call, human_decision_receipt: inflight.receipt } };
    }
    let context;
    try { context = nativeAutomationDecisionContext(location.stateRoot, selection.run_id); }
    catch { return deny("[automation-run-unavailable] The selected Workflow Run is unavailable."); }
    if (!sameContext(selection, context) || !exactDecisionState(selection.action, context)) return deny("[automation-run-drift] The Run revision or artifact tips changed; inspect status and make a fresh decision.");
    if (selection.inflight) return deny("[automation-decision-busy] This human decision already has an in-flight Workflow call.");
    try {
      const adapter = createHostDecisionReceiptAdapter({ stateRoot: location.stateRoot, ...(options.now ? { now: options.now } : {}) });
      const decisionContext = { run_id: context.run_id, revision: context.revision, evidence_hash: context.evidence_hash, review_hash: context.review_hash };
      const protectedDecision = adapter.issue({ decision: selection.action, context: decisionContext });
      writeSelection(location.path, { ...selection, transport_retry: null, inflight: { tool_use_id: input.tool_use_id ?? null, receipt: protectedDecision.receipt, receipt_hash: protectedDecision.receipt_hash, context: decisionContext, tool_input_hash: toolInputHash(call) } });
      return { updated_input: { ...call, human_decision_receipt: protectedDecision.receipt } };
    } catch { return deny("[automation-decision-unavailable] The host could not protect this human decision; ordinary Cursor use remains available."); }
  }

  const selection = location ? readSelection(location.path) : null;
  if (!selection?.inflight || selection.inflight.tool_use_id !== (input.tool_use_id ?? null)) return {};
  if (event === "postToolUse") {
    try { rmSync(location.path, { force: true }); } catch { /* completed MCP result remains authoritative */ }
  } else if (event === "postToolUseFailure" && provenTransportFailure(input)) {
    const adapter = createHostDecisionReceiptAdapter({ stateRoot: location.stateRoot, ...(options.now ? { now: options.now } : {}) });
    try {
      adapter.revoke({
        receipt: selection.inflight.receipt,
        decision: selection.action,
        context: selection.inflight.context,
      });
      writeSelection(location.path, { ...selection, inflight: null, transport_retry: null });
    } catch {
      try {
        const verified = adapter.verify({ receipt: selection.inflight.receipt, decision: selection.action, context: selection.inflight.context });
        if (verified.consumed_by) writeSelection(location.path, { ...selection, inflight: null, transport_retry: selection.inflight });
      } catch { /* a fresh exact human prompt is required */ }
    }
  } else if (event === "postToolUseFailure") {
    try { rmSync(location.path, { force: true }); } catch { /* the receipt expires in host-owned state */ }
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

const direct = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (direct) {
  let output = {};
  try { output = evaluateAutomationGuard(await readInput(), { pluginRoot }); }
  catch (error) { process.stderr.write(`Workflow automation hook unavailable; ordinary host use remains available: ${error.message}\n`); }
  process.stdout.write(JSON.stringify(output));
}
