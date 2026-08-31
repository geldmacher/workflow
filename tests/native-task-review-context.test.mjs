import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  beginNativeCorrection,
  cleanupNativeTaskReviewContext,
  consumeNativeReviewReceipt,
  failNativeReview,
  observeNativeCreatePlan,
  observeNativeCreatePlanAtStop,
  observeNativeReviewResult,
  prepareNativeReviewReceipt,
  recoverNativeReviewSelection,
  selectNativeReviewRoot,
  validateConsumedNativeReviewReceipt,
} from "../hooks/native-task-review-context.mjs";
import {
  atomicNativeReviewReceipt,
  commitNativeReviewInvocationResult,
  nativeReviewReceiptBindingHash,
  nativeReviewReceiptPath,
  nativeReviewRequestHash,
  replayNativeReviewInvocationResult,
} from "../hooks/native-review-receipt.mjs";
import { hashWorkflowIdentifier } from "../hooks/workflow-state.mjs";
import { defaultRoot, executionContractFromArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import {
  HARNESS_CHECK_ATTESTATION_SCHEMA,
  harnessContractHash,
  verificationIntentHash,
} from "../src/core/harness-attestations.mjs";
import { withNativeStateLock } from "../src/harness/native-task-review-state.mjs";
import { nativePlan, supportedCheck } from "./support/workflow-fixtures.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const baseline = Object.freeze({
  schema: 1,
  repository_root: defaultRoot,
  head: "a".repeat(40),
  dirty_paths: [],
  fingerprints: {},
  index_fingerprint: "b".repeat(64),
  status_fingerprint: "c".repeat(64),
  working_tree: "clean",
  captured_at: "2026-08-25T10:00:00.000Z",
});

function planEvent() {
  return {
    hook_event_name: "postToolUse",
    tool_name: "CreatePlan",
    conversation_id: "conversation-v6",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
  };
}

function selectionEvent() {
  return {
    hook_event_name: "beforeSubmitPrompt",
    conversation_id: "conversation-v6",
    generation_id: "review-generation",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    prompt: "/review-work",
  };
}

function reviewEvent(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "MCP:workflow_closeout",
    conversation_id: "conversation-v6",
    generation_id: "review-generation",
    tool_use_id: "review-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: {
      artifact_kind: "work-review",
      review_input: {
        schema: 1,
        kind: "review-input",
        outcome: "achieved",
        assessment_summary: "Repository-supported evidence satisfies the Root.",
        snapshot_summary: "The repository snapshot is stable.",
        findings: [],
        open_points: [],
      },
      check_evidence: [supportedCheck()],
    },
    ...overrides,
  };
}

function options() {
  return { captureSnapshot: () => structuredClone(baseline), workspaceRoot: defaultRoot };
}

function establish(stateRoot) {
  assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: options() }).status, "observed");
  assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
}

function conversationFile(stateRoot, conversationId = "conversation-v6") {
  return join(
    stateRoot,
    "manual-native-task-review",
    "conversations",
    `${hashWorkflowIdentifier("conversation", conversationId)}.json`,
  );
}

function writeTranscript(directory, conversationId, entries) {
  const path = join(directory, `${conversationId}.jsonl`);
  writeFileSync(path, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  return path;
}

function createPlanTranscriptEntry(plan = rootPlan, extras = []) {
  return {
    role: "assistant",
    message: {
      content: [
        ...extras,
        { type: "tool_use", name: "CreatePlan", input: { name: "Workflow 6", plan, todos: [] } },
      ],
    },
  };
}

function reviewOutput(bundle) {
  return {
    structuredContent: {
      artifact_kind: "work-review",
      root_plan_id: bundle.root_plan_id,
      delivery_evidence_artifact: bundle.delivery_evidence.artifact,
      delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
      artifact: bundle.review.artifact,
      artifact_hash: bundle.review.artifact_hash,
      review_input_hash: bundle.review.review_input_hash,
      repository_state_hash: bundle.repository_state_hash,
      chain_update: bundle.chain_update,
    },
  };
}

function provisionalReviewInput() {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "achieved",
    assessment_summary: "Repository-supported evidence satisfies the exact Root.",
    snapshot_summary: "No repository contradiction was observed.",
    findings: [],
    open_points: [],
  };
}

function verifiedReviewInput() {
  return {
    ...provisionalReviewInput(),
    assessment_summary: "Fresh protected evidence satisfies the exact Root.",
  };
}

function verifiedPhaseResult(workspaceBinding, snapshotHash) {
  const check = executionContractFromArtifactText(rootPlan, defaultRoot).checks[0];
  const raw = {
    schema: HARNESS_CHECK_ATTESTATION_SCHEMA,
    kind: "harness-check-attestation",
    harness_id: "project-harness",
    check_id: "CHECK-1",
    root_hash: createHash("sha256").update(rootPlan).digest("hex"),
    verification_intent_hash: verificationIntentHash(check),
    workspace_binding: workspaceBinding,
    workspace_snapshot_hash: snapshotHash,
    status: "passed",
    observed: "The protected sealing verification passed.",
    evidence_hashes: ["f".repeat(64)],
    issued_at: "2026-08-25T10:00:00.000Z",
  };
  return {
    status: "completed",
    harness_id: "project-harness",
    workspace_snapshot_before: snapshotHash,
    workspace_snapshot_after: snapshotHash,
    changed_paths: [],
    check_attestations: [{ ...raw, content_hash: harnessContractHash(raw) }],
  };
}

function correctionReviewInput() {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "correction-needed",
    assessment_summary: "One Root-bounded outcome remains incomplete.",
    snapshot_summary: "The repository state is consistent with the finding.",
    findings: [{
      key: "outcome-gap",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The required outcome is incomplete.",
      reasoning: "Acceptance is not established yet.",
      resolution: "correct",
    }],
    open_points: [],
    correction: {
      fixes: [{ key: "close-gap", finding_keys: ["outcome-gap"], required_outcome: "Complete the outcome.", evidence: "The gap is Root-bounded." }],
      steps: [{
        key: "apply-gap",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Complete the outcome.",
        implementation_latitude: "The project Harness chooses execution.",
        completion_probe: "The required outcome is observable.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report an Open Point if Root authority changes.",
      }],
    },
  };
}

function writeReceiptCandidate(path, receipt, mutate, { preserveBinding = false } = {}) {
  const candidate = structuredClone(receipt);
  mutate(candidate);
  if (!preserveBinding) candidate.binding_hash = nativeReviewReceiptBindingHash(candidate);
  writeFileSync(path, `${JSON.stringify(candidate)}\n`);
}

