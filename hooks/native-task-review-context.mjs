import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  inspectArtifactSet,
  inspectArtifactText,
  preflightRootPlan,
} from "../scripts/validate-artifact.mjs";
import { hashWorkflowIdentifier } from "./model-inheritance-state.mjs";
import {
  consumeNativeReviewReceipt,
  nativeReviewReceiptDirectory,
  nativeReviewRequestHash,
} from "./native-review-receipt.mjs";

export { consumeNativeReviewReceipt, nativeReviewRequestHash } from "./native-review-receipt.mjs";

export const NATIVE_TASK_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NATIVE_REVIEW_RECEIPT_TTL_MS = 5 * 60 * 1000;

const MAX_TRANSCRIPT_BYTES = 32 * 1024 * 1024;
const MAX_CONTEXT_BYTES = 2 * 1024 * 1024;
const IMPLEMENT_PLAN_PROMPT = /Implement the plan as specified, it is attached for your reference\.\s*Do NOT edit the plan file itself\./i;
const WORK_REVIEW_TOOL = /^MCP:workflow_closeout$/i;
const sha256 = (value) => createHash("sha256").update(String(value), "utf8").digest("hex");

function timestamp(options = {}) {
  const value = options.now ? options.now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nowMs(options = {}) {
  return Date.parse(timestamp(options));
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  try { chmodSync(path, 0o700); } catch { /* best effort */ }
}

function atomicJson(path, value) {
  ensureDirectory(dirname(path));
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source) > MAX_CONTEXT_BYTES) throw new Error("native task Review context exceeds size limit");
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, source, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function contextRoot(stateRoot) {
  return join(stateRoot, "manual-native-task-review");
}

function conversationPath(stateRoot, conversationHash) {
  return join(contextRoot(stateRoot), "conversations", `${conversationHash}.json`);
}

function validConversation(value) {
  return value?.schema === 1
    && value?.kind === "cursor-native-task-review-context"
    && typeof value.conversation_hash === "string";
}

function readConversation(stateRoot, conversationHash) {
  const value = readJson(conversationPath(stateRoot, conversationHash));
  return validConversation(value) ? value : null;
}

function writeConversation(stateRoot, conversationHash, value, options = {}) {
  atomicJson(conversationPath(stateRoot, conversationHash), {
    schema: 1,
    kind: "cursor-native-task-review-context",
    conversation_hash: conversationHash,
    pending: null,
    active: null,
    artifacts: [],
    ...value,
    updated_at: timestamp(options),
  });
}

function planObservation(toolInput, pluginRoot) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput) || typeof toolInput.plan !== "string") return null;
  const inspected = inspectArtifactText(toolInput.plan, pluginRoot);
  const fields = inspected.artifact?.fields;
  if (inspected.errors.length > 0 || fields?.artifact !== "work-plan" || fields.schema !== 5 || fields.status !== "ready") return null;
  const preflight = preflightRootPlan(toolInput.plan, pluginRoot);
  if (!preflight.feasible) return null;
  const title = toolInput.plan.match(/(?:^|\n)#\s+([^\r\n]+)/)?.[1]?.trim() ?? toolInput.name?.trim() ?? null;
  return {
    root_plan_id: fields.id,
    root_hash: sha256(toolInput.plan),
    root_text: toolInput.plan,
    title,
  };
}

function implementPromptTitle(prompt) {
  const source = String(prompt ?? "");
  if (!IMPLEMENT_PLAN_PROMPT.test(source)) return null;
  const before = source.slice(0, source.search(IMPLEMENT_PLAN_PROMPT));
  const lines = before.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) ?? "";
}

function titleMatches(plan, title) {
  if (!title) return true;
  return [plan?.title, plan?.name].filter(Boolean).some((candidate) => candidate.trim() === title.trim());
}

export function observeNativeCreatePlan({ stateRoots, input, pluginRoot, options = {} }) {
  const conversationHash = hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
  const generationHash = hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id);
  const toolHash = hashWorkflowIdentifier("tool", input.tool_use_id ?? input.tool_call_id);
  const observed = planObservation(input.tool_input, pluginRoot);
  if (!conversationHash || !generationHash || !toolHash || !observed) return { status: "ignored" };
  const plan = {
    ...observed,
    name: typeof input.tool_input?.name === "string" ? input.tool_input.name.trim() : null,
    generation_hash: generationHash,
    tool_hash: toolHash,
    observed_at: timestamp(options),
  };
  for (const stateRoot of stateRoots) {
    const current = readConversation(stateRoot, conversationHash);
    writeConversation(stateRoot, conversationHash, {
      ...(current ?? {}),
      pending: plan,
      approval_error: null,
    }, options);
  }
  return { status: "observed", root_plan_id: plan.root_plan_id };
}

