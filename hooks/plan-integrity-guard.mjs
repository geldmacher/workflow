#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectArtifactText,
  preflightRootPlan,
  rootContentHash,
  validateArtifactText,
} from "../scripts/validate-artifact.mjs";
import {
  clearActiveRootPlan,
  readActiveRootPlan,
  recordActiveRootPlan,
  stateRoots,
} from "./closeout-guard.mjs";
import { hashWorkflowIdentifier } from "./model-inheritance-state.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_TRANSACTIONS_PER_CONVERSATION = 64;
const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT_ID = /^wp-[A-Za-z0-9][A-Za-z0-9-]*$/;
const REVIEW_ID = /^wr-[A-Za-z0-9][A-Za-z0-9-]*$/;
const PLAN_WORK = /(?:^|\s)\/plan-work\b/i;
const REPLAN = /(?:^|\s)\/plan-work\s+replan\b/i;

const deny = (user_message) => ({ permission: "deny", user_message });
const blockPrompt = (user_message) => ({ continue: false, user_message });

function conversationHash(input) {
  return hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
}

function generationHash(input) {
  return hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id);
}

function transactionDirectory(stateRoot, conversation) {
  return join(stateRoot, "manual-plan-transactions", conversation);
}

function transactionPath(stateRoot, conversation, generation) {
  return join(transactionDirectory(stateRoot, conversation), `${generation}.json`);
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

function transactionIdentity(input) {
  return { conversation: conversationHash(input), generation: generationHash(input) };
}

function readTransaction(input, options = {}) {
  const { conversation, generation } = transactionIdentity(input);
  if (!conversation || !generation) return null;
  for (const stateRoot of stateRoots(input, options)) {
    const path = transactionPath(stateRoot, conversation, generation);
    if (existsSync(path)) return readJson(path);
  }
  return null;
}

function writeTransaction(input, transaction, options = {}) {
  const { conversation, generation } = transactionIdentity(input);
  if (!conversation || !generation) return false;
  const value = {
    schema: 1,
    kind: "cursor-plan-transaction",
    ...transaction,
    conversation_hash: conversation,
    generation_hash: generation,
    updated_at: new Date().toISOString(),
  };
  for (const stateRoot of stateRoots(input, options)) {
    writeJson(transactionPath(stateRoot, conversation, generation), value);
  }
  return true;
}

function supersedePendingTransactions(input, options = {}) {
  const { conversation, generation } = transactionIdentity(input);
  if (!conversation || !generation) return;
  for (const stateRoot of stateRoots(input, options)) {
    const directory = transactionDirectory(stateRoot, conversation);
    if (!existsSync(directory)) continue;
    const names = readdirSync(directory).filter((name) => name.endsWith(".json")).sort().slice(-MAX_TRANSACTIONS_PER_CONVERSATION);
    for (const name of names) {
      if (name === `${generation}.json`) continue;
      const path = join(directory, name);
      const value = readJson(path);
      if (value?.status !== "pending") continue;
      writeJson(path, {
        ...value,
        status: "failed",
        failure_reason: "superseded-by-new-human-prompt",
        authoritative: false,
        updated_at: new Date().toISOString(),
      });
    }
  }
}

function failTransaction(input, reason, options = {}) {
  const prior = readTransaction(input, options);
  if (!prior) return;
  writeTransaction(input, {
    ...prior,
    status: "failed",
    failure_reason: reason,
    authoritative: false,
  }, options);
}

function schema5Claim(plan, root) {
  const inspected = inspectArtifactText(plan, root);
  if (inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.schema === 5) return true;
  return /```yaml artifact-envelope[\s\S]*?\bartifact:\s*work-plan\b[\s\S]*?\bschema:\s*5\b[\s\S]*?```/i.test(plan);
}

function extractRootPlanText(plan) {
  const fenced = plan.match(/```yaml artifact-envelope\s*([\s\S]*?)```([\s\S]*)$/i);
  if (!fenced?.[1]) return null;
  const suffix = String(fenced[2] ?? "").replace(/^\r?\n/, "");
  return `---\n${fenced[1].trim()}\n---\n${suffix}`;
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

function inspectExactActiveRoot(active, root) {
  if (!active?.root_plan_id || typeof active.root_plan_text !== "string") {
    return { ok: false, reason: "no exact active Schema-5 predecessor Root is bound to this conversation" };
  }
  const inspected = inspectArtifactText(active.root_plan_text, root);
  const fields = inspected.artifact?.fields;
  if (inspected.errors.length > 0 || fields?.artifact !== "work-plan" || fields?.schema !== 5 || fields.id !== active.root_plan_id) {
    return { ok: false, reason: inspected.errors[0] ?? "active predecessor Root identity mismatch" };
  }
  const hash = rootContentHash(active.root_plan_text);
  if (active.root_content_hash !== hash) return { ok: false, reason: "active predecessor Root bytes do not match their recorded hash" };
  return { ok: true, fields, hash };
}

function beginPromptTransaction(input, options = {}) {
  const prompt = String(input.prompt ?? input.command ?? "");
  supersedePendingTransactions(input, options);
  if (!PLAN_WORK.test(prompt)) return {};
  const identity = transactionIdentity(input);
  if (!identity.conversation || !identity.generation) {
    return blockPrompt("Workflow planning requires stable Cursor conversation_id and generation_id fields.");
  }
  const root = options.pluginRoot ?? pluginRoot;
  const mode = REPLAN.test(prompt) ? "replan" : "initial";
  const active = readActiveRootPlan(input, options);
  let predecessor = null;
  if (mode === "replan") {
    const inspected = inspectExactActiveRoot(active, root);
    if (!inspected.ok) return blockPrompt(`Workflow replan blocked: ${inspected.reason}. Select or re-approve the exact predecessor Root before replanning.`);
    const selected = prompt.match(/\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/)?.[0] ?? null;
    if (selected && selected !== active.root_plan_id) {
      return blockPrompt(`Workflow replan blocked: selected predecessor ${selected} does not match active Root ${active.root_plan_id}.`);
    }
    predecessor = {
      root_plan_id: active.root_plan_id,
      root_content_hash: inspected.hash,
      root_plan_text: active.root_plan_text,
    };
  }
  writeTransaction(input, {
    status: "pending",
    mode,
    authoritative: false,
    predecessor,
    candidate: null,
    receipt: null,
    failure_reason: null,
    started_at: new Date().toISOString(),
  }, options);
  if (active?.root_plan_id) clearActiveRootPlan(input, options);
  return {};
}

function ensureTransactionForCandidate(input, fields, options = {}) {
  const prior = readTransaction(input, options);
  if (prior?.status === "committed") return { ok: false, reason: "this Cursor generation already committed one Workflow Plan receipt" };
  if (prior) return { ok: true, transaction: prior };
  if (fields.predecessor_plan_id || fields.replan_source_review_id) {
    return { ok: false, reason: "a lineage-bearing replan requires an explicit /plan-work replan prompt in the same Cursor generation" };
  }
  const active = readActiveRootPlan(input, options);
  writeTransaction(input, {
    status: "pending",
    mode: "initial",
    authoritative: false,
    predecessor: null,
    candidate: null,
    receipt: null,
    failure_reason: null,
    started_at: new Date().toISOString(),
  }, options);
  if (active?.root_plan_id) clearActiveRootPlan(input, options);
  return { ok: true, transaction: readTransaction(input, options) };
}

function validateTransactionLineage(transaction, fields) {
  if (transaction.mode === "replan") {
    const predecessorId = transaction.predecessor?.root_plan_id;
    if (!ROOT_ID.test(String(predecessorId ?? ""))) return "the staged replan has no exact predecessor Root";
    if (fields.id === predecessorId) return "a replan must use a fresh wp-* ID";
    if (fields.predecessor_plan_id !== predecessorId) return `replan predecessor_plan_id must equal ${predecessorId}`;
    if (!REVIEW_ID.test(String(fields.replan_source_review_id ?? ""))) return "replan_source_review_id must be one explicit wr-* review ID";
    return null;
  }
  if (fields.predecessor_plan_id || fields.replan_source_review_id) return "an initial Plan must omit replan lineage";
  return null;
}

function stageCreatePlan(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return deny("Workflow CreatePlan policy received invalid input and failed closed.");
  if (input.tool_name !== "CreatePlan") return {};
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput) || typeof toolInput.plan !== "string") {
    failTransaction(input, "invalid-create-plan-payload", options);
    return deny("Workflow CreatePlan policy received an invalid CreatePlan payload and failed closed.");
  }
  const root = options.pluginRoot ?? pluginRoot;
  const transaction = readTransaction(input, options);
  if (!schema5Claim(toolInput.plan, root)) {
    if (transaction?.status === "pending") {
      failTransaction(input, "workflow-plan-omitted-schema-5-root", options);
      return deny("Workflow CreatePlan denied: the active /plan-work transaction requires one exact Schema-5 Root.");
    }
    return {};
  }
  if (!Array.isArray(toolInput.todos) || toolInput.todos.length === 0) {
    failTransaction(input, "native-todos-missing", options);
    return deny("Workflow Schema-5 CreatePlan denied: native todos are required, and the last todo must perform deterministic closeout.");
  }
  const failures = validateArtifactText(nativePlanText(toolInput), root);
  if (failures.length > 0) {
    failTransaction(input, "schema-5-validation-failed", options);
    const details = failures.slice(0, 8).map((failure) => String(failure).replace(/\s+/g, " ").slice(0, 300)).join("; ");
    return deny(`Workflow Schema-5 CreatePlan denied: ${details}. Repair the Root/todos and call CreatePlan again; no Plan was created.`);
  }
  const rootText = extractRootPlanText(toolInput.plan);
  if (!rootText) {
    failTransaction(input, "exact-root-text-missing", options);
    return deny("Workflow Schema-5 CreatePlan denied: the native Plan does not contain one extractable exact Root.");
  }
  const preflight = (options.preflightRootPlan ?? preflightRootPlan)(rootText, root);
  if (!preflight.feasible) {
    failTransaction(input, "root-preflight-failed", options);
    const details = (preflight.blocking_issues ?? []).slice(0, 8)
      .map((issue) => String(issue.message ?? issue).replace(/\s+/g, " ").slice(0, 300))
      .join("; ");
    return deny(`Workflow Schema-5 CreatePlan denied: Root preflight failed${details ? `: ${details}` : ""}. Repair the Root and call CreatePlan again; no Plan was created.`);
  }
  const inspected = inspectArtifactText(rootText, root);
  const fields = inspected.artifact?.fields;
  if (!fields?.id || !ROOT_ID.test(fields.id)) {
    failTransaction(input, "root-id-invalid", options);
    return deny("Workflow Schema-5 CreatePlan denied: the exact Root has no valid wp-* ID.");
  }
  if (typeof input.tool_use_id !== "string" || input.tool_use_id.trim() === "") {
    failTransaction(input, "tool-use-id-missing", options);
    return deny("Workflow Schema-5 CreatePlan denied: Cursor supplied no stable tool_use_id for the native Plan receipt.");
  }
  const ensured = ensureTransactionForCandidate(input, fields, options);
  if (!ensured.ok) return deny(`Workflow Schema-5 CreatePlan denied: ${ensured.reason}.`);
  const lineageFailure = validateTransactionLineage(ensured.transaction, fields);
  if (lineageFailure) {
    failTransaction(input, "lineage-validation-failed", options);
    return deny(`Workflow Schema-5 CreatePlan denied: ${lineageFailure}.`);
  }
  writeTransaction(input, {
    ...ensured.transaction,
    status: "pending",
    authoritative: false,
    failure_reason: null,
    candidate: {
      root_plan_id: fields.id,
      root_content_hash: rootContentHash(rootText),
      root_plan_text: rootText,
      tool_use_id: input.tool_use_id,
      predecessor_plan_id: fields.predecessor_plan_id ?? null,
      replan_source_review_id: fields.replan_source_review_id ?? null,
    },
  }, options);
  return {};
}