test("native Review injects the exact active Root identity and canonical workspace with its opaque receipt", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.updated_input.root_plan_id, "wp-adaptive-retry");
    assert.equal(prepared.updated_input.workspace_root, defaultRoot);
    assert.equal(typeof prepared.updated_input.native_review_receipt, "string");

    const consumed = consumeNativeReviewReceipt({
      stateRoot,
      token: prepared.token,
      input: prepared.updated_input,
    });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
    assert.equal(consumed.receipt.workspace_root, defaultRoot);
    assert.equal(consumed.receipt.root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("a recoverable Review failure revokes only the receipt and preserves Root selection for retry", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const event = reviewEvent();
    const first = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    assert.equal(first.status, "prepared");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: event, options: options() }).status, "revoked");
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: first.token, input: first.updated_input }).status, "unavailable");

    const second = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    assert.equal(second.status, "prepared");
    assert.notEqual(second.token, first.token);
    assert.equal(second.updated_input.root_plan_id, "wp-adaptive-retry");
    assert.equal(second.updated_input.workspace_root, defaultRoot);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("missing Review selection is distinct from a missing active Root", () => {
  const emptyState = mkdtempSync(join(tmpdir(), "workflow-v6-native-empty-"));
  const rootedState = mkdtempSync(join(tmpdir(), "workflow-v6-native-rooted-"));
  try {
    const noRoot = prepareNativeReviewReceipt({ stateRoots: [emptyState], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(noRoot.status, "unavailable");
    assert.equal(noRoot.reason, "root-unavailable");

    assert.equal(observeNativeCreatePlan({ stateRoots: [rootedState], input: planEvent(), pluginRoot: defaultRoot, options: options() }).status, "observed");
    const noSelection = prepareNativeReviewReceipt({ stateRoots: [rootedState], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(noSelection.status, "unavailable");
    assert.equal(noSelection.reason, "review-selection-unavailable");
    assert.equal(noSelection.root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(emptyState, { recursive: true, force: true });
    rmSync(rootedState, { recursive: true, force: true });
  }
});

test("native Review never classifies harness commands or tools", () => {
  const source = readFileSync(join(defaultRoot, "hooks", "native-task-review-context.mjs"), "utf8");
  for (const forbidden of ["parseHostCommand", "runHostCheck", "program-not-classified", "unapproved-root-check", "authorizeNativeReviewShell"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});

test("completed native transcript binds exactly one Schema-6 CreatePlan", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-transcript-"));
  try {
    const transcript = writeTranscript(transcriptRoot, "conversation-v6", [
      { type: "turn_ended", status: "success" },
      createPlanTranscriptEntry(),
      { type: "turn_ended", status: "success" },
    ]);
    const observed = observeNativeCreatePlanAtStop({
      stateRoots: [stateRoot],
      input: { ...planEvent(), transcript_path: transcript, generation_id: "transcript-generation" },
      markerStartedAt: "2026-08-25T09:59:00.000Z",
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(observed.status, "observed");
    assert.equal(observed.root_binding.source, "task-transcript-stop");
    assert.equal(JSON.parse(readFileSync(conversationFile(stateRoot), "utf8")).active.root_text, rootPlan);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("transcript binding rejects incomplete, ambiguous, foreign, and invalid Root observations", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-transcript-"));
  try {
    const cases = [
      {
        name: "incomplete",
        entries: [createPlanTranscriptEntry()],
        expected: "native-plan-transcript-turn-incomplete",
      },
      {
        name: "ambiguous",
        entries: [createPlanTranscriptEntry(rootPlan, [{ type: "tool_use", name: "CreatePlan", input: { name: "Other", plan: rootPlan } }]), { type: "turn_ended", status: "success" }],
        expected: "native-plan-transcript-create-plan-ambiguous",
      },
      {
        name: "invalid-root",
        entries: [createPlanTranscriptEntry("not a Root"), { type: "turn_ended", status: "success" }],
        expected: "native-plan-transcript-root-invalid",
      },
    ];
    for (const [index, entry] of cases.entries()) {
      const conversationId = `conversation-case-${index}`;
      const transcript = writeTranscript(transcriptRoot, conversationId, entry.entries);
      const observed = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: { ...planEvent(), conversation_id: conversationId, transcript_path: transcript, generation_id: `generation-${index}` },
        markerStartedAt: "2026-08-25T09:59:00.000Z",
        pluginRoot: defaultRoot,
        options: { ...options(), planDirectory: transcriptRoot },
      });
      assert.ok(["invalid", "ambiguous"].includes(observed.status), entry.name);
      assert.ok(observed.reason_codes.includes(entry.expected), entry.name);
    }
    const foreign = writeTranscript(transcriptRoot, "actual-conversation", [createPlanTranscriptEntry(), { type: "turn_ended", status: "success" }]);
    const observed = observeNativeCreatePlanAtStop({
      stateRoots: [stateRoot],
      input: { ...planEvent(), conversation_id: "foreign-conversation", transcript_path: foreign },
      markerStartedAt: "2026-08-25T09:59:00.000Z",
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(observed.status, "invalid");
    assert.ok(observed.reason_codes.includes("native-plan-transcript-conversation-mismatch"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("native Plan transcript observation rejects unsafe files before reading Root authority", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-transcript-"));
  try {
    const observe = (path, expected) => {
      const result = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: { ...planEvent(), transcript_path: path, generation_id: `unsafe-${expected}` },
        markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
        pluginRoot: defaultRoot,
        options: { ...options(), planDirectory: transcriptRoot },
      });
      assert.ok(result.reason_codes.includes(expected));
    };
    observe(join(transcriptRoot, "missing.jsonl"), "native-plan-file-missing");
    observe(transcriptRoot, "native-plan-transcript-file-invalid");
    const target = writeTranscript(transcriptRoot, "target", [{ type: "turn_ended", status: "success" }]);
    const linked = join(transcriptRoot, "conversation-v6.jsonl");
    symlinkSync(target, linked);
    observe(linked, "native-plan-transcript-file-invalid");
    rmSync(linked);
    const oversized = join(transcriptRoot, "conversation-v6.jsonl");
    writeFileSync(oversized, "");
    truncateSync(oversized, 32 * 1024 * 1024 + 1);
    observe(oversized, "native-plan-transcript-oversized");
    writeFileSync(oversized, "not-json\n");
    observe(oversized, "native-plan-transcript-invalid");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("missing transcript may bind one recent native Plan file only provisionally", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const planDirectory = mkdtempSync(join(tmpdir(), "workflow-v6-plans-"));
  const now = new Date("2026-08-25T10:00:00.000Z");
  try {
    const planPath = join(planDirectory, "workflow-6.plan.md");
    writeFileSync(planPath, `---\nname: Workflow 6\noverview: Harness boundary\ntodos: []\nisProject: false\n---\n${rootPlan}`);
    utimesSync(planPath, now, now);
    const observed = observeNativeCreatePlanAtStop({
      stateRoots: [stateRoot],
      input: { ...planEvent(), transcript_path: undefined, generation_id: "file-generation" },
      markerStartedAt: "2026-08-25T09:59:00.000Z",
      pluginRoot: defaultRoot,
      options: { ...options(), planDirectory, now: () => now },
    });
    assert.equal(observed.status, "observed");
    assert.equal(observed.root_binding.status, "provisional");
    assert.equal(observed.root_binding.source, "recent-plan-file-stop");

    const selected = selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(selected.status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_source, "cursor-plan-file");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(planDirectory, { recursive: true, force: true });
  }
});

test("native Plan file fallback rejects absent, ambiguous, symlinked, and malformed candidates", () => {
  const now = new Date("2026-08-25T10:00:00.000Z");
  const validSource = `---\nname: Workflow 6\ntodos: []\n---\n${rootPlan}`;
  for (const scenario of ["absent", "ambiguous", "symlink", "malformed"]) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
    const planDirectory = mkdtempSync(join(tmpdir(), "workflow-v6-plans-"));
    try {
      if (scenario === "ambiguous") {
        for (const name of ["one.plan.md", "two.plan.md"]) {
          const path = join(planDirectory, name);
          writeFileSync(path, validSource);
          utimesSync(path, now, now);
        }
      } else if (scenario === "symlink") {
        const target = join(planDirectory, "target.txt");
        writeFileSync(target, validSource);
        symlinkSync(target, join(planDirectory, "linked.plan.md"));
      } else if (scenario === "malformed") {
        const path = join(planDirectory, "broken.plan.md");
        writeFileSync(path, "not a native Plan file");
        utimesSync(path, now, now);
      }
      const result = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: { ...planEvent(), transcript_path: undefined, generation_id: `file-${scenario}` },
        markerStartedAt: "2026-08-25T09:59:00.000Z",
        pluginRoot: defaultRoot,
        options: { ...options(), planDirectory, now: () => now },
      });
      assert.notEqual(result.status, "observed", scenario);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
      rmSync(planDirectory, { recursive: true, force: true });
    }
  }
});

test("native Plan file fallback rejects unavailable directories, directory entries, and oversized files", () => {
  const missingDirectory = join(tmpdir(), `workflow-v6-missing-plans-${process.pid}-${Date.now()}`);
  const unavailableState = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const now = new Date();
  try {
    const missing = observeNativeCreatePlanAtStop({
      stateRoots: [unavailableState],
      input: { ...planEvent(), transcript_path: undefined, generation_id: "missing-plan-directory" },
      markerStartedAt: new Date(now.getTime() - 1_000).toISOString(),
      pluginRoot: defaultRoot,
      options: { ...options(), planDirectory: missingDirectory, now: () => now },
    });
    assert.ok(missing.reason_codes.includes("native-plan-file-missing"));
  } finally {
    rmSync(unavailableState, { recursive: true, force: true });
  }

  for (const scenario of ["directory", "oversized"]) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
    const planDirectory = mkdtempSync(join(tmpdir(), "workflow-v6-plans-"));
    try {
      const path = join(planDirectory, `${scenario}.plan.md`);
      if (scenario === "directory") mkdirSync(path);
      else {
        writeFileSync(path, "");
        truncateSync(path, 2 * 1024 * 1024 + 1);
      }
      utimesSync(path, now, now);
      const result = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: { ...planEvent(), transcript_path: undefined, generation_id: `plan-${scenario}` },
        markerStartedAt: new Date(now.getTime() - 1_000).toISOString(),
        pluginRoot: defaultRoot,
        options: { ...options(), planDirectory, now: () => now },
      });
      assert.ok(result.reason_codes.includes(scenario === "directory" ? "native-plan-file-invalid" : "native-plan-file-oversized"));
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
      rmSync(planDirectory, { recursive: true, force: true });
    }
  }
});

test("native Root workspace binding accepts exactly one canonical repository", () => {
  const cases = [
    { workspace_roots: [], cwd: defaultRoot, expected: defaultRoot },
    { workspace_roots: [defaultRoot, defaultRoot], cwd: defaultRoot, expected: defaultRoot },
    { workspace_roots: [defaultRoot, "/tmp"], cwd: defaultRoot, expected: null },
  ];
  for (const [index, scenario] of cases.entries()) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
    try {
      const event = { ...planEvent(), generation_id: `workspace-${index}`, workspace_roots: scenario.workspace_roots, cwd: scenario.cwd };
      const result = observeNativeCreatePlan({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: { captureSnapshot: () => structuredClone(baseline) } });
      assert.equal(result.status, "observed");
      assert.equal(JSON.parse(readFileSync(conversationFile(stateRoot), "utf8")).active.workspace_root, scenario.expected);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  }
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const otherRoot = mkdtempSync(join(tmpdir(), "workflow-v6-other-repository-"));
  try {
    const fakeGit = (_command, args) => ({ status: 0, stdout: `${args[1]}\n`, stderr: "" });
    const event = { ...planEvent(), generation_id: "multiple-workspaces", workspace_roots: [defaultRoot, otherRoot] };
    const result = observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: event,
      pluginRoot: defaultRoot,
      options: { captureSnapshot: () => structuredClone(baseline), spawnSync: fakeGit },
    });
    assert.equal(result.status, "observed");
    assert.equal(JSON.parse(readFileSync(conversationFile(stateRoot), "utf8")).active.workspace_root, null);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(otherRoot, { recursive: true, force: true });
  }
});

test("a schema-valid Root with malformed authority grammar never becomes active", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    const infeasible = rootPlan.replace("allowed_roots:\n    - src", "allowed_roots:\n    - src/ab**cd");
    const result = observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: { ...planEvent(), tool_input: { name: "Infeasible", plan: infeasible, todos: [] } },
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(result.status, "superseded");
    const stored = JSON.parse(readFileSync(conversationFile(stateRoot), "utf8"));
    assert.equal(stored.root_status, "superseded");
    assert.deepEqual(stored.last_plan_observation.reason_codes, ["native-plan-root-invalid"]);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("CreatePlan transitions are exact, idempotent, and fail closed on ambiguity", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    const first = observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(first.status, "observed");
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: options() }).duplicate, true);
    const conflicting = planEvent();
    conflicting.tool_use_id = "different-create-plan-call";
    conflicting.tool_input = { ...conflicting.tool_input, plan: nativePlan("manual", { id: "wp-adaptive-retry-conflict" }) };
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: conflicting, pluginRoot: defaultRoot, options: options() }).status, "ambiguous");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "ambiguous");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("direct CreatePlan binding outranks transcript and Plan-file recovery", () => {
  const directState = mkdtempSync(join(tmpdir(), "workflow-v6-native-priority-"));
  const recoveredState = mkdtempSync(join(tmpdir(), "workflow-v6-native-priority-"));
  const planDirectory = mkdtempSync(join(tmpdir(), "workflow-v6-plan-priority-"));
  try {
    const direct = observeNativeCreatePlan({ stateRoots: [directState], input: planEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(direct.root_binding.priority, 3);
    const preserved = observeNativeCreatePlanAtStop({
      stateRoots: [directState],
      input: planEvent(),
      markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
      pluginRoot: defaultRoot,
      options: { ...options(), planDirectory },
    });
    assert.equal(preserved.preserved, true);
    assert.equal(preserved.root_binding.priority, 3);

    const planFile = `---\nname: Workflow 6\ntodos: []\n---\n${rootPlan}`;
    writeFileSync(join(planDirectory, "priority.plan.md"), planFile);
    const provisional = observeNativeCreatePlanAtStop({
      stateRoots: [recoveredState],
      input: planEvent(),
      markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
      pluginRoot: defaultRoot,
      options: { ...options(), planDirectory },
    });
    assert.equal(provisional.root_binding.priority, 1);
    const upgraded = observeNativeCreatePlan({ stateRoots: [recoveredState], input: planEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(upgraded.upgraded, true);
    assert.equal(upgraded.root_binding.priority, 3);
    const stored = JSON.parse(readFileSync(conversationFile(recoveredState), "utf8"));
    assert.equal(stored.active.root_binding.priority, 3);
  } finally {
    rmSync(directState, { recursive: true, force: true });
    rmSync(recoveredState, { recursive: true, force: true });
    rmSync(planDirectory, { recursive: true, force: true });
  }
});

test("stale ephemeral native state grants no authority and a fresh CreatePlan replaces it", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-version-"));
  try {
    establish(stateRoot);
    const path = conversationFile(stateRoot);
    const stale = JSON.parse(readFileSync(path, "utf8"));
    delete stale.state_version;
    writeFileSync(path, `${JSON.stringify(stale)}\n`);
    const unavailable = selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(unavailable.status, "unavailable");
    assert.equal(unavailable.reason, "state-version-unavailable");
    assert.deepEqual(unavailable.reason_codes, ["native-state-version-unavailable"]);

    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: options() }).status, "observed");
    const refreshed = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(refreshed.state_version, 2);
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("invalid replacement Root supersedes prior authority without recovering prose", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const invalid = { ...planEvent(), generation_id: "replacement", tool_use_id: "replacement-call", tool_input: { name: "Invalid", plan: "plain prose" } };
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: invalid, pluginRoot: defaultRoot, options: options() }).status, "superseded");
    const selected = selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(selected.status, "unavailable");
    assert.ok(selected.validation_errors.length > 0);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("exact transcript recovers only Review activation and preserves Root authority", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-transcript-"));
  try {
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: options() }).status, "observed");
    const transcript = writeTranscript(transcriptRoot, "conversation-v6", [
      { role: "user", message: { content: [{ type: "text", text: "/review-work" }] } },
    ]);
    const input = { ...reviewEvent(), transcript_path: transcript };
    const recovered = recoverNativeReviewSelection({ stateRoots: [stateRoot], input, pluginRoot: defaultRoot, options: options() });
    assert.equal(recovered.status, "selected-provisional");
    assert.equal(recovered.review_enforcement.status, "unavailable");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input, pluginRoot: defaultRoot, options: options() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
    assert.equal(consumed.receipt.review_enforcement.status, "unavailable");

    const notExact = writeTranscript(transcriptRoot, "conversation-v6", [
      { role: "user", message: { content: [{ type: "text", text: "please /review-work" }] } },
    ]);
    assert.equal(recoverNativeReviewSelection({
      stateRoots: [stateRoot],
      input: { ...reviewEvent({ generation_id: "another-review" }), transcript_path: notExact },
      pluginRoot: defaultRoot,
      options: options(),
    }).status, "unavailable");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("Review transcript recovery rejects every ambiguous host binding", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-transcript-"));
  try {
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: options() }).status, "observed");
    const recover = (path, expectedReason, overrides = {}, customOptions = options()) => {
      const result = recoverNativeReviewSelection({
        stateRoots: [stateRoot],
        input: { ...reviewEvent({ generation_id: `recovery-${expectedReason}` }), transcript_path: path, ...overrides },
        pluginRoot: defaultRoot,
        options: customOptions,
      });
      assert.equal(result.reason, expectedReason);
    };

    recover(transcriptRoot, "transcript-path-invalid");
    const target = writeTranscript(transcriptRoot, "target", [{ role: "user", content: "/review-work" }]);
    const linked = join(transcriptRoot, "conversation-v6.jsonl");
    symlinkSync(target, linked);
    recover(linked, "transcript-path-invalid");
    rmSync(linked);

    const oversized = join(transcriptRoot, "conversation-v6.jsonl");
    writeFileSync(oversized, "");
    truncateSync(oversized, 32 * 1024 * 1024 + 1);
    recover(oversized, "transcript-path-invalid");
    rmSync(oversized);

    const wrongName = writeTranscript(transcriptRoot, "foreign", [{ role: "user", content: "/review-work" }]);
    recover(wrongName, "transcript-conversation-mismatch");
    const empty = join(transcriptRoot, "conversation-v6.jsonl");
    writeFileSync(empty, "");
    recover(empty, "transcript-empty");
    writeFileSync(empty, "not-json\n");
    recover(empty, "transcript-invalid");
    writeTranscript(transcriptRoot, "conversation-v6", [{ role: "assistant", content: "ignored" }]);
    recover(empty, "transcript-user-message-invalid");
    writeTranscript(transcriptRoot, "conversation-v6", [{ role: "user", message: { content: [] } }]);
    recover(empty, "transcript-user-message-invalid");
    writeTranscript(transcriptRoot, "conversation-v6", [{ role: "user", message: { content: [{ type: "image", text: "/review-work" }] } }]);
    recover(empty, "transcript-user-message-invalid");
    writeTranscript(transcriptRoot, "conversation-v6", [{ role: "user", content: "/review-work" }]);
    recover(empty, "recovery-workspace-mismatch", {}, { workspaceRoot: "/tmp" });
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("receipt binding rejects caller tokens, semantic drift, expiration, replay, and tampering", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    assert.equal(prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ tool_input: { ...reviewEvent().tool_input, native_review_receipt: "caller" } }),
      pluginRoot: defaultRoot,
      options: options(),
    }).status, "mismatch");

    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() }).duplicate, true);
    const otherCall = reviewEvent({ tool_use_id: "other-call" });
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: otherCall, pluginRoot: defaultRoot, options: options() }).status, "busy");
    assert.equal(consumeNativeReviewReceipt({
      stateRoot,
      token: prepared.token,
      input: { ...prepared.updated_input, summary: "semantic drift" },
    }).status, "mismatch");
    const resolved = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(resolved.status, "resolved");
    assert.equal(validateConsumedNativeReviewReceipt({ stateRoot, receipt: resolved.receipt }).status, "valid");
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }).status, "replayed");
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: { ...prepared.updated_input, summary: "other" } }).status, "mismatch");

    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: reviewEvent(), options: options() }).status, "revoked");
    assert.equal(validateConsumedNativeReviewReceipt({ stateRoot, receipt: resolved.receipt }).status, "drift");

    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
    const expiring = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ tool_use_id: "expiring-call" }),
      pluginRoot: defaultRoot,
      options: { ...options(), now: () => new Date("2026-08-25T10:00:00.000Z") },
    });
    assert.equal(consumeNativeReviewReceipt({
      stateRoot,
      token: expiring.token,
      input: expiring.updated_input,
      options: { now: () => new Date("2026-08-25T10:06:00.000Z") },
    }).status, "expired");
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: expiring.token, input: expiring.updated_input }).status, "expired");

    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
    const tampered = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent({ tool_use_id: "tampered-call" }), pluginRoot: defaultRoot, options: options() });
    const receiptPath = nativeReviewReceiptPath(stateRoot, tampered.token, "pending");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    writeFileSync(receiptPath, `${JSON.stringify({ ...receipt, root_plan_id: "foreign-root" })}\n`);
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: tampered.token, input: tampered.updated_input }).status, "mismatch");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("receipt request and binding hashes are canonical and lifecycle-neutral", () => {
  const semantic = { artifact_kind: "work-review", check_evidence: [], review_input: provisionalReviewInput() };
  assert.equal(nativeReviewRequestHash(semantic), nativeReviewRequestHash({ review_input: semantic.review_input, check_evidence: [], artifact_kind: "work-review" }));
  const sealArtifacts = [{ label: "evidence", text: "exact evidence bytes" }, { label: "review", text: "exact review bytes" }];
  assert.notEqual(
    nativeReviewRequestHash({ ...semantic, seal_artifacts: sealArtifacts }),
    nativeReviewRequestHash({ ...semantic, seal_artifacts: [{ ...sealArtifacts[0], text: "changed evidence bytes" }, sealArtifacts[1]] }),
  );
  const receipt = { schema: 6, kind: "cursor-native-review-receipt", nested: { b: 2, a: 1 } };
  const binding = nativeReviewReceiptBindingHash(receipt);
  assert.equal(binding, nativeReviewReceiptBindingHash({ ...receipt, consumed_at: "later", binding_hash: "ignored" }));
  assert.equal(nativeReviewReceiptBindingHash(null), null);
  assert.equal(nativeReviewReceiptBindingHash([]), null);
  assert.equal(nativeReviewReceiptPath("/tmp/state", "not-a-token"), null);
  const receiptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-large-receipt-"));
  try {
    assert.throws(
      () => atomicNativeReviewReceipt(join(receiptRoot, "receipt.json"), { payload: "x".repeat(2 * 1024 * 1024) }),
      /exceeds size limit/,
    );
  } finally {
    rmSync(receiptRoot, { recursive: true, force: true });
  }
});