export function approveNativeImplementPlan({ stateRoots, input, options = {} }) {
  const title = implementPromptTitle(input.prompt ?? input.command ?? input.task);
  if (title === null) return { status: "ignored" };
  const conversationHash = hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
  const generationHash = hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id);
  if (!conversationHash || !generationHash) return { status: "unavailable" };
  let result = { status: "unapproved" };
  for (const stateRoot of stateRoots) {
    const current = readConversation(stateRoot, conversationHash);
    const pending = current?.pending;
    if (!pending) {
      if (current?.active && titleMatches(current.active, title)) {
        result = { status: "approved", root_plan_id: current.active.root_plan_id };
        continue;
      }
      writeConversation(stateRoot, conversationHash, {
        ...(current ?? {}),
        approval_error: "no-pending-native-plan",
      }, options);
      result = { status: "ambiguous" };
      continue;
    }
    if (!titleMatches(pending, title)) {
      writeConversation(stateRoot, conversationHash, {
        ...(current ?? {}),
        approval_error: "title-mismatch",
      }, options);
      result = { status: "ambiguous" };
      continue;
    }
    const active = {
      ...pending,
      approved_generation_hash: generationHash,
      approved_at: timestamp(options),
    };
    writeConversation(stateRoot, conversationHash, {
      ...(current ?? {}),
      pending: null,
      active,
      artifacts: current?.active?.root_hash === active.root_hash ? current.artifacts ?? [] : [],
      approval_error: null,
    }, options);
    result = { status: "approved", root_plan_id: active.root_plan_id };
  }
  return result;
}

function contentBlocks(value) {
  return Array.isArray(value?.message?.content) ? value.message.content : [];
}

function transcriptPrompt(value) {
  return contentBlocks(value).filter((entry) => entry?.type === "text").map((entry) => entry.text).join("\n");
}

function recoverTranscript(transcriptPath, conversationId, pluginRoot, options = {}) {
  if (typeof transcriptPath !== "string" || !transcriptPath.startsWith("/") || !existsSync(transcriptPath)) return { status: "unavailable" };
  if (conversationId && basename(transcriptPath, ".jsonl") !== conversationId) return { status: "mismatch" };
  try {
    if (statSync(transcriptPath).size > MAX_TRANSCRIPT_BYTES) return { status: "invalid" };
    let pending = null;
    let active = null;
    let ambiguous = false;
    for (const line of readFileSync(transcriptPath, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { return { status: "invalid" }; }
      for (const block of contentBlocks(entry)) {
        if (block?.type !== "tool_use" || block.name !== "CreatePlan") continue;
        const plan = planObservation(block.input, pluginRoot);
        if (plan) pending = { ...plan, name: block.input?.name ?? null };
      }
      if (entry.role !== "user") continue;
      const title = implementPromptTitle(transcriptPrompt(entry));
      if (title === null) continue;
      if (pending && titleMatches(pending, title)) {
        active = { ...pending, approved_at: timestamp(options), recovered_from: "cursor-transcript" };
        pending = null;
        ambiguous = false;
      } else if (pending || !active || !titleMatches(active, title)) {
        ambiguous = true;
      }
    }
    if (pending) return { status: "unapproved" };
    if (ambiguous) return { status: "ambiguous" };
    return active ? { status: "resolved", active } : { status: "unavailable" };
  } catch { return { status: "invalid" }; }
}

function validArtifacts(rootText, artifacts, pluginRoot) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return { status: "full-rebuild", artifacts: [] };
  for (const entry of artifacts) {
    const inspected = inspectArtifactText(entry?.text, pluginRoot);
    if (inspected.errors.length > 0) return { status: "invalid", errors: inspected.errors };
    if (inspected.artifact?.fields?.artifact === "work-review") {
      const provenance = entry.builder_provenance;
      if (provenance?.schema !== 1
        || provenance?.kind !== "host-work-review-builder"
        || !/^[a-f0-9]{64}$/.test(String(provenance.review_input_hash ?? ""))
        || provenance.artifact_hash !== sha256(entry.text)) {
        return { status: "invalid", errors: [`work-review ${entry.label ?? "unknown"} has invalid host builder provenance`] };
      }
    }
  }
  const pairs = [["root", rootText], ...artifacts.map((entry) => [entry.label, entry.text])];
  const inspected = inspectArtifactSet(pairs, pluginRoot);
  if (inspected.errors.length > 0) return { status: "invalid", errors: inspected.errors };
  return { status: "task-chain", artifacts };
}

