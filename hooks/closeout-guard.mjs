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
  statSync,
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
  parseReviewInputFromText,
  performNativeReview,
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

function chainDirectory(stateRoot, conversation) {
  return join(stateRoot, "manual-chains", conversation);
}

function chainPointerPath(stateRoot, conversation) {
  return join(chainDirectory(stateRoot, conversation), "current.json");
}

function chainPath(stateRoot, conversation, rootHash, revision = null) {
  const suffix = Number.isInteger(revision) && revision > 0 ? `.${revision}` : "";
  return join(chainDirectory(stateRoot, conversation), `${rootHash}${suffix}.json`);
}

function chainLockPath(stateRoot, conversation) {
  return join(chainDirectory(stateRoot, conversation), ".writer-lock");
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

function readChainAt(stateRoot, conversation) {
  const pointer = readJson(chainPointerPath(stateRoot, conversation));
  if (!/^[a-f0-9]{64}$/.test(String(pointer?.root_content_hash ?? ""))) return null;
  const revision = Number.isInteger(pointer.revision) && pointer.revision > 0 ? pointer.revision : null;
  const value = readJson(chainPath(stateRoot, conversation, pointer.root_content_hash, revision));
  if (value?.schema !== 1 || value?.kind !== "manual-chain") return null;
  if (value.root?.root_content_hash !== pointer.root_content_hash) return null;
  if (revision !== null && value.revision !== revision) return null;
  return value;
}

function writeChainAt(stateRoot, conversation, value) {
  const hash = value?.root?.root_content_hash;
  if (!/^[a-f0-9]{64}$/.test(String(hash ?? ""))) return false;
  const revision = Number.isInteger(value.revision) && value.revision > 0 ? value.revision + 1 : 1;
  const next = {
    schema: 1,
    kind: "manual-chain",
    ...value,
    revision,
    conversation_hash: conversation,
    updated_at: new Date().toISOString(),
  };
  // A revision-specific immutable record keeps the old pointer readable until
  // the final atomic rename publishes the complete next chain.
  writeJson(chainPath(stateRoot, conversation, hash, revision), next);
  writeJson(chainPointerPath(stateRoot, conversation), {
    schema: 1,
    kind: "manual-chain-pointer",
    root_plan_id: next.root?.root_plan_id ?? null,
    root_content_hash: hash,
    revision,
    updated_at: next.updated_at,
  });
  return true;
}

function withChainLock(stateRoot, conversation, callback) {
  const lock = chainLockPath(stateRoot, conversation);
  ensureDirectory(dirname(lock));
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(lock, { mode: 0o700 });
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 30_000) {
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") throw statError;
        continue;
      }
      if (Date.now() - started >= 2_000) throw new Error("manual chain writer lock timed out");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return callback();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function readManualChain(input, options = {}) {
  const conversation = conversationHash(input);
  if (!conversation) return null;
  for (const root of stateRoots(input, options)) {
    const value = readChainAt(root, conversation);
    if (value) return value;
  }
  return null;
}

export function updateManualChain(input, patch, options = {}) {
  const conversation = conversationHash(input);
  if (!conversation || !patch || typeof patch !== "object" || Array.isArray(patch)) return false;
  let updated = false;
  for (const root of stateRoots(input, options)) {
    const wrote = withChainLock(root, conversation, () => {
      const current = readChainAt(root, conversation);
      return current ? writeChainAt(root, conversation, { ...current, ...patch }) : false;
    });
    updated ||= wrote;
  }
  return updated;
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

function hostEnforcedReadOnlyReviewAgentRole(input) {
  if (!/^(?:Task|Agent|spawn_agent)$/i.test(String(input.tool_name ?? ""))) return false;
  const source = toolInputObject(input);
  const prompt = String(source.prompt ?? source.task ?? "");
  const agent = String(source.subagent_type ?? source.agent_type ?? "");
  return source.readonly === true
    && prompt.includes(READONLY_REVIEW_MARKER)
    && READONLY_REVIEW_AGENTS.has(agent)
    ? agent
    : null;
}

function isHostEnforcedReadOnlyReviewAgent(input) {
  return Boolean(hostEnforcedReadOnlyReviewAgentRole(input));
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

function chainArtifactEntries(chain) {
  const entries = Array.isArray(chain?.artifacts) ? [...chain.artifacts] : [];
  if (chain?.current_evidence?.delivery_evidence_artifact) entries.push({
    label: chain.current_evidence.delivery_evidence_id,
    text: chain.current_evidence.delivery_evidence_artifact,
  });
  if (chain?.current_review?.review_artifact) entries.push({
    label: chain.current_review.review_artifact_id,
    text: chain.current_review.review_artifact,
    ...(chain.current_review.builder_provenance ? { builder_provenance: chain.current_review.builder_provenance } : {}),
  });
  const byLabel = new Map();
  for (const entry of entries) {
    if (!entry?.label || !entry?.text) continue;
    const prior = byLabel.get(entry.label);
    if (!prior || prior.text === entry.text) byLabel.set(entry.label, { ...prior, ...entry });
  }
  return [...byLabel.values()];
}

function withChainArtifact(chain, entry) {
  return chainArtifactEntries({ ...chain, artifacts: [...chainArtifactEntries(chain), entry] });
}

function reviewInputFailure(reason) {
  return `Review input could not be read: ${reason}. The exact Root, Evidence, and repository work are preserved. Correct the named workflow-review-input field and repeat Review in this same task; no new task or chat is required.`;
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
  lineage = null,
} = {}, options = {}) {
  const conversation = conversationHash(input);
  if (!conversation || typeof rootPlanId !== "string" || !/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(rootPlanId)) return false;
  const hash = typeof providedHash === "string" && /^[a-f0-9]{64}$/.test(providedHash)
    ? providedHash
    : (typeof rootPlanText === "string" ? rootContentHash(rootPlanText) : null);
  if (!hash) return false;
  for (const root of stateRoots(input, options)) {
    withChainLock(root, conversation, () => {
      const existing = readChainAt(root, conversation);
      const sameRoot = existing?.root?.root_plan_id === rootPlanId
        && existing.root.root_content_hash === hash;
      writeChainAt(root, conversation, {
        ...(sameRoot ? existing : {}),
        root: {
          root_plan_id: rootPlanId,
          root_content_hash: hash,
          ...(typeof rootPlanText === "string"
            ? { root_plan_text: rootPlanText }
            : (sameRoot && typeof existing.root.root_plan_text === "string" ? { root_plan_text: existing.root.root_plan_text } : {})),
        },
        ...(Array.isArray(lineage) ? { lineage } : {}),
        ...(typeof phase === "string" ? { phase } : {}),
        phase_status: typeof phase === "string" ? "active" : (existing?.phase_status ?? "inactive"),
        recorded_at: sameRoot ? existing.recorded_at : new Date().toISOString(),
      });
      writeJson(activeRootPath(root, conversation), {
        root_plan_id: rootPlanId,
        root_content_hash: hash,
        ...(typeof rootPlanText === "string" ? { root_plan_text: rootPlanText } : {}),
        ...(typeof phase === "string" ? { phase } : {}),
        recorded_at: new Date().toISOString(),
        conversation_hash: conversation,
      });
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
    const chain = readChainAt(root, conversation);
    if (chain?.root?.root_plan_id) {
      return {
        ...chain.root,
        phase: chain.phase ?? null,
        phase_status: chain.phase_status ?? null,
        _chain: chain,
      };
    }
  }
  for (const root of stateRoots(input, options)) {
    const path = activeRootPath(root, conversation);
    if (!existsSync(path)) continue;
    const value = readJson(path);
    if (value?.root_plan_id) {
      const exact = typeof value.root_plan_text === "string"
        && value.root_content_hash === rootContentHash(value.root_plan_text);
      if (exact) {
        recordActiveRootPlan(input, {
          rootPlanId: value.root_plan_id,
          rootContentHash: value.root_content_hash,
          rootPlanText: value.root_plan_text,
          phase: value.phase ?? null,
        }, options);
        return readActiveRootPlan(input, options);
      }
      return value;
    }
  }
  return null;
}

export function clearActiveRootPlan(input, options = {}) {
  const conversation = conversationHash(input);
  if (!conversation) return false;
  let cleared = false;
  for (const root of stateRoots(input, options)) {
    withChainLock(root, conversation, () => {
      const pointer = chainPointerPath(root, conversation);
      if (existsSync(pointer)) {
        rmSync(pointer, { force: true });
        cleared = true;
      }
      const path = activeRootPath(root, conversation);
      if (existsSync(path)) {
        rmSync(path, { force: true });
        cleared = true;
      }
    });
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

function pendingContinuation(input, options = {}) {
  const chain = readManualChain(input, options);
  const pending = chain?.pending_continuation;
  if (!pending || !["issued", "consumed"].includes(pending.status)) return null;
  if (pending.root_content_hash !== chain.root?.root_content_hash) return null;
  if (!/^[a-f0-9]{64}$/.test(String(pending.prompt_hash ?? ""))) return null;
  if (!/^[a-f0-9]{32}$/.test(String(pending.source_generation_hash ?? ""))) return null;
  if (!["implementation", "correction", "review"].includes(pending.phase)) return null;
  return pending;
}

function hydratePendingContinuation(input, options = {}) {
  const pending = pendingContinuation(input, options);
  if (!pending || pending.status !== "issued") return false;
  const prompt = String(input.prompt ?? input.command ?? "");
  const generation = generationHash(input);
  if (generation === pending.source_generation_hash || rootContentHash(prompt) !== pending.prompt_hash) return false;
  const active = readActiveRootPlan(input, options);
  if (!active?.root_plan_id || active.root_content_hash !== pending.root_content_hash) return false;
  writeTurn(input, {
    required: true,
    phase: pending.phase,
    recovery_issued: true,
    continuation_kind: pending.kind,
    continuation_source_generation_hash: pending.source_generation_hash,
    active_root_plan_id: active.root_plan_id,
    active_root_content_hash: active.root_content_hash,
  }, options);
  updateManualChain(input, {
    pending_continuation: {
      ...pending,
      status: "consumed",
      consumed_generation_hash: generation,
      consumed_at: new Date().toISOString(),
    },
  }, options);
  return true;
}

function supersedePendingContinuation(input, phase, options = {}) {
  const pending = pendingContinuation(input, options);
  if (!pending) return;
  updateManualChain(input, {
    pending_continuation: null,
    ...(phase ? {} : {
      phase_status: "terminal-blocked",
      terminal_diagnostic: {
        code: "closeout-recovery-superseded",
        reason: "The single generated closeout continuation was superseded by a genuine human prompt.",
        recorded_at: new Date().toISOString(),
      },
    }),
  }, options);
}

function invalidateTurn(input, options = {}) {
  const turn = readTurn(input, options);
  if (turn) {
    writeTurn(input, {
      ...turn,
      closeout_recorded: false,
      delivery_report_ok: false,
      invalidated: true,
      invalidate_reason: "mutating-tool-after-closeout",
    }, options);
  }
  const chain = readManualChain(input, options);
  if (chain?.current_evidence) {
    updateManualChain(input, {
      current_evidence: { ...chain.current_evidence, invalidated: true, invalidate_reason: "mutating-tool-after-closeout" },
    }, options);
  }
}

function findRecordedCloseout(input, options = {}) {
  const chain = readManualChain(input, options);
  if (chain?.current_evidence?.closeout_recorded === true && chain.current_evidence.invalidated !== true) {
    return chain.current_evidence;
  }
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
  const chain = readManualChain(input, options);
  const turn = readTurn(input, options);
  if (turn?.required === true || turn?.closeout_recorded === true || chain?.phase_status === "active") {
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

function inspectExactCorrectionReview(chain, active, options = {}) {
  const currentEvidence = chain?.current_evidence;
  const currentReview = chain?.current_review;
  if (!currentEvidence || typeof currentEvidence.delivery_evidence_artifact !== "string") {
    return { ok: false, reason: "no exact current Evidence tip is committed" };
  }
  if (currentEvidence.invalidated === true) {
    return { ok: false, reason: "the current Evidence tip was invalidated by later lifecycle mutation" };
  }
  const inspect = options.inspectArtifactText ?? inspectArtifactText;
  const evidence = inspect(currentEvidence.delivery_evidence_artifact, options.pluginRoot ?? pluginRoot);
  const evidenceFields = evidence.artifact?.fields;
  if (evidence.errors.length > 0
    || evidenceFields?.artifact !== "delivery-evidence"
    || evidenceFields?.schema !== 5
    || evidenceFields.id !== currentEvidence.delivery_evidence_id
    || evidenceFields.root_plan_id !== active?.root_plan_id) {
    return { ok: false, reason: evidence.errors[0] ?? "the current Evidence tip does not match the active Root" };
  }
  if (currentEvidence.delivery_evidence_hash !== rootContentHash(currentEvidence.delivery_evidence_artifact)) {
    return { ok: false, reason: "current Evidence bytes do not match their recorded hash" };
  }
  if (!currentReview || typeof currentReview.review_artifact !== "string") {
    return { ok: false, reason: "no exact current Review tip authorizes correction" };
  }
  const review = inspect(currentReview.review_artifact, options.pluginRoot ?? pluginRoot);
  const reviewFields = review.artifact?.fields;
  const correction = review.artifact?.correction;
  if (review.errors.length > 0
    || reviewFields?.artifact !== "work-review"
    || reviewFields?.schema !== 5
    || reviewFields.id !== currentReview.review_artifact_id
    || reviewFields.root_plan_id !== active?.root_plan_id
    || reviewFields.latest_evidence_id !== currentEvidence.delivery_evidence_id
    || reviewFields.next_action !== "correct"
    || !correction?.id
    || correction.id !== reviewFields.correction_id
    || correction.id !== currentReview.correction_id) {
    return { ok: false, reason: review.errors[0] ?? "the current Review is not one exact correction authority for this Root and Evidence tip" };
  }
  if (currentReview.review_artifact_hash !== rootContentHash(currentReview.review_artifact)) {
    return { ok: false, reason: "current Review bytes do not match their recorded hash" };
  }
  return { ok: true, evidence: evidenceFields, review: reviewFields, correction };
}

function currentLifecycleMutationPhase(input, options = {}) {
  const turn = readTurn(input, options) ?? {};
  const chain = readManualChain(input, options);
  if (turn.terminalized === true) return null;
  if (["implementation", "correction"].includes(turn.phase) && turn.required === true) return turn.phase;
  if (turn.phase === "review" && ["active", "review-evidence-ready", "evidence-invalidated", "root-boundary-required", "closeout-failed"].includes(chain?.phase_status)) {
    return "review";
  }
  return null;
}

function captureBaselineBeforeMutation(input, options = {}) {
  if (!isMutatingTool(input) || isWorkflowCloseoutTool(input.tool_name)) return { ok: true };
  const active = readActiveRootPlan(input, options);
  const chain = readManualChain(input, options);
  const turn = readTurn(input, options) ?? {};
  const phase = currentLifecycleMutationPhase(input, options);
  if (!active?.root_plan_id || !["implementation", "correction"].includes(phase)) return { ok: false, reason: "This mutation is not bound to an approved implementation or correction phase." };
  if (chain?.repository_baseline) return { ok: true };
  if (chain?.repository_baseline_error) return { ok: false, reason: chain.repository_baseline_error };
  try {
    const capture = options.captureRepositorySnapshot ?? captureRepositorySnapshot;
    const repositoryBaseline = capture(workspaceRootForInput(input, options));
    updateManualChain(input, {
      repository_baseline: repositoryBaseline,
      repository_baseline_error: null,
    }, options);
    writeTurn(input, {
      ...turn,
      required: true,
      phase,
      repository_baseline: repositoryBaseline,
      repository_baseline_error: null,
    }, options);
    return { ok: true };
  } catch (error) {
    const reason = String(error?.message ?? error);
    updateManualChain(input, { repository_baseline_error: reason }, options);
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
  const phase = currentLifecycleMutationPhase(input, options);
  if (!phase) return {};
  if (phase === "review") {
    if (isHostEnforcedReadOnlyReviewAgent(input)) return {};
    return deny(manualJourneyDecision({
      state: "blocked",
      blocker: "Review is repository-read-only; repository writes require a separately approved correction.",
      action: "retry-review",
      trace: { root_plan_id: readActiveRootPlan(input, options)?.root_plan_id ?? null },
    }));
  }
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
      toolResponse: input.hook_event_name === "postToolUseFailure"
        ? {
          status: "failed",
          failure_type: input.failure_type ?? "error",
          error_message: input.error_message ?? "Tool execution failed.",
        }
        : parseToolOutput(input),
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

function bindFailedCheckToCurrentEvidence(input, completed, options = {}) {
  const receipt = completed?.receipt;
  if (!receipt?.check_id || receipt.result_status !== "failed") return;
  const failure = {
    check_id: receipt.check_id,
    receipt_hash: completed.receipt_hash ?? null,
    root_content_hash: receipt.root_hash,
    observed_at: new Date().toISOString(),
  };
  const turn = readTurn(input, options) ?? {};
  writeTurn(input, {
    ...turn,
    required: true,
    closeout_recorded: false,
    delivery_report_ok: false,
    invalidated: true,
    invalidate_reason: "required-check-failed-after-evidence",
    known_failed_check: failure,
  }, options);
  const chain = readManualChain(input, options);
  const currentEvidence = chain?.current_evidence;
  updateManualChain(input, {
    ...(currentEvidence ? {
      current_evidence: {
        ...currentEvidence,
        invalidated: true,
        invalidate_reason: "required-check-failed-after-evidence",
      },
    } : {}),
    known_failed_check: failure,
    phase_status: "evidence-invalidated",
  }, options);
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
  if (hydratePendingContinuation(input, options)) return {};
  const phase = REVIEW_MARKER.test(prompt)
    ? "review"
    : /\/correct-work\b/.test(prompt)
      ? "correction"
      : IMPLEMENTATION_MARKER.test(prompt)
        ? "implementation"
        : null;
  supersedePendingContinuation(input, phase, options);
  if (!phase) return {};
  const requiresBoundRoot = phase === "correction" || (phase === "implementation" && IMPLEMENT_PLAN_MARKER.test(prompt));
  const selectedRootId = prompt.match(ROOT_ID)?.[0] ?? null;
  const rootText = extractRootPlanText(prompt);
  if (!rootText) {
    const active = readActiveRootPlan(input, options);
    if (active?.root_plan_id) {
      const bound = inspectBoundActiveRoot(active, options);
      const chain = readManualChain(input, options);
      if (requiresBoundRoot && !bound.ok) return deny(`Workflow · Plan required. ${bound.reason} Next: present and approve one valid Schema-5 Root.`);
      if (requiresBoundRoot && selectedRootId && selectedRootId !== active.root_plan_id) {
        return deny(`Workflow · Blocked. The approved selector ${selectedRootId} does not match the task-bound Root ${active.root_plan_id}. Next: approve the exact current Root only.`);
      }
      if (phase === "implementation"
        && chain?.phase_status === "review-complete"
        && chain?.current_review?.next_action === "replan") {
        return deny("Workflow · Blocked. The current Review requires replan, so the predecessor Root is recovery context rather than implementation authority. Next: complete /plan-work replan, or explicitly re-approve the exact predecessor Root bytes.");
      }
      if (phase === "correction") {
        const correction = inspectExactCorrectionReview(chain, active, options);
        if (!correction.ok) {
          return deny(`Workflow · Blocked. Correct-work requires the exact current Review tip, its Evidence tip, the bound Root, and one embedded correction: ${correction.reason}. Next: run Review or restore its exact current chain.`);
        }
      }
      recordActiveRootPlan(input, {
        rootPlanId: active.root_plan_id,
        rootContentHash: active.root_content_hash,
        rootPlanText: active.root_plan_text,
        phase,
      }, options);
      writeTurn(input, { required: phase !== "review", phase, observed_review_auditors: [] }, options);
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
  const chain = readManualChain(input, options);
  if (requiresBoundRoot && active?.root_plan_id && active.root_plan_id !== rootPlanId) {
    return deny(`Workflow · Blocked. The supplied Root ${rootPlanId} does not match the task-bound Root ${active.root_plan_id}. Next: return to the exact approved Plan or correction.`);
  }
  if (phase === "correction") {
    const correction = inspectExactCorrectionReview(chain, { ...active, root_plan_id: rootPlanId, root_plan_text: rootText }, options);
    if (!correction.ok) {
      return deny(`Workflow · Blocked. Correct-work requires the exact current Review tip, its Evidence tip, the bound Root, and one embedded correction: ${correction.reason}. Next: run Review or restore its exact current chain.`);
    }
  }
  recordActiveRootPlan(input, { rootPlanId, rootPlanText: rootText, phase }, options);
  writeTurn(input, { required: phase !== "review", phase, observed_review_auditors: [] }, options);
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

function reviewInputFailureFollowUp(reason) {
  return { followup_message: String(reason ?? reviewInputFailure("the semantic input is unavailable")) };
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
  return {
    followup_message: [
      "Workflow closeout attestation is incomplete.",
      "This is a Cursor recovery follow-up, not an unbypassable hard stop.",
      "workflow_closeout already returned Evidence.",
      "The current conversation already retains the exact Evidence; do not dump the artifact. Include this delivery-report:",
      formatDeliveryReportFence(expectedId),
    ].join(" "),
  };
}

function failedCheckFollowUp(failure) {
  return {
    followup_message: [
      `Workflow required Check ${failure?.check_id ?? "CHECK-*"} failed after the current Evidence was recorded.`,
      "The previous Evidence is invalidated.",
      "Do not rerun or disguise the failed Check; return one typed closeout-input preserving the failed observation so the host can persist honest replacement Evidence for Review.",
    ].join(" "),
  };
}

function armRecoveryContinuation(input, turn, active, followUp, kind, options = {}) {
  const message = String(followUp?.followup_message ?? "");
  writeTurn(input, { ...turn, recovery_issued: true }, options);
  updateManualChain(input, {
    pending_continuation: {
      schema: 1,
      kind,
      status: "issued",
      phase: turn?.phase,
      prompt_hash: rootContentHash(message),
      root_content_hash: active?.root_content_hash,
      source_generation_hash: generationHash(input),
      continuation_count: 1,
      issued_at: new Date().toISOString(),
    },
  }, options);
  return followUp;
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

  if (event === "postToolUseFailure") {
    const completedReceipt = recordCompletedCheckReceipt(input, options);
    if (completedReceipt?.status === "failed") bindFailedCheckToCurrentEvidence(input, completedReceipt, options);
    return {};
  }

  if (event === "postToolUse" || event === "afterMCPExecution") {
    const toolName = input.tool_name;
    const observedAuditor = hostEnforcedReadOnlyReviewAgentRole(input);
    if (observedAuditor) {
      const turn = readTurn(input, options) ?? {};
      if (turn.phase === "review") {
        writeTurn(input, {
          ...turn,
          observed_review_auditors: [...new Set([...(turn.observed_review_auditors ?? []), observedAuditor])].sort(),
        }, options);
      }
      return {};
    }
    const completedReceipt = recordCompletedCheckReceipt(input, options);
    if (completedReceipt?.status === "failed") {
      bindFailedCheckToCurrentEvidence(input, completedReceipt, options);
      return {};
    }
    if (["recorded", "missing-result"].includes(completedReceipt?.status)) return {};
    if (isMutatingTool(input) && !isWorkflowCloseoutTool(toolName)) {
      if (!currentLifecycleMutationPhase(input, options)) return {};
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
    const structured = response?.structuredContent ?? response;
    if (toolInput.artifact_kind === "work-review" || structured?.artifact_kind === "work-review") {
      const lifecycleTurn = readTurn(input, options) ?? {};
      const lifecycleChain = readManualChain(input, options);
      try {
        if (structured?.artifact_kind !== "work-review" || typeof structured.artifact !== "string") throw new Error("host response omitted the exact generated work-review");
        const inspected = (options.inspectArtifactText ?? inspectArtifactText)(structured.artifact, options.pluginRoot ?? pluginRoot);
        const fields = inspected.artifact?.fields;
        if (inspected.errors.length > 0 || fields?.artifact !== "work-review" || fields?.schema !== 5) throw new Error(inspected.errors[0] ?? "host response is not a Schema-5 work-review");
        if (fields.id !== structured.work_review_id || fields.root_plan_id !== activeRootPlanId) throw new Error("host response review identity does not match the active Root");
        const artifactHash = rootContentHash(structured.artifact);
        if (structured.artifact_hash !== artifactHash || !/^[a-f0-9]{64}$/.test(String(structured.review_input_hash ?? ""))) throw new Error("host response review hashes are invalid");
        const builderProvenance = {
          schema: 1,
          kind: "host-work-review-builder",
          review_input_hash: structured.review_input_hash,
          artifact_hash: artifactHash,
        };
        writeTurn(input, {
          ...lifecycleTurn,
          required: false,
          phase: "review",
          review_artifact_id: fields.id,
          review_artifact_error: null,
          review_builder_provenance: builderProvenance,
          recovery_issued: false,
        }, options);
        updateManualChain(input, {
          current_review: {
            review_artifact_id: fields.id,
            review_artifact: structured.artifact,
            review_artifact_hash: artifactHash,
            builder_provenance: builderProvenance,
            latest_evidence_id: fields.latest_evidence_id ?? null,
            next_action: fields.next_action ?? null,
            correction_id: fields.correction_id ?? null,
            recorded_at: new Date().toISOString(),
          },
          artifacts: withChainArtifact(lifecycleChain, { label: fields.id, text: structured.artifact, builder_provenance: builderProvenance }),
          phase_status: "review-complete",
          terminal_diagnostic: null,
          pending_continuation: null,
        }, options);
      } catch (error) {
        const reason = reviewInputFailure(String(error?.message ?? error));
        writeTurn(input, { ...lifecycleTurn, required: true, phase: "review", review_artifact_error: reason }, options);
      }
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
    const lifecycleTurn = readTurn(input, options) ?? {};
    const lifecycleChain = readManualChain(input, options);
    const lifecyclePhase = lifecycleTurn.phase ?? lifecycleChain?.phase ?? "implementation";
    writeTurn(input, {
      ...lifecycleTurn,
      phase: lifecyclePhase,
      closeout_recorded: true,
      delivery_report_ok: lifecyclePhase !== "review",
      required: true,
      delivery_evidence_id: recorded.record.id,
      delivery_evidence_artifact: recorded.record.artifact,
      delivery_evidence_hash: recorded.record.hash,
      handoff_persisted: recorded.record.handoff_persisted,
      delivery_evidence_root_plan_id: recorded.record.root_plan_id,
      active_root_plan_id: activeRootPlanId,
      active_root_content_hash: activeRootContentHash,
      expected_lineage: expectedLineage,
      enforcement: "cursor-internal-closeout",
      review_recovery_pending: lifecyclePhase === "review",
      recovery_issued: false,
    }, options);
    updateManualChain(input, {
      current_evidence: {
        closeout_recorded: true,
        delivery_report_ok: true,
        delivery_evidence_id: recorded.record.id,
        delivery_evidence_artifact: recorded.record.artifact,
        delivery_evidence_hash: recorded.record.hash,
        handoff_persisted: recorded.record.handoff_persisted,
        delivery_evidence_root_plan_id: recorded.record.root_plan_id,
        active_root_plan_id: activeRootPlanId,
        active_root_content_hash: activeRootContentHash,
        expected_lineage: expectedLineage,
        invalidated: false,
        recorded_at: new Date().toISOString(),
      },
      artifacts: withChainArtifact(lifecycleChain, { label: recorded.record.id, text: recorded.record.artifact }),
      known_failed_check: null,
      pending_continuation: lifecyclePhase === "review" ? lifecycleChain?.pending_continuation ?? null : null,
      phase_status: lifecyclePhase === "review" ? "review-evidence-ready" : "closeout-complete",
    }, options);
    return {};
  }

  if (event === "afterAgentResponse") {
    const turn = readTurn(input, options) ?? {};
    const text = typeof input.text === "string" ? input.text : "";
    const active = readActiveRootPlan(input, options);
    const chain = readManualChain(input, options);
    const phase = turn.phase ?? chain?.phase ?? active?.phase ?? null;
    const workflowBound = Boolean(
      active?.root_plan_id
      && turn.terminalized !== true
      && (
        (["implementation", "correction"].includes(turn.phase) && turn.required === true)
        || (turn.phase === "review" && ["active", "review-evidence-ready", "evidence-invalidated", "root-boundary-required", "closeout-failed"].includes(chain?.phase_status))
      ),
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
        const repositoryDelta = derive(chain?.repository_baseline ?? turn.repository_baseline ?? null, current);
        const chainArtifacts = [
          chain?.current_evidence?.invalidated !== true && chain?.current_evidence?.delivery_evidence_artifact
            ? { label: chain.current_evidence.delivery_evidence_id, text: chain.current_evidence.delivery_evidence_artifact }
            : null,
          chain?.current_review?.review_artifact
            ? { label: chain.current_review.review_artifact_id, text: chain.current_review.review_artifact }
            : null,
        ].filter(Boolean);
        const closeout = (options.performNativeCloseout ?? performNativeCloseout)({
          attestation: native.report,
          expectedPhase,
          rootPlanText: active.root_plan_text,
          artifacts: options.artifacts ?? chainArtifacts,
          repositoryDelta,
          pluginRoot: options.pluginRoot ?? pluginRoot,
          handoffOptions: options.handoffOptions ?? {},
          receiptOptions: options.receiptOptions ?? {},
          ...(chain?.current_evidence?.invalidated === true ? {
            invalidatedEvidence: {
              id: chain.current_evidence.delivery_evidence_id,
              hash: chain.current_evidence.delivery_evidence_hash,
            },
          } : {}),
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
        updateManualChain(input, {
          current_evidence: {
            closeout_recorded: true,
            delivery_report_ok: true,
            delivery_evidence_id: closeout.fields.id,
            delivery_evidence_artifact: closeout.artifact,
            delivery_evidence_hash: closeout.artifact_hash,
            handoff_persisted: closeout.handoff_persisted,
            delivery_evidence_root_plan_id: closeout.fields.root_plan_id,
            active_root_plan_id: active.root_plan_id,
            active_root_content_hash: active.root_content_hash,
            invalidated: false,
            recorded_at: new Date().toISOString(),
          },
          artifacts: withChainArtifact(chain, { label: closeout.fields.id, text: closeout.artifact }),
          known_failed_check: null,
          pending_continuation: phase === "review" ? chain?.pending_continuation ?? null : null,
          phase_status: phase === "review" ? "review-evidence-ready" : "closeout-complete",
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
        updateManualChain(input, {
          terminal_diagnostic: {
            code: errorCode,
            reason: String(error?.message ?? error),
            recorded_at: new Date().toISOString(),
          },
          phase_status: boundary ? "root-boundary-required" : "closeout-failed",
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
        writeTurn(input, { ...turn, required: true, review_artifact_error: reviewInputFailure("a full model-authored work-review envelope was returned instead of semantic input"), final_text: text.slice(0, 200_000) }, options);
        return {};
      }
      try {
        if (!active?.root_plan_id || typeof active.root_plan_text !== "string") throw new Error("the exact task-local Root is unavailable");
        if (chain?.current_evidence?.invalidated === true && !turn.boundary_receipt) throw new Error("the current Evidence was invalidated and no protected boundary receipt is available");
        const boundaryReceipt = turn.boundary_receipt ?? null;
        const parsed = boundaryReceipt ? { ok: true, input: null, issues: [] } : parseReviewInputFromText(text);
        if (!parsed.ok) throw new Error(parsed.issues.join("; "));
        const boundaryVerifier = boundaryReceipt ? ({ receipt, rootPlanText }) => {
          if (receipt?.receipt_id !== boundaryReceipt.receipt_id) return { ok: false, reason: "no matching task-bound protected host receipt" };
          return (options.verifyManualBoundaryReceipt ?? verifyManualBoundaryReceipt)({
            receipt,
            rootPlanText,
            pluginRoot: options.pluginRoot ?? pluginRoot,
            workspaceRoot: turn.boundary_receipt_workspace_root,
            captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
            now: options.now,
            options: options.receiptOptions ?? {},
          });
        } : null;
        const review = (options.performNativeReview ?? performNativeReview)({
          rootPlanText: active.root_plan_text,
          artifacts: options.artifacts ?? chainArtifactEntries(chain),
          reviewInput: parsed.input,
          boundaryReceipt,
          boundaryReceiptVerifier: boundaryVerifier,
          hostObservedAuditorRoles: turn.observed_review_auditors ?? [],
          pluginRoot: options.pluginRoot ?? pluginRoot,
          handoffOptions: options.handoffOptions ?? {},
        });
        const fields = review.fields;
        writeTurn(input, {
          ...turn,
          required: false,
          closeout_recorded: false,
          delivery_report_ok: true,
          review_recovery_pending: false,
          recovery_issued: false,
          review_artifact_id: fields.id,
          review_artifact_error: null,
          review_builder_provenance: review.provenance,
          native_closeout_error: null,
          native_closeout_error_code: null,
          boundary_receipt: null,
          final_text: text.slice(0, 200_000),
        }, options);
        updateManualChain(input, {
          current_review: {
            review_artifact_id: fields.id,
            review_artifact: review.artifact,
            review_artifact_hash: review.artifact_hash,
            builder_provenance: review.provenance,
            latest_evidence_id: fields.latest_evidence_id ?? null,
            next_action: fields.next_action ?? null,
            correction_id: fields.correction_id ?? null,
            recorded_at: new Date().toISOString(),
          },
          artifacts: withChainArtifact(chain, { label: fields.id, text: review.artifact, builder_provenance: review.provenance }),
          phase_status: "review-complete",
          terminal_diagnostic: null,
          pending_continuation: null,
        }, options);
        return {};
      } catch (error) {
        writeTurn(input, { ...turn, required: true, review_artifact_error: reviewInputFailure(String(error?.message ?? error)), final_text: text.slice(0, 200_000) }, options);
        return {};
      }
    }
    if (!turn?.required) return {};
    const evidence = chain?.current_evidence?.invalidated !== true ? chain?.current_evidence : null;
    const containsDeliveryAttestation = /\bkind\s*:\s*delivery-report\b|```yaml workflow-attestation/i.test(text);
    const completion = evidence?.closeout_recorded === true && evidence.delivery_report_ok === true && !containsDeliveryAttestation
      ? { ok: true, reason: "internal-closeout-committed" }
      : evaluateDeliveryCompletion(text, turn);
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
    const chain = readManualChain(input, options);
    const pending = chain?.pending_continuation;
    const pendingForActive = Boolean(
      pending
      && ["issued", "consumed"].includes(pending.status)
      && pending.root_content_hash === active?.root_content_hash,
    );
    if (!active?.root_plan_id && turn?.record_reason === "missing-active-root") {
      return missingActiveRootFollowUp();
    }
    const required = Boolean(
      active?.root_plan_id
      && (turn?.required === true || turn?.closeout_recorded === true || pendingForActive),
    );
    if (!required) return {};

    const loopCount = Number.isInteger(input.loop_count) ? input.loop_count : Number(input.loop_count ?? 0);
    const differentContinuationGeneration = pendingForActive
      && generationHash(input) !== pending.source_generation_hash;
    if (turn?.recovery_issued === true || (pendingForActive && (loopCount > 0 || differentContinuationGeneration))) {
      writeTurn(input, { ...(turn ?? {}), required: false, recovery_issued: true, terminalized: true }, options);
      updateManualChain(input, {
        phase_status: "terminal-blocked",
        pending_continuation: null,
        terminal_diagnostic: {
          code: turn?.native_closeout_error_code ?? turn?.record_reason ?? "closeout-recovery-exhausted",
          reason: turn?.native_closeout_error ?? turn?.delivery_report_reason ?? "Manual closeout recovery exhausted its single continuation.",
          recorded_at: new Date().toISOString(),
        },
      }, options);
      return {};
    }

    const recoverOnce = (value, kind = "closeout-recovery") => armRecoveryContinuation(input, turn, active, value, kind, options);
    if (turn?.known_failed_check) return recoverOnce(failedCheckFollowUp(turn.known_failed_check), "required-check-failed");
    if (turn?.review_artifact_error) return recoverOnce(reviewInputFailureFollowUp(turn.review_artifact_error), "review-input-repair");
    if (turn?.review_recovery_pending) {
      const followUp = reviewRecoveryFollowUp(turn);
      return armRecoveryContinuation(input, turn, active, followUp, "review-evidence-hydrated", options);
    }
    if (turn?.boundary_receipt) {
      return recoverOnce(nativeCloseoutFailureFollowUp(`Evidence recovery is deterministically unavailable. Use only an insufficient-evidence/blocked/replan root-boundary review with this internal receipt: ${JSON.stringify(turn.boundary_receipt)}`));
    }
    if (turn?.native_closeout_error) return recoverOnce(nativeCloseoutFailureFollowUp(turn.native_closeout_error));
    if (turn?.closeout_recorded && turn.delivery_report_ok) return {};
    if (turn?.closeout_recorded) return recoverOnce(missingDeliveryReportFollowUp(turn));
    if (conversationHasRecordedCloseout(input, options)) {
      const recorded = findRecordedCloseout(input, options);
      return recoverOnce(missingDeliveryReportFollowUp(recorded));
    }
    return recoverOnce(missingCloseoutFollowUp());
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