test("native Review result commit is idempotent and input-bound", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-result-"));
  try {
    assert.equal(commitNativeReviewInvocationResult({ stateRoot, token: "invalid", input: {}, receipt: null, payload: null }).status, "unavailable");
    assert.equal(replayNativeReviewInvocationResult({ stateRoot, token: "invalid", input: {}, receipt: null }).status, "unavailable");
    establish(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(replayNativeReviewInvocationResult({
      stateRoot,
      token: prepared.token,
      input: prepared.updated_input,
      receipt: consumed.receipt,
    }).status, "unavailable");
    const payload = {
      artifact_kind: "work-review",
      root_plan_id: consumed.receipt.root_plan_id,
      repository_state_hash: "f".repeat(64),
      outcome: "open-points",
    };
    const commit = (candidate) => commitNativeReviewInvocationResult({
      stateRoot,
      token: prepared.token,
      input: prepared.updated_input,
      receipt: consumed.receipt,
      payload: candidate,
      options: options(),
    });
    assert.equal(commitNativeReviewInvocationResult({
      stateRoot,
      token: prepared.token,
      input: prepared.updated_input,
      receipt: { ...consumed.receipt, binding_hash: "invalid" },
      payload,
      options: options(),
    }).status, "mismatch");
    assert.equal(commit({ ...payload, artifact_kind: "delivery-evidence" }).status, "invalid");
    assert.equal(commit(payload).status, "committed");
    assert.equal(commit(payload).duplicate, true);
    assert.equal(commit({ ...payload, outcome: "achieved" }).status, "conflict");
    assert.equal(replayNativeReviewInvocationResult({
      stateRoot,
      token: prepared.token,
      input: prepared.updated_input,
      receipt: consumed.receipt,
    }).status, "resolved");
    assert.equal(replayNativeReviewInvocationResult({
      stateRoot,
      token: prepared.token,
      input: { ...prepared.updated_input, summary: "changed" },
      receipt: consumed.receipt,
    }).status, "mismatch");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("every protected receipt binding rejects its own forged or malformed value", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    const receiptPath = nativeReviewReceiptPath(stateRoot, prepared.token, "pending");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    const reject = (mutate, bindingOptions) => {
      writeReceiptCandidate(receiptPath, receipt, mutate, bindingOptions);
      assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }).status, "mismatch");
    };

    reject((value) => { value.schema = 7; });
    reject((value) => { value.kind = "foreign-receipt"; });
    reject((value) => { value.binding_hash = "invalid"; }, { preserveBinding: true });
    reject((value) => { value.receipt_id = "forged"; }, { preserveBinding: true });
    reject((value) => { value.token_hash = "0".repeat(64); });
    reject((value) => { value.request_hash = "0".repeat(64); });
    reject((value) => { value.workspace_hash = "0".repeat(32); });
    reject((value) => { value.conversation_hash = "invalid"; });
    reject((value) => { value.generation_hash = "invalid"; });
    reject((value) => { value.tool_hash = "invalid"; });
    reject((value) => { value.context_revision = "1"; });
    reject((value) => { value.context_revision = 0; });
    reject((value) => { value.root_hash = "invalid"; });
    reject((value) => { value.root_text = null; });
    reject((value) => { value.root_text = `${value.root_text}\nforged`; });
    reject((value) => { value.root_binding = null; });
    reject((value) => { value.root_binding.source = "foreign"; });
    reject((value) => { delete value.root_binding.priority; });
    reject((value) => { value.root_binding.priority = 1; });
    reject((value) => { value.root_binding.reason_codes = [7]; });
    reject((value) => { value.root_binding.reason_codes = ["unexpected"]; });
    reject((value) => {
      value.root_binding = { status: "provisional", source: "recent-plan-file-stop", priority: 1, reason_codes: ["native-plan-transcript-unavailable"] };
    });
    reject((value) => { value.artifacts = null; });
    reject((value) => { value.predecessor_mode = "foreign"; });
    reject((value) => { value.predecessor_mode = "task-chain"; });
    reject((value) => { value.artifacts = [{ label: "unexpected", text: "unexpected" }]; });
    reject((value) => { value.repository_attribution = null; });
    reject((value) => { value.mutation_epoch = null; });
    reject((value) => { value.mutation_epoch.id = "invalid"; });
    reject((value) => { value.mutation_epoch.status = "foreign"; });
    reject((value) => { value.baseline_hash = "0".repeat(64); });
    reject((value) => { value.review_enforcement = null; });
    reject((value) => { value.review_enforcement.status = "foreign"; });
    reject((value) => { value.review_enforcement.reason_codes = [7]; });
    reject((value) => { value.review_enforcement = { status: "enforced", reason_codes: ["unexpected"] }; });
    reject((value) => { value.review_enforcement = { status: "unavailable", reason_codes: [] }; });
    reject((value) => { value.expires_at = "not-a-time"; });

    writeReceiptCandidate(receiptPath, receipt, (value) => {
      value.baseline = null;
      value.baseline_hash = null;
      value.mutation_epoch.baseline_hash = null;
      value.repository_attribution.baseline_available = false;
      value.repository_attribution.baseline_hash = null;
    });
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }).status, "resolved");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("consumed receipt validation names every protected state drift", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    const conversationPath = conversationFile(stateRoot);
    const conversation = JSON.parse(readFileSync(conversationPath, "utf8"));
    const validate = (mutate, expected) => {
      const candidate = structuredClone(conversation);
      mutate(candidate);
      writeFileSync(conversationPath, `${JSON.stringify(candidate)}\n`);
      assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt: consumed.receipt }), expected);
    };

    validate((value) => { value.revision += 1; }, { status: "drift", reason: "context-revision-drift" });
    validate((value) => { value.active.root_hash = "0".repeat(64); }, { status: "drift", reason: "root-drift" });
    validate((value) => { value.mutation_epoch.id = "0".repeat(64); }, { status: "drift", reason: "mutation-epoch-drift" });
    validate((value) => { value.review_invocation.token_hash = "0".repeat(64); }, { status: "drift", reason: "review-invocation-drift" });
    validate((value) => { value.review_invocation.tool_hash = "0".repeat(32); }, { status: "drift", reason: "review-invocation-drift" });
    validate((value) => { value.review_invocation.generation_hash = "0".repeat(32); }, { status: "drift", reason: "review-invocation-drift" });
    writeFileSync(conversationPath, "{}\n");
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt: consumed.receipt }), { status: "drift", reason: "context-unavailable" });
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("successful Review output records one protected predecessor pair for later phases", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const event = reviewEvent();
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    const receipt = consumed.receipt;
    const bundle = buildManualReviewLifecycle({
      rootPlanText: receipt.root_text,
      artifacts: receipt.artifacts,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: receipt.baseline,
      repositoryAttribution: {
        status: receipt.repository_attribution.status === "bounded" ? "attributed" : "provisional",
        boundary: receipt.repository_attribution.boundary,
        reason_codes: receipt.repository_attribution.reason_codes,
      },
      captureSnapshot: () => structuredClone(baseline),
    });
    const output = reviewOutput(bundle);
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, conversation_id: undefined, tool_output: output }, pluginRoot: defaultRoot, options: options() }).status, "unavailable");
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, generation_id: undefined, tool_output: output }, pluginRoot: defaultRoot, options: options() }).status, "unavailable");
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, tool_use_id: undefined, tool_output: output }, pluginRoot: defaultRoot, options: options() }).status, "unavailable");
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_output: { structuredContent: { ...output.structuredContent, root_plan_id: "foreign-root" } } },
      pluginRoot: defaultRoot,
      options: options(),
    }).status, "mismatch");
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, generation_id: "foreign-generation", tool_output: output }, pluginRoot: defaultRoot, options: options() }).status, "mismatch");
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, tool_use_id: "foreign-tool", tool_output: output }, pluginRoot: defaultRoot, options: options() }).status, "mismatch");
    const recorded = observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_output: output },
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(recorded.status, "recorded");

    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
    const next = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    const nextConsumed = consumeNativeReviewReceipt({ stateRoot, token: next.token, input: next.updated_input });
    assert.equal(nextConsumed.status, "resolved");
    assert.equal(nextConsumed.receipt.predecessor_mode, "task-chain");
    assert.equal(nextConsumed.receipt.artifacts.length, 2);
    assert.equal(beginNativeCorrection({ stateRoots: [stateRoot], input: { ...selectionEvent(), generation_id: "correction" }, pluginRoot: defaultRoot, options: options() }).status, "unavailable");

    const drifted = {
      ...baseline,
      dirty_paths: ["tests/retry.test.mjs"],
      fingerprints: { "tests/retry.test.mjs": `file:${"d".repeat(64)}` },
      status_fingerprint: "e".repeat(64),
      working_tree: "modified",
    };
    const driftOptions = { captureSnapshot: () => structuredClone(drifted), workspaceRoot: defaultRoot };
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: driftOptions }).status, "selected");
    const replacementPrepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: driftOptions });
    const replacementReceipt = consumeNativeReviewReceipt({ stateRoot, token: replacementPrepared.token, input: replacementPrepared.updated_input }).receipt;
    const replacement = buildManualReviewLifecycle({
      rootPlanText: replacementReceipt.root_text,
      artifacts: replacementReceipt.artifacts,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: replacementReceipt.baseline,
      repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
      captureSnapshot: () => structuredClone(drifted),
    });
    assert.match(replacement.chain_update, /^replace-/);
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_output: reviewOutput(replacement) },
      pluginRoot: defaultRoot,
      options: driftOptions,
    }).status, "recorded");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("protected seal receipt binds local bytes and records one linear four-artifact chain", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-seal-"));
  try {
    establish(stateRoot);
    const local = buildManualReviewLifecycle({
      rootPlanText: rootPlan,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: baseline,
      repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
      captureSnapshot: () => structuredClone(baseline),
    });
    const localArtifacts = [
      { label: local.delivery_evidence.fields.id, text: local.delivery_evidence.artifact },
      { label: local.review.fields.id, text: local.review.artifact },
    ];
    const event = reviewEvent({
      tool_input: {
        ...reviewEvent().tool_input,
        review_input: verifiedReviewInput(),
        seal_artifacts: localArtifacts,
      },
    });
    const malformed = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: { ...event, tool_input: { ...event.tool_input, seal_artifacts: [localArtifacts[1], localArtifacts[1]] } },
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(malformed.status, "invalid");

    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    assert.equal(prepared.status, "prepared");
    const tamperedInput = structuredClone(prepared.updated_input);
    tamperedInput.seal_artifacts[0].text += "\n";
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: tamperedInput }).status, "mismatch");
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.predecessor_mode, "supported-seal");
    assert.deepEqual(consumed.receipt.artifacts, localArtifacts);

    const workspaceBinding = harnessContractHash({ workspace_root: defaultRoot });
    const snapshotHash = "e".repeat(64);
    const sealed = buildManualReviewLifecycle({
      rootPlanText: consumed.receipt.root_text,
      artifacts: consumed.receipt.artifacts,
      reviewInput: verifiedReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: consumed.receipt.baseline,
      repositoryAttribution: { status: "attributed", boundary: "protected-seal", reason_codes: [] },
      harnessPhaseResult: verifiedPhaseResult(workspaceBinding, snapshotHash),
      harnessProtectionHash: "1".repeat(64),
      workspaceBinding,
      seal: true,
      captureSnapshot: () => structuredClone(baseline),
    });
    assert.equal(sealed.chain_update, "append-seal");
    const recorded = observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_input: prepared.updated_input, tool_output: reviewOutput(sealed) },
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(recorded.status, "recorded", JSON.stringify(recorded));

    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
    const next = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    const nextConsumed = consumeNativeReviewReceipt({ stateRoot, token: next.token, input: next.updated_input });
    assert.equal(nextConsumed.status, "resolved");
    assert.equal(nextConsumed.receipt.predecessor_mode, "task-chain");
    assert.equal(nextConsumed.receipt.artifacts.length, 4);
    assert.equal(nextConsumed.receipt.artifacts[0].text, localArtifacts[0].text);
    assert.equal(nextConsumed.receipt.artifacts[1].text, localArtifacts[1].text);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("stored predecessor and baseline corruption cannot become Review authority", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const path = conversationFile(stateRoot);
    const original = JSON.parse(readFileSync(path, "utf8"));
    const selectWith = (mutate, expected) => {
      const value = structuredClone(original);
      mutate(value);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, expected);
    };
    selectWith((value) => { value.active.root_binding = null; }, "invalid");
    selectWith((value) => { value.active.root_binding.status = "foreign"; }, "invalid");
    selectWith((value) => { value.active.root_binding.source = "foreign"; }, "invalid");
    selectWith((value) => { value.active.root_binding.reason_codes = null; }, "invalid");
    selectWith((value) => { value.active.root_binding.reason_codes = [7]; }, "invalid");
    selectWith((value) => { value.active.root_binding.reason_codes = ["unexpected"]; }, "invalid");
    selectWith((value) => {
      value.active.root_binding = { status: "provisional", source: "recent-plan-file-stop", reason_codes: ["native-plan-transcript-unavailable"] };
      value.active.root_source = "cursor-create-plan";
    }, "invalid");
    selectWith((value) => { value.active.root_source = "foreign"; }, "invalid");
    selectWith((value) => { value.active.root_plan_id = "foreign-root"; }, "invalid");
    selectWith((value) => { value.active.root_text = `${value.active.root_text}\nforged`; }, "invalid");
    selectWith((value) => { value.artifacts = [{ label: "invalid", text: "not-an-artifact" }]; }, "invalid");
    selectWith((value) => { value.artifacts = [{ label: "root", text: rootPlan }]; }, "invalid");
    selectWith((value) => { value.baseline_hash = "0".repeat(64); }, "invalid");

    writeFileSync(path, `${JSON.stringify(original)}\n`);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
    const receipt = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }).receipt;
    const bundle = buildManualReviewLifecycle({
      rootPlanText: receipt.root_text,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: receipt.baseline,
      repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
      captureSnapshot: () => structuredClone(baseline),
    });
    const evidence = { label: bundle.delivery_evidence.fields.id, text: bundle.delivery_evidence.artifact };
    const review = { label: bundle.review.fields.id, text: bundle.review.artifact, builder_provenance: bundle.review.provenance };
    selectWith((value) => { value.artifacts = [evidence]; }, "selected");
    selectWith((value) => { value.artifacts = [evidence, { ...evidence, text: `${evidence.text}\n` }]; }, "invalid");
    selectWith((value) => { value.artifacts = [evidence, { ...review, builder_provenance: null }]; }, "invalid");

    const foreignRoot = nativePlan("manual", { id: "wp-foreign-root" });
    const foreignBundle = buildManualReviewLifecycle({
      rootPlanText: foreignRoot,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: baseline,
      repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
      captureSnapshot: () => structuredClone(baseline),
    });
    selectWith((value) => {
      value.artifacts = [
        { label: foreignBundle.delivery_evidence.fields.id, text: foreignBundle.delivery_evidence.artifact },
        { label: foreignBundle.review.fields.id, text: foreignBundle.review.artifact, builder_provenance: foreignBundle.review.provenance },
      ];
    }, "invalid");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("legacy-free Review selection defaults missing enforcement from its current host source", () => {
  for (const source of ["explicit-review-command", "transcript-exact-review-command"]) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
    try {
      establish(stateRoot);
      const path = conversationFile(stateRoot);
      const conversation = JSON.parse(readFileSync(path, "utf8"));
      conversation.review_selection.source = source;
      delete conversation.review_selection.review_enforcement;
      writeFileSync(path, `${JSON.stringify(conversation)}\n`);
      const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: options() });
      assert.equal(prepared.status, "prepared");
      const receipt = JSON.parse(readFileSync(nativeReviewReceiptPath(stateRoot, prepared.token, "pending"), "utf8"));
      assert.equal(receipt.review_enforcement.status, source === "explicit-review-command" ? "enforced" : "unavailable");
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  }
});

