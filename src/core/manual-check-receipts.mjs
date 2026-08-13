import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { executionContractFromArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { captureRepositorySnapshot } from "./manual-repository-snapshot.mjs";
import {
  repositoryKey,
  rootContentHash,
  sharedArtifactStateRoot,
} from "./state-paths.mjs";

export const MANUAL_CHECK_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
export const MANUAL_CHECK_RECEIPT_SURFACE = "host-tool-receipt";

export function manualReceiptHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stableManualReceiptJson(value) {
  return JSON.stringify(stable(value));
}

const sha256 = manualReceiptHash;
const stableJson = stableManualReceiptJson;

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))];
}

export function normalizeManualCheckCommand(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.startsWith("rtk ") ? trimmed.slice(4) : trimmed;
}

function readOnlyShellSegment(segment) {
  const cleaned = String(segment ?? "").trim()
    .replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)*/, "")
    .replace(/^rtk\s+/, "");
  return /^(?:pwd|ls|rg|grep|head|tail|wc|stat|find|readlink|which|type|file|test)(?:\s|$)/.test(cleaned)
    || /^sed\s+-n(?:\s|$)/.test(cleaned)
    || /^git\s+(?:status|diff|show|log|rev-parse|ls-files|check-ignore)(?:\s|$)/.test(cleaned)
    || /^node\s+--test(?:\s|$)/.test(cleaned)
    || /^node\s+[^\s]*(?:validate|check|inspect)[^\s]*\.mjs(?:\s|$)/.test(cleaned)
    || /^npm\s+(?:test|run\s+(?:test|check|validate|release-check))(?:\s|$)/.test(cleaned);
}