function commitCreatePlan(input, options = {}) {
  if (input.tool_name !== "CreatePlan") return {};
  const transaction = readTransaction(input, options);
  const candidate = transaction?.candidate;
  const rootText = typeof input.tool_input?.plan === "string" ? extractRootPlanText(input.tool_input.plan) : null;
  const matches = transaction?.status === "pending"
    && candidate
    && input.tool_use_id === candidate.tool_use_id
    && typeof rootText === "string"
    && rootContentHash(rootText) === candidate.root_content_hash;
  if (!matches) {
    clearActiveRootPlan(input, options);
    failTransaction(input, "post-tool-receipt-mismatch", options);
    return {};
  }
  const recorded = recordActiveRootPlan(input, {
    rootPlanId: candidate.root_plan_id,
    rootContentHash: candidate.root_content_hash,
    rootPlanText: candidate.root_plan_text,
    phase: "planning",
  }, options);
  if (!recorded) {
    clearActiveRootPlan(input, options);
    failTransaction(input, "active-root-commit-failed", options);
    return {};
  }
  writeTransaction(input, {
    ...transaction,
    status: "committed",
    authoritative: false,
    failure_reason: null,
    receipt: {
      conversation_hash: conversationHash(input),
      generation_hash: generationHash(input),
      tool_use_id: candidate.tool_use_id,
      root_plan_id: candidate.root_plan_id,
      root_content_hash: candidate.root_content_hash,
      mode: transaction.mode,
      predecessor_plan_id: candidate.predecessor_plan_id,
      replan_source_review_id: candidate.replan_source_review_id,
      committed_at: new Date().toISOString(),
    },
  }, options);
  return {};
}

function failCreatePlan(input, options = {}) {
  if (input.tool_name !== "CreatePlan") return {};
  const transaction = readTransaction(input, options);
  if (transaction?.candidate && input.tool_use_id !== transaction.candidate.tool_use_id) return {};
  clearActiveRootPlan(input, options);
  failTransaction(input, `create-plan-${input.failure_type ?? "failed"}`, options);
  return {};
}

export function evaluateCreatePlanGuard(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return deny("Workflow CreatePlan policy received invalid input and failed closed.");
  if (input.hook_event_name === "beforeSubmitPrompt") return beginPromptTransaction(input, options);
  if (input.hook_event_name === "preToolUse") return stageCreatePlan(input, options);
  if (input.hook_event_name === "postToolUse") return commitCreatePlan(input, options);
  if (input.hook_event_name === "postToolUseFailure") return failCreatePlan(input, options);
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
    process.stdout.write(JSON.stringify(evaluateCreatePlanGuard(await readInput())));
  } catch {
    process.stdout.write(JSON.stringify(deny("Workflow CreatePlan policy was unavailable and failed closed.")));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