function resolveActiveContext({ stateRoot, input, pluginRoot, options = {} }) {
  const conversationHash = hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
  if (!conversationHash) return { status: "unavailable" };
  const storedPath = conversationPath(stateRoot, conversationHash);
  let current = readConversation(stateRoot, conversationHash);
  if (!current && existsSync(storedPath)) return { status: "invalid" };
  if (!current?.active) {
    if (current) return { status: current.pending ? "unapproved" : "unavailable" };
    const recovered = recoverTranscript(input.transcript_path, input.conversation_id ?? input.session_id, pluginRoot, options);
    if (recovered.status !== "resolved") return recovered;
    current = {
      ...(current ?? {}),
      active: recovered.active,
      pending: null,
      artifacts: current?.artifacts ?? [],
      approval_error: null,
    };
    writeConversation(stateRoot, conversationHash, current, options);
  }
  if (current.pending) return { status: "unapproved" };
  const inspected = inspectArtifactText(current.active.root_text, pluginRoot);
  if (inspected.errors.length > 0
    || inspected.artifact?.fields?.id !== current.active.root_plan_id
    || sha256(current.active.root_text) !== current.active.root_hash) return { status: "invalid" };
  const chain = validArtifacts(current.active.root_text, current.artifacts ?? [], pluginRoot);
  if (chain.status === "invalid") return { status: "invalid", errors: chain.errors };
  return { status: "resolved", conversationHash, current, chain };
}

function receiptId(input) {
  const source = [
    input.conversation_id ?? input.session_id ?? input.transcript_path,
    input.generation_id ?? input.turn_id,
    input.tool_use_id ?? input.tool_call_id,
  ].filter(Boolean).join("\0");
  return sha256(source || randomUUID()).slice(0, 32);
}

export function prepareNativeReviewReceipt({ stateRoots, input, pluginRoot, options = {} }) {
  const toolInput = input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {};
  if (!WORK_REVIEW_TOOL.test(String(input.tool_name ?? "")) || (toolInput.artifact_kind ?? "delivery-evidence") !== "work-review") return { status: "ignored" };
  const generationHash = hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id);
  const toolHash = hashWorkflowIdentifier("tool", input.tool_use_id ?? input.tool_call_id);
  if (!generationHash || !toolHash) return { status: "mismatch" };
  const requestHash = nativeReviewRequestHash(toolInput);
  let prepared = null;
  for (const stateRoot of stateRoots) {
    const resolved = resolveActiveContext({ stateRoot, input, pluginRoot, options });
    if (resolved.status !== "resolved") {
      prepared ??= resolved;
      continue;
    }
    if (toolInput.root_plan_id && toolInput.root_plan_id !== resolved.current.active.root_plan_id) {
      return { status: "mismatch", expected_root_plan_id: resolved.current.active.root_plan_id };
    }
    const createdAt = timestamp(options);
    const expiresAt = new Date(Date.parse(createdAt) + NATIVE_REVIEW_RECEIPT_TTL_MS).toISOString();
    const id = receiptId(input);
    const pendingPath = join(nativeReviewReceiptDirectory(stateRoot, requestHash), `${id}.json`);
    const consumedPath = join(nativeReviewReceiptDirectory(stateRoot, requestHash, "consumed"), `${id}.json`);
    const expiredPath = join(nativeReviewReceiptDirectory(stateRoot, requestHash, "expired"), `${id}.json`);
    const existingPending = readJson(pendingPath);
    if (existingPending && Date.parse(existingPending.expires_at) > Date.parse(createdAt)) {
      prepared = { status: "prepared", root_plan_id: existingPending.root_plan_id, request_hash: requestHash };
      continue;
    }
    const existingConsumed = readJson(consumedPath);
    if (existingConsumed && Date.parse(existingConsumed.expires_at) > Date.parse(createdAt)) return { status: "replayed" };
    if (existsSync(expiredPath) || existingPending) return { status: "expired" };
    const receipt = {
      schema: 1,
      kind: "cursor-native-review-receipt",
      receipt_id: id,
      request_hash: requestHash,
      workspace_hash: sha256(stateRoot).slice(0, 32),
      conversation_hash: resolved.conversationHash,
      generation_hash: generationHash,
      tool_hash: toolHash,
      root_plan_id: resolved.current.active.root_plan_id,
      root_hash: resolved.current.active.root_hash,
      root_text: resolved.current.active.root_text,
      artifacts: resolved.chain.artifacts,
      predecessor_mode: resolved.chain.status,
      created_at: createdAt,
      expires_at: expiresAt,
    };
    atomicJson(pendingPath, receipt);
    prepared = { status: "prepared", root_plan_id: receipt.root_plan_id, request_hash: requestHash };
  }
  return prepared ?? { status: "unavailable" };
}