export function isReadOnlyShell(command) {
  const source = String(command ?? "");
  if (
    !source.trim()
    || /[\r\n`]|\$\(|<|(?:^|[^<])>(?:>|&)?|(?:^|[^&])&(?!&)|\btee\b|\bsed\s+-i\b|\bperl\s+-i\b/.test(source)
  ) return false;
  return source.split(/\s*(?:&&|\|\||;|\|)\s*/).filter(Boolean).every(readOnlyShellSegment);
}

function normalizedWorkingDirectory(workspaceRoot, value) {
  const root = resolve(workspaceRoot);
  const source = value === undefined || value === null || String(value).trim() === ""
    ? root
    : resolve(root, String(value));
  const rel = relative(root, source).replaceAll("\\", "/");
  if (rel === "") return ".";
  if (rel === ".." || rel.startsWith("../")) return null;
  return rel;
}

function plannedWorkingDirectory(value) {
  const source = String(value ?? "").trim();
  if (!source || /^repository root$/i.test(source) || source === ".") return ".";
  const normalized = source.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) return null;
  return normalized;
}

function manualMachineChecks(rootPlanText, pluginRoot) {
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields?.schema !== 5) {
    throw new Error(`manual Check receipts require a valid Schema-5 Root: ${contract.errors.join("; ")}`);
  }
  return {
    root_plan_id: contract.fields.id,
    root_hash: rootContentHash(rootPlanText),
    checks: contract.checks.filter((check) => (
      check.Required === "yes" && check["Evidence Class"] === "machine-verifiable"
    )).map((check) => ({
      check_id: check["Check ID"],
      command: normalizeManualCheckCommand(check["Command or Inspection"]),
      command_hash: sha256(normalizeManualCheckCommand(check["Command or Inspection"])),
      working_directory: plannedWorkingDirectory(check["Working Directory"]),
      expected: check["Expected Result"],
      required_repetitions: 1,
    })),
    all_checks: contract.checks.filter((check) => check.Required === "yes"),
  };
}

function shellToolInput(toolName, toolInput, workspaceRoot) {
  if (!/^(?:Shell|Bash)$/i.test(String(toolName ?? ""))) return null;
  const source = toolInput && typeof toolInput === "object" && !Array.isArray(toolInput) ? toolInput : {};
  const command = source.command ?? source.cmd;
  if (typeof command !== "string" || !command.trim()) return null;
  const workingDirectory = normalizedWorkingDirectory(workspaceRoot, source.workdir ?? source.cwd);
  if (workingDirectory === null) return null;
  return {
    command: normalizeManualCheckCommand(command),
    working_directory: workingDirectory,
  };
}

export function repositorySnapshotFingerprint(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("manual Check receipt requires a repository snapshot");
  return sha256(stableJson({
    repository_root: resolve(snapshot.repository_root),
    head: snapshot.head,
    dirty_paths: snapshot.dirty_paths,
    fingerprints: snapshot.fingerprints,
    index_fingerprint: snapshot.index_fingerprint ?? null,
    status_fingerprint: snapshot.status_fingerprint ?? null,
  }));
}

export function beginManualCheckReceipt({
  rootPlanText,
  pluginRoot,
  workspaceRoot,
  toolName,
  toolInput,
  captureSnapshot = captureRepositorySnapshot,
  now = () => new Date(),
}) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) return null;
  const invocation = shellToolInput(toolName, toolInput, workspaceRoot);
  if (!invocation) return null;
  const plan = manualMachineChecks(rootPlanText, pluginRoot);
  const matches = plan.checks.filter((check) => (
    check.command === invocation.command
    && check.working_directory !== null
    && check.working_directory === invocation.working_directory
  ));
  if (matches.length !== 1) return null;
  const snapshot = captureSnapshot(workspaceRoot);
  const startedAt = now().toISOString();
  return {
    schema: 1,
    kind: "manual-check-receipt-candidate",
    candidate_id: sha256(stableJson({
      root_hash: plan.root_hash,
      check_id: matches[0].check_id,
      command_hash: matches[0].command_hash,
      working_directory: matches[0].working_directory,
      snapshot_fingerprint: repositorySnapshotFingerprint(snapshot),
      started_at: startedAt,
    })),
    root_plan_id: plan.root_plan_id,
    root_hash: plan.root_hash,
    check_id: matches[0].check_id,
    command_hash: matches[0].command_hash,
    working_directory: matches[0].working_directory,
    required_repetitions: matches[0].required_repetitions,
    repository_root: resolve(snapshot.repository_root),
    repository_key: repositoryKey(snapshot.repository_root),
    snapshot_fingerprint: repositorySnapshotFingerprint(snapshot),
    started_at: startedAt,
  };
}

function explicitExitCode(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  for (const key of ["exit_code", "exitCode", "code"]) {
    if (Number.isInteger(value[key])) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = explicitExitCode(child, seen);
    if (found !== null) return found;
  }
  return null;
}

function responseText(value, seen = new Set()) {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n");
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  for (const key of ["stdout", "output", "text"]) {
    if (typeof value[key] === "string") return value[key].replace(/\r\n/g, "\n");
  }
  if (Array.isArray(value.content)) {
    const text = value.content.filter((entry) => entry?.type === "text" && typeof entry.text === "string").map((entry) => entry.text).join("\n");
    if (text) return text.replace(/\r\n/g, "\n");
  }
  for (const child of Object.values(value)) {
    const found = responseText(child, seen);
    if (found !== null) return found;
  }
  return null;
}

function explicitHostSignal(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (value.isError === true) return "failed";
  if (Object.hasOwn(value, "error") && value.error !== null && value.error !== false && value.error !== "") return "failed";
  for (const key of ["status", "result_status", "outcome"]) {
    const signal = String(value[key] ?? "").trim().toLowerCase();
    if (["failed", "failure", "error", "cancelled", "canceled", "timed-out", "timeout"].includes(signal)) return "failed";
  }
  for (const key of ["ok", "success"]) if (value[key] === false) return "failed";
  let success = false;
  for (const key of ["status", "result_status", "outcome"]) {
    const signal = String(value[key] ?? "").trim().toLowerCase();
    if (["passed", "success", "succeeded", "completed", "ok"].includes(signal)) success = true;
  }
  for (const key of ["ok", "success"]) if (value[key] === true) success = true;
  for (const child of Object.values(value)) {
    const nested = explicitHostSignal(child, seen);
    if (nested === "failed") return "failed";
    if (nested === "passed") success = true;
  }
  return success ? "passed" : null;
}

export function manualToolResultStatus(response) {
  if (response === undefined || response === null) return { status: "missing", exit_code: null };
  const signal = explicitHostSignal(response);
  const text = responseText(response);
  const textualExit = text?.match(/\b(?:process\s+)?(?:exited?|exit)\s+(?:with\s+)?(?:code|status)\s*[:=]?\s*(-?\d+)\b/i);
  const exitCode = explicitExitCode(response) ?? (textualExit ? Number(textualExit[1]) : null);
  if (signal === "failed" || (exitCode !== null && exitCode !== 0)) return { status: "failed", exit_code: exitCode };
  if (exitCode === 0 || signal === "passed") return { status: "passed", exit_code: exitCode };
  return { status: "missing", exit_code: null };
}

function canonicalResponseHash(response, result) {
  const text = responseText(response);
  return sha256(stableJson({
    status: result.status,
    exit_code: result.exit_code ?? (result.status === "passed" ? 0 : null),
    output_hash: text === null ? null : sha256(text),
  }));
}

function proofBase(workspaceRoot, rootHash, options = {}) {
  return join(sharedArtifactStateRoot(canonicalWorkspaceRoot(workspaceRoot), options), "manual-check-receipts", rootHash);
}

export function canonicalManualWorkspaceRoot(workspaceRoot) {
  try { return realpathSync(workspaceRoot); }
  catch { return resolve(workspaceRoot); }
}

const canonicalWorkspaceRoot = canonicalManualWorkspaceRoot;

export function assertManualReceiptPath(path, base) {
  const resolvedBase = resolve(base);
  const resolvedPath = resolve(path);
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${sep}`)) {
    throw new Error("manual Check receipt path escapes its protected state root");
  }
  let current = resolvedPath;
  while (current !== resolvedBase && !existsSync(current)) current = dirname(current);
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
    throw new Error("manual Check receipt state may not be symlink redirected");
  }
}