test("a protected corrective Review opens a new correction epoch and appends a fresh pair", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const event = reviewEvent();
    const firstPrepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    const firstReceipt = consumeNativeReviewReceipt({ stateRoot, token: firstPrepared.token, input: firstPrepared.updated_input }).receipt;
    const first = buildManualReviewLifecycle({
      rootPlanText: firstReceipt.root_text,
      artifacts: firstReceipt.artifacts,
      reviewInput: correctionReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: firstReceipt.baseline,
      repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
      captureSnapshot: () => structuredClone(baseline),
    });
    assert.equal(first.review.fields.next_action, "correct");
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_output: [{ text: JSON.stringify(reviewOutput(first)) }] },
      pluginRoot: defaultRoot,
      options: options(),
    }).status, "recorded");

    const correction = beginNativeCorrection({
      stateRoots: [stateRoot],
      input: { ...selectionEvent(), generation_id: "correction-generation" },
      pluginRoot: defaultRoot,
      options: options(),
    });
    assert.equal(correction.status, "selected");
    assert.equal(correction.mutation_epoch.boundary, "correction");

    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "selected");
    const secondPrepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    const secondReceipt = consumeNativeReviewReceipt({ stateRoot, token: secondPrepared.token, input: secondPrepared.updated_input }).receipt;
    const second = buildManualReviewLifecycle({
      rootPlanText: secondReceipt.root_text,
      artifacts: secondReceipt.artifacts,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: secondReceipt.baseline,
      repositoryAttribution: { status: "attributed", boundary: "correction", reason_codes: [] },
      captureSnapshot: () => structuredClone(baseline),
    });
    assert.equal(second.chain_update, "append");
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_output: { result: reviewOutput(second) } },
      pluginRoot: defaultRoot,
      options: options(),
    }).status, "recorded");

    const drifted = {
      ...baseline,
      dirty_paths: ["src/corrected.mjs"],
      fingerprints: { "src/corrected.mjs": `file:${"f".repeat(64)}` },
      status_fingerprint: "9".repeat(64),
      working_tree: "modified",
    };
    const driftOptions = { captureSnapshot: () => structuredClone(drifted), workspaceRoot: defaultRoot };
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: driftOptions }).status, "selected");
    const replacementPrepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: driftOptions });
    const replacementReceipt = consumeNativeReviewReceipt({ stateRoot, token: replacementPrepared.token, input: replacementPrepared.updated_input }).receipt;
    const replacement = buildManualReviewLifecycle({
      rootPlanText: replacementReceipt.root_text,
      artifacts: replacementReceipt.artifacts,
      reviewInput: provisionalReviewInput(),
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: replacementReceipt.baseline,
      repositoryAttribution: { status: "attributed", boundary: "correction", reason_codes: [] },
      captureSnapshot: () => structuredClone(drifted),
    });
    assert.equal(replacement.chain_update, "replace-delta-suffix");
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, tool_output: reviewOutput(replacement) },
      pluginRoot: defaultRoot,
      options: driftOptions,
    }).status, "recorded");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("invalid Review output revokes only the matching inflight receipt", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const event = reviewEvent();
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() });
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, tool_output: { content: [] } }, pluginRoot: defaultRoot, options: options() }).status, "revoked");
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }).status, "unavailable");
    assert.equal(observeNativeReviewResult({ stateRoots: [], input: event, pluginRoot: defaultRoot, options: options() }).status, "ambiguous");
    assert.equal(observeNativeReviewResult({ stateRoots: [stateRoot], input: { ...event, tool_name: "Other" }, pluginRoot: defaultRoot, options: options() }).status, "ignored");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("native Review entrypoints reject mismatched phase identity without disturbing host use", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: { ...reviewEvent(), tool_name: "Other" }, pluginRoot: defaultRoot, options: options() }).status, "ignored");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent({ tool_input: { artifact_kind: "delivery-evidence" } }), pluginRoot: defaultRoot, options: options() }).status, "ignored");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent({ tool_input: [] }), pluginRoot: defaultRoot, options: options() }).status, "ignored");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent({ tool_input: { ...reviewEvent().tool_input, root_plan_id: "foreign-root" } }), pluginRoot: defaultRoot, options: options() }).status, "mismatch");
    const event = reviewEvent();
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: options() }).status, "prepared");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: { ...event, generation_id: "foreign-generation" }, options: options() }).status, "ignored");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: { ...event, tool_use_id: "foreign-tool" }, options: options() }).status, "ignored");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: event, options: options() }).status, "revoked");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: event, options: options() }).status, "ignored");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("missing repository observation remains provisional but receipt-bound", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    const unavailable = { workspaceRoot: defaultRoot, captureSnapshot: () => { throw new Error("observer unavailable"); } };
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: planEvent(), pluginRoot: defaultRoot, options: unavailable }).status, "observed");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selectionEvent(), pluginRoot: defaultRoot, options: unavailable }).status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: unavailable });
    assert.equal(prepared.status, "mismatch");
    assert.equal(prepared.reason, "repository-mutated-during-review");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("cleanup removes expired context while preserving active lock directories", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  try {
    establish(stateRoot);
    const file = conversationFile(stateRoot);
    const old = new Date("2026-06-01T00:00:00.000Z");
    utimesSync(file, old, old);
    const lock = join(stateRoot, "manual-native-task-review", "keep.lock");
    mkdirSync(lock, { recursive: true });
    cleanupNativeTaskReviewContext(stateRoot, { now: () => new Date("2026-08-25T00:00:00.000Z") });
    assert.equal(existsSync(file), false);
    assert.equal(existsSync(lock), true);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("native state lock steals only a provably dead stale owner", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-lock-"));
  const lock = join(stateRoot, "authority.lock");
  try {
    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ owner_token: "dead-owner-token", pid: 424242, acquired_at: "2026-08-25T09:00:00.000Z" })}\n`);
    const value = withNativeStateLock(lock, () => "acquired", {
      now: () => new Date("2026-08-25T10:00:00.000Z"),
      pidIsAlive: () => false,
      ownerToken: "replacement-owner-token",
      lockWaitMs: 5,
    });
    assert.equal(value, "acquired");
    assert.equal(existsSync(lock), false);

    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ owner_token: "live-owner-token", pid: 424243, acquired_at: "2026-08-25T09:00:00.000Z" })}\n`);
    assert.throws(() => withNativeStateLock(lock, () => "never", {
      now: () => new Date("2026-08-25T10:00:00.000Z"),
      pidIsAlive: () => true,
      lockWaitMs: 1,
      lockPollMs: 1,
    }), (error) => error?.code === "native-state-busy");

    rmSync(lock, { recursive: true, force: true });
    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ owner_token: "native-dead-owner", pid: 99_999_999, acquired_at: "2026-08-25T09:00:00.000Z" })}\n`);
    assert.equal(withNativeStateLock(lock, () => "native-acquired", {
      now: () => new Date("2026-08-25T10:00:00.000Z"),
      ownerToken: "native-replacement-owner",
      lockWaitMs: 5,
    }), "native-acquired");

    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ owner_token: "native-live-owner", pid: process.pid, acquired_at: "2026-08-25T09:00:00.000Z" })}\n`);
    assert.throws(() => withNativeStateLock(lock, () => "never", {
      now: () => new Date("2026-08-25T10:00:00.000Z"),
      lockWaitMs: 1,
      lockPollMs: 1,
    }), (error) => error?.code === "native-state-busy");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("native authority counter-probes remain explicit and non-authoritative", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-native-"));
  const planDirectory = mkdtempSync(join(tmpdir(), "workflow-v6-plans-"));
  try {
    assert.equal(observeNativeCreatePlan({ stateRoots: [], input: planEvent(), pluginRoot: defaultRoot, options: options() }).status, "ambiguous");
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: { ...planEvent(), tool_use_id: undefined }, pluginRoot: defaultRoot, options: options() }).status, "ignored");
    assert.equal(selectNativeReviewRoot({ stateRoots: [], input: selectionEvent(), pluginRoot: defaultRoot, options: options() }).status, "ambiguous");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: { ...selectionEvent(), generation_id: undefined }, pluginRoot: defaultRoot, options: options() }).status, "unavailable");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [], input: reviewEvent(), pluginRoot: defaultRoot, options: options() }).status, "ambiguous");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: { ...reviewEvent(), conversation_id: undefined }, pluginRoot: defaultRoot, options: options() }).status, "mismatch");
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: { ...reviewEvent(), tool_name: "Other" }, pluginRoot: defaultRoot, options: options() }).status, "ignored");
    assert.equal(failNativeReview({ stateRoots: [], input: reviewEvent(), options: options() }).status, "ambiguous");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: { ...reviewEvent(), conversation_id: undefined }, options: options() }).status, "unavailable");
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: "invalid", input: {} }).status, "unavailable");
    assert.equal(validateConsumedNativeReviewReceipt({ stateRoot, receipt: null }).status, "invalid");

    const marker = observeNativeCreatePlanAtStop({
      stateRoots: [stateRoot],
      input: { ...planEvent(), transcript_path: undefined },
      markerStartedAt: "not-a-time",
      pluginRoot: defaultRoot,
      options: { ...options(), planDirectory, now: () => new Date("2026-08-25T10:00:00.000Z") },
    });
    assert.equal(marker.status, "invalid");
    assert.ok(marker.reason_codes.includes("native-plan-marker-invalid"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(planDirectory, { recursive: true, force: true });
  }
});
