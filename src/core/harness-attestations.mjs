import { createHash } from "node:crypto";

export const HARNESS_CAPABILITY_RECEIPT_SCHEMA = 1;
export const HARNESS_PHASE_CONTRACT_SCHEMA = 1;
export const HARNESS_CHECK_ATTESTATION_SCHEMA = 1;

const hashPattern = /^[a-f0-9]{64}$/;
const checkPattern = /^CHECK-[1-9][0-9]*$/;
const phases = new Set(["planning", "implementation", "review", "correction"]);
const phaseStatuses = new Set(["completed", "blocked", "unavailable", "cancelled"]);
const attestationStatuses = new Set(["passed", "failed", "unavailable"]);
const capabilities = new Set([
  "phase-execution",
  "authority-enforcement",
  "read-only-review",
  "workspace-snapshot",
  "evidence-attestation",
  "budget-reporting",
  "cancellation",
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function harnessContractHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function closed(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const extras = Object.keys(value).filter((key) => !keys.includes(key));
  if (extras.length > 0) throw new Error(`${label} contains unsupported fields: ${extras.join(", ")}`);
  return value;
}

function exactHash(value, label) {
  if (!hashPattern.test(String(value ?? ""))) throw new Error(`${label} must be a SHA-256 hash`);
  return value;
}

function strings(value, label, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return [...new Set(value.map((entry) => entry.trim()))];
}

function nonNegativeNumber(value, label, { integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be a non-negative ${integer ? "integer" : "number"}`);
  }
  return value;
}

function validateAuthority(value) {
  const authority = closed(value, [
    "allowed_roots", "protected_paths", "approval_required_paths", "dependencies",
    "allowed_dependencies", "external_effects", "delivery",
  ], "harness phase authority");
  strings(authority.allowed_roots, "harness phase authority allowed_roots", { min: 1 });
  strings(authority.protected_paths, "harness phase authority protected_paths");
  strings(authority.approval_required_paths, "harness phase authority approval_required_paths");
  if (!["deny", "allow-listed"].includes(authority.dependencies)) throw new Error("harness phase authority dependencies is invalid");
  if (authority.dependencies === "allow-listed") strings(authority.allowed_dependencies, "harness phase authority allowed_dependencies", { min: 1 });
  else if (authority.allowed_dependencies !== undefined) throw new Error("harness phase authority allowed_dependencies requires allow-listed dependencies");
  if (authority.external_effects !== "none" || authority.delivery !== "repository-only") throw new Error("harness phase authority exceeds the repository-only Workflow boundary");
  return structuredClone(authority);
}

function validateBudgets(value) {
  const budgets = closed(value, ["max_active_minutes", "max_total_tokens", "max_cost_usd"], "harness phase budgets");
  for (const [key, entry] of Object.entries(budgets)) {
    if (entry !== null && (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0 || (key !== "max_cost_usd" && !Number.isInteger(entry)))) {
      throw new Error(`harness phase budgets ${key} must be null or a positive ${key === "max_cost_usd" ? "number" : "integer"}`);
    }
  }
  return structuredClone(budgets);
}

function validateUsage(value) {
  const usage = closed(value, ["active_minutes", "total_tokens", "cost_usd"], "harness phase usage");
  return {
    active_minutes: nonNegativeNumber(usage.active_minutes, "harness phase usage active_minutes"),
    total_tokens: nonNegativeNumber(usage.total_tokens, "harness phase usage total_tokens", { integer: true }),
    cost_usd: nonNegativeNumber(usage.cost_usd, "harness phase usage cost_usd"),
  };
}

export function verificationIntentHash(check) {
  if (!check || !checkPattern.test(String(check["Check ID"] ?? ""))) throw new Error("verification intent requires one Check ID");
  closed(check, [
    "Check ID", "Objectives", "Verification Intent", "Expected Evidence",
    "Required", "Evidence Class", "Cost Class", "Prerequisites",
  ], `verification intent ${check["Check ID"]}`);
  for (const field of ["Objectives", "Verification Intent", "Expected Evidence", "Evidence Class", "Prerequisites"]) {
    if (typeof check[field] !== "string" || !check[field].trim()) throw new Error(`verification intent ${check["Check ID"]} is missing ${field}`);
  }
  return harnessContractHash({
    check_id: check["Check ID"],
    objectives: check.Objectives,
    verification_intent: check["Verification Intent"],
    expected_evidence: check["Expected Evidence"],
    required: check.Required,
    evidence_class: check["Evidence Class"],
    cost_class: check["Cost Class"],
    prerequisites: check.Prerequisites,
  });
}

export function validateHarnessCapabilityReceipt(input) {
  const value = closed(input, [
    "schema", "kind", "harness_id", "harness_version", "deployment_binding_hash", "workspace_binding", "capabilities",
    "qualification_keys", "policy_hash", "issued_at", "expires_at", "content_hash",
  ], "harness capability receipt");
  if (value.schema !== HARNESS_CAPABILITY_RECEIPT_SCHEMA || value.kind !== "harness-capability-receipt") throw new Error("unsupported harness capability receipt");
  if (typeof value.harness_id !== "string" || !value.harness_id.trim()) throw new Error("harness capability receipt requires harness_id");
  if (typeof value.harness_version !== "string" || !value.harness_version.trim()) throw new Error("harness capability receipt requires harness_version");
  exactHash(value.deployment_binding_hash, "harness capability deployment_binding_hash");
  exactHash(value.workspace_binding, "harness capability workspace_binding");
  exactHash(value.policy_hash, "harness capability policy_hash");
  const declared = strings(value.capabilities, "harness capabilities", { min: 1 });
  for (const capability of declared) if (!capabilities.has(capability)) throw new Error(`unsupported harness capability: ${capability}`);
  const issued = Date.parse(value.issued_at);
  const expires = Date.parse(value.expires_at);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) throw new Error("harness capability receipt has invalid validity dates");
  const qualificationKeys = strings(value.qualification_keys ?? [], "harness qualification_keys");
  for (const key of qualificationKeys) if (!/^qk-[A-Za-z0-9][A-Za-z0-9-]*$/.test(key)) throw new Error(`invalid harness qualification key: ${key}`);
  const receipt = { ...value, capabilities: declared, qualification_keys: qualificationKeys };
  const { content_hash: contentHash, ...content } = receipt;
  if (harnessContractHash(content) !== contentHash) throw new Error("harness capability content hash mismatch");
  return receipt;
}

export function validateHarnessPhaseRequest(input) {
  const value = closed(input, [
    "schema", "kind", "phase", "run_id", "run_revision", "transition_id", "idempotency_hash",
    "root_plan_id", "root_hash", "lineage_hashes", "workspace_binding",
    "authority", "verification_intents", "budgets", "review_read_only",
  ], "harness phase request");
  if (value.schema !== HARNESS_PHASE_CONTRACT_SCHEMA || value.kind !== "harness-phase-request") throw new Error("unsupported harness phase request");
  if (!phases.has(value.phase)) throw new Error(`unsupported harness phase: ${value.phase}`);
  if (!/^run-[a-f0-9]{24}$/.test(String(value.run_id ?? ""))) throw new Error("harness phase request requires run_id");
  if (!Number.isInteger(value.run_revision) || value.run_revision < 0) throw new Error("harness phase request requires a non-negative run_revision");
  if (!/^tr-[a-f0-9]{32}$/.test(String(value.transition_id ?? ""))) throw new Error("harness phase request requires transition_id");
  exactHash(value.idempotency_hash, "harness phase idempotency_hash");
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(value.root_plan_id ?? ""))) throw new Error("harness phase request requires root_plan_id");
  exactHash(value.root_hash, "harness phase root_hash");
  exactHash(value.workspace_binding, "harness phase workspace_binding");
  const lineageHashes = strings(value.lineage_hashes ?? [], "harness phase lineage_hashes");
  for (const hash of lineageHashes) exactHash(hash, "harness phase lineage hash");
  const authority = validateAuthority(value.authority);
  if (!Array.isArray(value.verification_intents)) throw new Error("harness phase request requires verification_intents");
  for (const intent of value.verification_intents) verificationIntentHash(intent);
  const budgets = validateBudgets(value.budgets);
  if (value.review_read_only !== (value.phase === "review")) throw new Error("harness phase request review_read_only must match the review phase");
  return { ...structuredClone(value), lineage_hashes: lineageHashes, authority, budgets };
}

export function validateHarnessCheckAttestation(input, expected = {}) {
  const value = closed(input, [
    "schema", "kind", "harness_id", "check_id", "root_hash", "verification_intent_hash",
    "workspace_binding", "workspace_snapshot_hash", "status", "observed", "evidence_hashes", "issued_at", "content_hash",
  ], "harness Check attestation");
  if (value.schema !== HARNESS_CHECK_ATTESTATION_SCHEMA || value.kind !== "harness-check-attestation") throw new Error("unsupported harness Check attestation");
  if (typeof value.harness_id !== "string" || !value.harness_id.trim()) throw new Error("harness Check attestation requires harness_id");
  if (!checkPattern.test(String(value.check_id ?? ""))) throw new Error("harness Check attestation requires check_id");
  exactHash(value.root_hash, "harness Check root_hash");
  exactHash(value.verification_intent_hash, "harness Check verification_intent_hash");
  exactHash(value.workspace_binding, "harness Check workspace_binding");
  exactHash(value.workspace_snapshot_hash, "harness Check workspace_snapshot_hash");
  if (!attestationStatuses.has(value.status)) throw new Error(`unsupported harness Check status: ${value.status}`);
  if (typeof value.observed !== "string" || !value.observed.trim()) throw new Error("harness Check attestation requires observed");
  const evidenceHashes = strings(value.evidence_hashes ?? [], "harness Check evidence_hashes");
  if (value.status === "passed" && evidenceHashes.length === 0) throw new Error("passed harness Check attestation requires evidence_hashes");
  for (const hash of evidenceHashes) exactHash(hash, "harness Check evidence hash");
  if (!Number.isFinite(Date.parse(value.issued_at))) throw new Error("harness Check attestation requires issued_at");
  const attestation = { ...value, evidence_hashes: evidenceHashes };
  const { content_hash: contentHash, ...content } = attestation;
  if (harnessContractHash(content) !== contentHash) throw new Error("harness Check attestation content hash mismatch");
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue != null && attestation[key] !== expectedValue) throw new Error(`harness Check attestation ${key} mismatch`);
  }
  return attestation;
}

export function validateHarnessPhaseResult(input, request, expected = {}) {
  const expectedRequest = validateHarnessPhaseRequest(request);
  const value = closed(input, [
    "schema", "kind", "phase", "status", "harness_id", "deployment_binding_hash", "transition_id",
    "capability_receipt_hash", "phase_request_hash",
    "root_hash", "workspace_binding", "workspace_snapshot_before", "workspace_snapshot_after", "changed_paths",
    "check_attestations", "review_input", "usage", "limitations", "content_hash",
  ], "harness phase result");
  if (value.schema !== HARNESS_PHASE_CONTRACT_SCHEMA || value.kind !== "harness-phase-result") throw new Error("unsupported harness phase result");
  if (value.phase !== expectedRequest.phase || value.root_hash !== expectedRequest.root_hash || value.workspace_binding !== expectedRequest.workspace_binding) throw new Error("harness phase result binding mismatch");
  if (typeof value.harness_id !== "string" || !value.harness_id.trim()) throw new Error("harness phase result requires harness_id");
  exactHash(value.deployment_binding_hash, "harness phase deployment_binding_hash");
  if (value.transition_id !== expectedRequest.transition_id) throw new Error("harness phase result transition_id mismatch");
  exactHash(value.capability_receipt_hash, "harness phase capability receipt hash");
  exactHash(value.phase_request_hash, "harness phase request hash");
  if (value.phase_request_hash !== harnessContractHash(expectedRequest)) throw new Error("harness phase request hash mismatch");
  if (expected.harness_id && value.harness_id !== expected.harness_id) throw new Error("harness phase result harness_id mismatch");
  if (expected.deployment_binding_hash && value.deployment_binding_hash !== expected.deployment_binding_hash) throw new Error("harness phase result deployment_binding_hash mismatch");
  if (expected.capability_receipt_hash && value.capability_receipt_hash !== expected.capability_receipt_hash) throw new Error("harness phase result capability_receipt_hash mismatch");
  if (!phaseStatuses.has(value.status)) throw new Error(`unsupported harness phase status: ${value.status}`);
  exactHash(value.workspace_snapshot_before, "harness phase snapshot before");
  exactHash(value.workspace_snapshot_after, "harness phase snapshot after");
  const changedPaths = strings(value.changed_paths ?? [], "harness phase changed_paths");
  const limitations = strings(value.limitations ?? [], "harness phase limitations");
  const checks = new Map(expectedRequest.verification_intents.map((check) => [check["Check ID"], check]));
  const checkAttestations = (value.check_attestations ?? []).map((attestation) => {
    const planned = checks.get(attestation?.check_id);
    if (!planned) throw new Error(`harness phase result contains unknown Check ${attestation?.check_id}`);
    return validateHarnessCheckAttestation(attestation, {
      harness_id: value.harness_id,
      root_hash: expectedRequest.root_hash,
      verification_intent_hash: verificationIntentHash(planned),
      workspace_binding: expectedRequest.workspace_binding,
      workspace_snapshot_hash: value.workspace_snapshot_after,
    });
  });
  if (new Set(checkAttestations.map((entry) => entry.check_id)).size !== checkAttestations.length) throw new Error("harness phase result repeats a Check attestation");
  if (expectedRequest.phase === "review" && value.workspace_snapshot_before !== value.workspace_snapshot_after) throw new Error("harness review result changed the repository snapshot");
  if (value.review_input !== undefined && expectedRequest.phase !== "review") throw new Error("harness phase review_input is allowed only for review");
  if (value.review_input !== undefined && (!value.review_input || typeof value.review_input !== "object" || Array.isArray(value.review_input))) {
    throw new Error("harness review_input must be an object");
  }
  const usage = validateUsage(value.usage);
  const result = { ...value, changed_paths: changedPaths, limitations, check_attestations: checkAttestations, usage };
  const { content_hash: contentHash, ...content } = result;
  if (harnessContractHash(content) !== contentHash) throw new Error("harness phase result content hash mismatch");
  return result;
}

export function calibrateHarnessCheckEvidence({
  entries,
  plannedChecks,
  attestations = [],
  rootHash,
  workspaceBinding,
  workspaceSnapshotHash,
  expectedHarnessId = null,
  protectedAttestationHash = null,
}) {
  const planned = plannedChecks instanceof Map ? plannedChecks : new Map((plannedChecks ?? []).map((check) => [check["Check ID"], check]));
  const validated = new Map();
  for (const input of attestations) {
    const check = planned.get(input?.check_id);
    if (!check) throw new Error(`harness attestation references unknown Check ${input?.check_id}`);
    const attestation = validateHarnessCheckAttestation(input, {
      harness_id: expectedHarnessId,
      root_hash: rootHash,
      verification_intent_hash: verificationIntentHash(check),
      workspace_binding: workspaceBinding,
      workspace_snapshot_hash: workspaceSnapshotHash,
    });
    if (validated.has(attestation.check_id)) throw new Error(`multiple harness attestations for ${attestation.check_id}`);
    validated.set(attestation.check_id, attestation);
  }
  return entries.map((entry) => {
    const check = planned.get(entry.check_id);
    if (!check) return entry;
    const attestation = validated.get(entry.check_id) ?? null;
    if (attestation?.status === "failed") return {
      ...entry,
      grade: "failed",
      observed: attestation.observed,
      evidence_hashes: attestation.evidence_hashes,
      ...(protectedAttestationHash ? { attestation_hash: protectedAttestationHash } : {}),
      limitations: [...new Set([...(entry.limitations ?? []), "The project harness attested a failed Check for the current repository snapshot."])],
    };
    if (attestation?.status === "passed" && protectedAttestationHash) return {
      ...entry,
      grade: check["Evidence Class"] === "human-decision-required" ? "supported" : "verified",
      observed: attestation.observed,
      evidence_hashes: attestation.evidence_hashes,
      attestation_hash: protectedAttestationHash,
      limitations: check["Evidence Class"] === "human-decision-required"
        ? [...new Set([
            ...(entry.limitations ?? []).filter((limitation) => !/harness|attestation/i.test(limitation)),
            "The project harness attested its observation, but this Check still requires an explicit human decision.",
          ])]
        : (entry.limitations ?? []).filter((limitation) => !/harness|attestation/i.test(limitation)),
    };
    if (attestation?.status === "unavailable") return {
      ...entry,
      grade: "unavailable",
      observed: attestation.observed,
      evidence_hashes: attestation.evidence_hashes,
      ...(protectedAttestationHash ? { attestation_hash: protectedAttestationHash } : {}),
      limitations: [...new Set([...(entry.limitations ?? []), "The project harness reported this Check as unavailable."])],
    };
    if (attestation?.status === "passed" && !protectedAttestationHash) return {
      ...entry,
      grade: "supported",
      observed: attestation.observed,
      evidence_hashes: attestation.evidence_hashes,
      limitations: [...new Set([
        ...(entry.limitations ?? []),
        "The project harness reported a passing Check, but no protected host receipt binds it to this transition.",
      ])],
    };
    if (entry.grade !== "verified") return entry;
    return {
      ...entry,
      grade: "supported",
      evidence_hashes: entry.evidence_hashes ?? [],
      limitations: [...new Set([
        ...(entry.limitations ?? []),
        "No protected project-harness attestation binds this Check to the current Root and repository snapshot.",
      ])],
    };
  });
}

export function harnessConstraintProjection({ checks = [], evidence = [], pending = false }) {
  const required = checks.filter((check) => check.Required === "yes");
  const byId = new Map((evidence ?? []).map((entry) => [entry.check_id, entry]));
  const ids = (predicate) => required.filter(predicate).map((check) => check["Check ID"]);
  const attested = ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return entry?.grade === "verified" && hashPattern.test(String(entry.attestation_hash ?? ""));
  });
  const failed = ids((check) => byId.get(check["Check ID"])?.grade === "failed");
  const gaps = pending ? [] : ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return !entry || ["supported", "partial", "unavailable"].includes(entry.grade);
  });
  const humanDecision = ids((check) => check["Evidence Class"] === "human-decision-required");
  const reasons = pending ? [] : [
    ...failed.map((checkId) => ({ code: "check-failed", check_id: checkId, message: `${checkId} failed and blocks delivery.`, recovery: `Resolve the cause and ask the project harness to attest ${checkId} again.` })),
    ...gaps.map((checkId) => ({ code: "harness-evidence-gap", check_id: checkId, message: `${checkId} is not bound to sufficient project-harness evidence.`, recovery: `Have the active project harness observe ${checkId} and return a protected attestation.` })),
    ...humanDecision.map((checkId) => ({ code: "human-decision-required", check_id: checkId, message: `${checkId} requires an explicit human decision.`, recovery: `Request the named human decision before continuing.` })),
  ];
  return {
    constraint_summary: {
      schema: 2,
      scope: "current-delivery",
      required_checks: required.map((check) => check["Check ID"]),
      harness_attested_checks: attested,
      human_decision_checks: humanDecision,
      failed_checks: failed,
      evidence_gap_checks: gaps,
      attestation_coverage: { attested: attested.length, eligible: required.length },
    },
    human_attention: { required: reasons.length > 0, reasons },
    problem_details: reasons.map((reason) => ({
      problem: reason.message,
      why: reason.code === "check-failed"
        ? "A required failed Check blocks delivery."
        : reason.code === "harness-evidence-gap"
          ? "Workflow does not interpret concrete execution and therefore needs a protected harness attestation for verified evidence."
          : "This Check is reserved for human authority.",
      resolution: reason.recovery,
      blocking: ["check-failed", "human-decision-required"].includes(reason.code),
      check_id: reason.check_id,
    })),
  };
}