const assertSafeDirectory = assertManualReceiptPath;

function ensureDirectory(path, base) {
  assertSafeDirectory(path, base);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  let current = resolve(path);
  const stop = resolve(base);
  while (current.startsWith(stop)) {
    if (lstatSync(current).isSymbolicLink()) throw new Error("manual Check receipt state may not contain symlink directories");
    try { chmodSync(current, 0o700); } catch { /* best effort */ }
    if (current === stop) break;
    current = dirname(current);
  }
}

export function writeManualReceiptRecord(path, value, base) {
  ensureDirectory(dirname(path), base);
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}


const writeReceiptRecord = writeManualReceiptRecord;

export function readManualReceiptRecord(path, base) {
  assertSafeDirectory(path, base);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) return null;
  const value = JSON.parse(readFileSync(path, "utf8"));
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

const readReceiptRecord = readManualReceiptRecord;

function existingRecords(directory, base) {
  if (!existsSync(directory)) return [];
  assertSafeDirectory(directory, base);
  if (lstatSync(directory).isSymbolicLink()) return [];
  return readdirSync(directory)
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .flatMap((name) => {
      try {
        const record = readReceiptRecord(join(directory, name), base);
        return record ? [record] : [];
      } catch {
        return [];
      }
    });
}

export function invalidateManualCheckReceipts({ rootPlanText, workspaceRoot, options = {} }) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) return false;
  const rootHash = rootContentHash(rootPlanText);
  const canonicalRoot = canonicalWorkspaceRoot(workspaceRoot);
  const base = proofBase(canonicalRoot, rootHash, options);
  if (!existsSync(base)) return false;
  const stateRoot = sharedArtifactStateRoot(canonicalRoot, options);
  assertSafeDirectory(base, stateRoot);
  if (lstatSync(base).isSymbolicLink()) throw new Error("manual Check receipt state may not be symlink redirected");
  rmSync(base, { recursive: true, force: true });
  return true;
}