function parseToolOutput(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = parseToolOutput(entry?.text ?? entry, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value === "string") {
    try { return parseToolOutput(JSON.parse(value), depth + 1); } catch { return null; }
  }
  if (typeof value !== "object") return null;
  if (value.structuredContent && typeof value.structuredContent === "object") return parseToolOutput(value.structuredContent, depth + 1);
  if (value.artifact_kind === "work-review" && value.delivery_evidence_artifact && value.artifact) return value;
  for (const key of ["tool_output", "result", "output", "content"]) {
    const nested = parseToolOutput(value[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function outputArtifacts(payload, active, pluginRoot) {
  const evidence = inspectArtifactText(payload.delivery_evidence_artifact, pluginRoot);
  const review = inspectArtifactText(payload.artifact, pluginRoot);
  const evidenceFields = evidence.artifact?.fields;
  const reviewFields = review.artifact?.fields;
  if (evidence.errors.length > 0 || evidenceFields?.artifact !== "delivery-evidence" || evidenceFields.root_plan_id !== active.root_plan_id) return null;
  if (review.errors.length > 0 || reviewFields?.artifact !== "work-review" || reviewFields.root_plan_id !== active.root_plan_id) return null;
  const evidenceHash = sha256(payload.delivery_evidence_artifact);
  const reviewHash = sha256(payload.artifact);
  if (payload.delivery_evidence_hash !== evidenceHash || payload.artifact_hash !== reviewHash || !/^[a-f0-9]{64}$/.test(String(payload.review_input_hash ?? ""))) return null;
  return [
    { label: evidenceFields.id, text: payload.delivery_evidence_artifact },
    {
      label: reviewFields.id,
      text: payload.artifact,
      builder_provenance: {
        schema: 1,
        kind: "host-work-review-builder",
        review_input_hash: payload.review_input_hash,
        artifact_hash: reviewHash,
      },
    },
  ];
}

export function observeNativeReviewResult({ stateRoots, input, pluginRoot, options = {} }) {
  if (!WORK_REVIEW_TOOL.test(String(input.tool_name ?? ""))) return { status: "ignored" };
  const payload = parseToolOutput(input.tool_output);
  if (!payload) return { status: "ignored" };
  const conversationHash = hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
  if (!conversationHash) return { status: "unavailable" };
  let result = { status: "unavailable" };
  for (const stateRoot of stateRoots) {
    const current = readConversation(stateRoot, conversationHash);
    if (!current?.active || current.active.root_plan_id !== payload.root_plan_id) continue;
    const next = outputArtifacts(payload, current.active, pluginRoot);
    if (!next) return { status: "invalid" };
    const merged = new Map((current.artifacts ?? []).map((entry) => [entry.label, entry]));
    for (const entry of next) merged.set(entry.label, entry);
    const artifacts = [...merged.values()];
    const chain = validArtifacts(current.active.root_text, artifacts, pluginRoot);
    if (chain.status === "invalid") return { status: "invalid", errors: chain.errors };
    writeConversation(stateRoot, conversationHash, { ...current, artifacts }, options);
    result = { status: "recorded", root_plan_id: current.active.root_plan_id };
  }
  return result;
}

export function cleanupNativeTaskReviewContext(stateRoot, options = {}) {
  const root = contextRoot(stateRoot);
  if (!existsSync(root)) return;
  const cutoff = nowMs(options) - NATIVE_TASK_CONTEXT_TTL_MS;
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        if (readdirSync(path).length === 0) rmSync(path, { recursive: true, force: true });
      } else if (entry.isFile() && statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
    }
  };
  visit(root);
}