export function completeManualCheckReceipt({
  candidate,
  rootPlanText,
  workspaceRoot,
  toolResponse,
  captureSnapshot = captureRepositorySnapshot,
  now = () => new Date(),
  options = {},
}) {
  if (!candidate || candidate.kind !== "manual-check-receipt-candidate") return { status: "unmatched", receipt: null };
  if (candidate.root_hash !== rootContentHash(rootPlanText)) return { status: "root-mismatch", receipt: null };
  const current = captureSnapshot(workspaceRoot);
  const currentFingerprint = repositorySnapshotFingerprint(current);
  if (resolve(current.repository_root) !== resolve(candidate.repository_root) || currentFingerprint !== candidate.snapshot_fingerprint) {
    invalidateManualCheckReceipts({ rootPlanText, workspaceRoot, options });
    return { status: "repository-mutated", receipt: null };
  }
  const result = manualToolResultStatus(toolResponse);
  if (result.status === "missing") return { status: "missing-result", receipt: null };
  const canonicalRoot = current.repository_root;
  const base = proofBase(canonicalRoot, candidate.root_hash, options);
  const directory = join(base, candidate.check_id);
  const prior = existingRecords(directory, sharedArtifactStateRoot(canonicalRoot, options))
    .filter((record) => record?.receipt?.snapshot_fingerprint === candidate.snapshot_fingerprint);
  const ordinal = prior.length + 1;
  const receipt = {
    schema: 1,
    kind: "manual-check-receipt",
    root_hash: candidate.root_hash,
    check_id: candidate.check_id,
    command_hash: candidate.command_hash,
    working_directory: candidate.working_directory,
    repository_key: candidate.repository_key,
    snapshot_fingerprint: candidate.snapshot_fingerprint,
    result_status: result.status,
    tool_response_hash: canonicalResponseHash(toolResponse, result),
    repetition_ordinal: ordinal,
  };
  const receiptHash = sha256(stableJson(receipt));
  const recordedAt = now();
  const record = {
    schema: 1,
    kind: "manual-check-receipt-record",
    recorded_at: recordedAt.toISOString(),
    expires_at: new Date(recordedAt.getTime() + MANUAL_CHECK_RECEIPT_TTL_MS).toISOString(),
    receipt_hash: receiptHash,
    receipt,
  };
  writeReceiptRecord(join(directory, `${receiptHash}.json`), record, sharedArtifactStateRoot(canonicalRoot, options));
  return { status: result.status === "passed" ? "recorded" : "failed", receipt, receipt_hash: receiptHash };
}

function validStoredReceipt(record, { plan, repositoryRoot, currentFingerprint, now }) {
  if (!record || record.schema !== 1 || record.kind !== "manual-check-receipt-record") return false;
  const receipt = record.receipt;
  if (!receipt || receipt.schema !== 1 || receipt.kind !== "manual-check-receipt") return false;
  if (!/^[a-f0-9]{64}$/.test(String(record.receipt_hash ?? ""))) return false;
  if (sha256(stableJson(receipt)) !== record.receipt_hash) return false;
  if (receipt.root_hash !== plan.root_hash || receipt.repository_key !== repositoryKey(repositoryRoot)) return false;
  if (receipt.snapshot_fingerprint !== currentFingerprint) return false;
  const expires = Date.parse(record.expires_at);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return false;
  const check = plan.checks.find((entry) => entry.check_id === receipt.check_id);
  if (!check || check.command_hash !== receipt.command_hash || check.working_directory !== receipt.working_directory) return false;
  return ["passed", "failed"].includes(receipt.result_status) && Number.isInteger(receipt.repetition_ordinal) && receipt.repetition_ordinal >= 1;
}

export function loadManualCheckReceipts({
  rootPlanText,
  pluginRoot,
  workspaceRoot,
  captureSnapshot = captureRepositorySnapshot,
  now = () => new Date(),
  options = {},
}) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim() || !workspaceRoot) return [];
  const plan = manualMachineChecks(rootPlanText, pluginRoot);
  const current = captureSnapshot(workspaceRoot);
  const currentFingerprint = repositorySnapshotFingerprint(current);
  const canonicalRoot = current.repository_root;
  const base = proofBase(canonicalRoot, plan.root_hash, options);
  const stateRoot = sharedArtifactStateRoot(canonicalRoot, options);
  if (!existsSync(base)) return [];
  try {
    assertSafeDirectory(base, stateRoot);
    if (lstatSync(base).isSymbolicLink()) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^CHECK-[1-9][0-9]*$/.test(entry.name))
      .flatMap((entry) => existingRecords(join(base, entry.name), stateRoot))
      .filter((record) => validStoredReceipt(record, {
        plan,
        repositoryRoot: current.repository_root,
        currentFingerprint,
        now: now(),
      }))
      .map((record) => ({ ...record.receipt, receipt_hash: record.receipt_hash }))
      .sort((left, right) => left.check_id.localeCompare(right.check_id) || left.repetition_ordinal - right.repetition_ordinal);
  } catch {
    return [];
  }
}

function limitationFor(check) {
  const command = normalizeManualCheckCommand(check["Command or Inspection"]);
  const workingDirectory = String(check["Working Directory"] ?? "repository root");
  return `HOST-RECEIPT-MISSING: ${check["Check ID"]} was not host-attested for the current repository snapshot. Re-run exactly \`${command}\` from ${workingDirectory}, then retry closeout.`;
}

function sameCallerObservation(entry, existing) {
  return Boolean(existing
    && entry?.grade === existing.grade
    && String(entry?.observed ?? "not fully observed") === String(existing.observed ?? "not fully observed")
    && String(entry?.expected ?? existing.expected ?? "") === String(existing.expected ?? ""));
}

export function calibrateManualCheckEvidence({ entries, plannedChecks, receipts = [], existingCheckEvidence = [] }) {
  const existingByCheck = new Map((existingCheckEvidence ?? []).map((entry) => [entry.check_id, entry]));
  return entries.map((entry) => {
    const check = plannedChecks.get(entry.check_id);
    if (!check || check["Evidence Class"] !== "machine-verifiable") return entry;
    const commandHash = sha256(normalizeManualCheckCommand(check["Command or Inspection"]));
    const workingDirectory = plannedWorkingDirectory(check["Working Directory"]);
    const checkReceipts = receipts.filter((receipt) => (
      receipt.command_hash === commandHash
      && receipt.working_directory === workingDirectory
    ));
    const failures = checkReceipts.filter((receipt) => receipt.result_status === "failed");
    const successes = checkReceipts.filter((receipt) => receipt.result_status === "passed");
    if (failures.length > 0) {
      return {
        ...entry,
        grade: "failed",
        surface: MANUAL_CHECK_RECEIPT_SURFACE,
        method: normalizeManualCheckCommand(check["Command or Inspection"]),
        repetitions: failures.length + successes.length,
        artifact_hashes: unique([...failures, ...successes].map((receipt) => receipt.receipt_hash)),
        limitations: unique([...(entry.limitations ?? []), `HOST-RECEIPT-FAILED: ${entry.check_id} returned a host-observed failure for the current repository snapshot.`]),
      };
    }
    if (entry.grade !== "verified") return entry;
    if (successes.length >= 1) {
      return {
        ...entry,
        grade: "verified",
        surface: MANUAL_CHECK_RECEIPT_SURFACE,
        method: normalizeManualCheckCommand(check["Command or Inspection"]),
        repetitions: successes.length,
        artifact_hashes: unique(successes.map((receipt) => receipt.receipt_hash)),
      };
    }
    const existing = existingByCheck.get(entry.check_id);
    if (
      existing?.grade === "verified"
      && existing.surface === MANUAL_CHECK_RECEIPT_SURFACE
      && Array.isArray(existing.artifact_hashes)
      && existing.artifact_hashes.length > 0
      && sameCallerObservation(entry, existing)
    ) {
      return { ...existing };
    }
    const meaningful = String(entry.observed ?? "").trim() && !/^not (?:fully )?observed$/i.test(String(entry.observed).trim());
    return {
      ...entry,
      grade: meaningful ? "supported" : "unavailable",
      surface: "repository",
      method: normalizeManualCheckCommand(check["Command or Inspection"]),
      repetitions: 0,
      artifact_hashes: [],
      limitations: unique([...(entry.limitations ?? []), limitationFor(check)]),
    };
  });
}

export function manualConstraintProjection({ checks = [], evidence = [], pending = false }) {
  const required = checks.filter((check) => check.Required === "yes");
  const byId = new Map((evidence ?? []).map((entry) => [entry.check_id, entry]));
  const ids = (predicate) => required.filter(predicate).map((check) => check["Check ID"]);
  const hostAttested = ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return entry?.grade === "verified" && entry.surface === MANUAL_CHECK_RECEIPT_SURFACE && (entry.artifact_hashes?.length ?? 0) > 0;
  });
  const machine = ids((check) => check["Evidence Class"] === "machine-verifiable");
  const failed = ids((check) => byId.get(check["Check ID"])?.grade === "failed");
  const unattestedVerified = pending ? [] : ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return check["Evidence Class"] === "machine-verifiable"
      && entry?.grade === "verified"
      && !(entry.surface === MANUAL_CHECK_RECEIPT_SURFACE && (entry.artifact_hashes?.length ?? 0) > 0);
  });
  const ordinaryGaps = pending ? [] : ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return !entry || ["supported", "partial", "unavailable"].includes(entry.grade);
  });
  const gaps = unique([...unattestedVerified, ...ordinaryGaps]);
  const humanReview = ids((check) => check["Evidence Class"] === "human-review-required");
  const humanApproval = ids((check) => check["Evidence Class"] === "human-approval-required");
  const reasons = pending ? [] : [
    ...failed.map((checkId) => ({ code: "check-failed", check_id: checkId, message: `${checkId} failed and blocks delivery.`, recovery: `Repair the cause, rerun ${checkId}, then retry closeout.` })),
    ...unattestedVerified.map((checkId) => ({ code: "legacy-receipt-gap", check_id: checkId, message: `${checkId} is marked verified without a valid host receipt.`, recovery: `Run a fresh review for ${checkId}; use its bounded correction route to refresh Evidence with current host receipts.` })),
    ...ordinaryGaps.map((checkId) => ({ code: "evidence-gap", check_id: checkId, message: `${checkId} is not fully verified.`, recovery: `Follow the Check limitation, rerun ${checkId}, then retry closeout.` })),
    ...humanReview.map((checkId) => ({ code: "human-review-required", check_id: checkId, message: `${checkId} requires human review.`, recovery: `Complete the stated review for ${checkId} and record the bounded observation.` })),
    ...humanApproval.map((checkId) => ({ code: "human-approval-required", check_id: checkId, message: `${checkId} requires explicit human approval.`, recovery: `Request the named approval before continuing.` })),
  ];
  return {
    constraint_summary: {
      schema: 1,
      scope: "current-delivery",
      required_checks: required.map((check) => check["Check ID"]),
      host_attested_checks: hostAttested,
      human_review_checks: humanReview,
      human_approval_checks: humanApproval,
      failed_checks: failed,
      evidence_gap_checks: gaps,
      legacy_unattested_verified_checks: unattestedVerified,
      receipt_coverage: {
        attested: hostAttested.length,
        eligible: machine.length,
      },
    },
    human_attention: {
      required: reasons.length > 0,
      reasons,
    },
    problem_details: reasons.map((reason) => ({
      problem: reason.message,
      why: reason.code === "check-failed"
        ? "A required failed Check blocks delivery acceptance."
        : ["evidence-gap", "legacy-receipt-gap"].includes(reason.code)
          ? "The current evidence cannot support a verified delivery claim."
          : "This Check is intentionally reserved for human judgment or authority.",
      resolution: reason.recovery,
      blocking: ["check-failed", "human-approval-required"].includes(reason.code),
      check_id: reason.check_id,
    })),
  };
}
