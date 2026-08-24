import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  truncateSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  approveNativeImplementPlan,
  authorizeNativeReviewShell,
  beginNativeCorrection,
  cleanupNativeTaskReviewContext,
  consumeNativeReviewReceipt,
  failNativeReview,
  markNativeRepositoryMutation,
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
  nativeReviewReceiptBindingHash,
  nativeReviewReceiptDirectory,
  nativeReviewReceiptPath,
} from "../hooks/native-review-receipt.mjs";
import { hashWorkflowIdentifier } from "../hooks/model-inheritance-state.mjs";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import { repositorySnapshotHash } from "../src/core/manual-repository-snapshot.mjs";
import { repositoryPathFingerprint, withNativeStateLock } from "../src/core/native-task-review-state.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");

const achievedReviewInput = {
  schema: 1,
  kind: "review-input",
  assessment: "achieved",
  recommended_action: "none",
  assessment_summary: "The exact verified Evidence satisfies the Root.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The repository matches the reviewed delivery.",
  findings: [],
  missing_evidence: [],
  auditor_reports: [],
};

const verifiedCheck = {
  check_id: "CHECK-1",
  grade: "verified",
  observed: "Retry verification passes twice.",
  repetitions: 2,
};

const unavailableCheck = {
  ...verifiedCheck,
  grade: "unavailable",
  observed: "The required verifier was unavailable in this Review.",
  repetitions: 0,
  limitations: ["Retry the fresh Review when the verifier is available."],
};

const correctionReviewInput = {
  schema: 1,
  kind: "review-input",
  assessment: "mostly-achieved",
  recommended_action: "correct",
  assessment_summary: "One bounded retry correction remains.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The current repository matches the reviewed delivery.",
  findings: [{
    key: "retry-gap",
    severity: "medium",
    objective_ids: ["OBJ-1"],
    check_ids: ["CHECK-1"],
    evidence: "The retry boundary is incomplete.",
    reasoning: "The Root remains incomplete until this bounded gap is corrected.",
    resolution: "correct",
  }],
  missing_evidence: [],
  auditor_reports: [],
  correction: {
    fixes: [{ key: "complete-retry", finding_keys: ["retry-gap"], required_outcome: "Complete the retry boundary.", evidence: "The finding is bounded." }],
    checks: [{ key: "verify-correction", fix_keys: ["complete-retry"], working_directory: "repository root", command_or_inspection: "node --test tests/codex-hook-policy.test.mjs", expected_result: "Focused correction tests pass.", required: true, cost_class: "standard", prerequisites: ["src", "tests"] }],
    steps: [{ key: "apply-correction", fix_keys: ["complete-retry"], targets: ["src/retry.mjs"], required_outcome: "Apply the bounded correction.", implementation_latitude: "Use the smallest in-scope change.", completion_probe: "Focused correction tests pass.", check_keys: ["verify-correction"], deviation_action: "Replan if authority changes." }],
    learning_candidates: [{
      key: "retry-guidance",
      finding_keys: ["retry-gap"],
      reusable_guidance: "Keep retry boundaries covered.",
      candidate_targets: ["tests"],
      confirmation_evidence: "Focused tests pass.",
    }],
  },
};

const baseline = Object.freeze({
  schema: 1,
  repository_root: defaultRoot,
  head: "a".repeat(40),
  dirty_paths: ["README.md"],
  fingerprints: { "README.md": `file:100644:${"b".repeat(64)}` },
  index_fingerprint: "c".repeat(64),
  status_fingerprint: "d".repeat(64),
  working_tree: "modified",
  captured_at: "2026-08-23T10:00:00.000Z",
});

function createEvent(overrides = {}) {
  return {
    hook_event_name: "postToolUse",
    tool_name: "CreatePlan",
    conversation_id: "conversation-1",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: {
      name: "Adaptive retry",
      plan: rootPlan,
      todos: [{ id: "STEP-1", content: "Implement retry handling." }],
    },
    ...overrides,
  };
}

function reviewSelection(overrides = {}) {
  return {
    hook_event_name: "beforeSubmitPrompt",
    conversation_id: "conversation-1",
    generation_id: "review-generation",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    prompt: "/review-work",
    ...overrides,
  };
}

function reviewEvent(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "MCP:workflow_closeout",
    conversation_id: "conversation-1",
    generation_id: "review-generation",
    tool_use_id: "review-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: {
      artifact_kind: "work-review",
      check_evidence: [verifiedCheck],
      review_input: achievedReviewInput,
    },
    ...overrides,
  };
}

function nativeOptions(overrides = {}) {
  return { captureSnapshot: () => ({ ...baseline }), workspaceRoot: defaultRoot, ...overrides };
}

function snapshotAt(fingerprint, indexFingerprint = fingerprint, statusFingerprint = fingerprint) {
  return {
    ...baseline,
    dirty_paths: ["src/retry.mjs"],
    fingerprints: { "src/retry.mjs": `file:100644:${fingerprint.repeat(64)}|index:${fingerprint.repeat(64)}` },
    index_fingerprint: indexFingerprint.repeat(64),
    status_fingerprint: statusFingerprint.repeat(64),
    working_tree: "modified",
  };
}

function conversationFile(stateRoot) {
  return join(
    stateRoot,
    "manual-native-task-review",
    "conversations",
    `${hashWorkflowIdentifier("conversation", "conversation-1")}.json`,
  );
}

function readConversation(stateRoot) {
  return JSON.parse(readFileSync(conversationFile(stateRoot), "utf8"));
}

function writeConversation(stateRoot, value) {
  writeFileSync(conversationFile(stateRoot), `${JSON.stringify(value, null, 2)}\n`);
}

function reviewOutput(bundle) {
  return {
    artifact_kind: "work-review",
    root_plan_id: bundle.root_plan_id,
    delivery_evidence_artifact: bundle.delivery_evidence.artifact,
    delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
    artifact: bundle.review.artifact,
    artifact_hash: bundle.review.artifact_hash,
    review_input_hash: bundle.review.review_input_hash,
    repository_state_hash: bundle.repository_state_hash,
    chain_update: bundle.chain_update,
  };
}

function buildFromReceipt(receipt, currentSnapshot, checkEvidence) {
  return buildManualReviewLifecycle({
    rootPlanText: receipt.root_text,
    artifacts: receipt.artifacts,
    reviewInput: achievedReviewInput,
    checkEvidence: [checkEvidence],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: receipt.baseline,
    repositoryAttribution: {
      status: receipt.repository_attribution.status === "bounded" ? "attributed" : "provisional",
      boundary: receipt.repository_attribution.boundary,
      reason_codes: receipt.repository_attribution.reason_codes,
    },
    captureSnapshot: () => currentSnapshot,
  });
}

function establishReview(stateRoot, overrides = {}) {
  const options = nativeOptions(overrides.options);
  assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(overrides.create), pluginRoot: defaultRoot, options }).status, "observed");
  assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(overrides.selection), pluginRoot: defaultRoot, options }).status, "selected");
  return options;
}

function transcriptPlanEntry(plan = rootPlan, extraBlocks = []) {
  return {
    role: "assistant",
    message: {
      content: [
        ...extraBlocks,
        { type: "tool_use", name: "CreatePlan", input: { name: "Adaptive retry", plan } },
      ],
    },
  };
}

function writeTranscript(directory, conversationId, entries) {
  const path = join(directory, `${conversationId}.jsonl`);
  writeFileSync(path, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  return path;
}

test("stop captures exactly one CreatePlan from only the latest completed transcript turn", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-stop-transcript-state-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-stop-transcript-file-"));
  try {
    const oldRoot = rootPlan.replaceAll("wp-adaptive-retry", "wp-older-retry");
    const transcriptPath = writeTranscript(transcriptRoot, "conversation-1", [
      transcriptPlanEntry(oldRoot),
      { type: "turn_ended", status: "success" },
      { role: "assistant", message: { content: [{ type: "text", text: `Prose is inert even when it contains ${oldRoot}` }] } },
      transcriptPlanEntry(rootPlan, [{ type: "tool_use", name: "Read", input: { path: "README.md" } }]),
      { type: "turn_ended", status: "success" },
    ]);
    const observed = observeNativeCreatePlanAtStop({
      stateRoots: [stateRoot],
      input: createEvent({ hook_event_name: "stop", tool_name: undefined, tool_use_id: undefined, transcript_path: transcriptPath }),
      markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
      pluginRoot: defaultRoot,
      options: nativeOptions(),
    });
    assert.equal(observed.status, "observed");
    assert.deepEqual(observed.root_binding, { status: "enforced", source: "task-transcript-stop", reason_codes: [] });
    const active = readConversation(stateRoot).active;
    assert.equal(active.root_plan_id, "wp-adaptive-retry");
    assert.equal(active.root_source, "cursor-create-plan");
    assert.deepEqual(active.root_binding, observed.root_binding);

    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options: nativeOptions() }).status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: nativeOptions() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.receipt.schema, 4);
    assert.equal(consumed.receipt.root_source, "cursor-create-plan");
    assert.deepEqual(consumed.receipt.root_binding, observed.root_binding);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("stop transcript counter-probes never grant an older, prose-only, ambiguous, or incomplete Root", () => {
  const cases = [
    {
      label: "older turn only",
      entries: [transcriptPlanEntry(), { type: "turn_ended", status: "success" }, { role: "assistant", message: { content: [{ type: "text", text: "Done." }] } }, { type: "turn_ended", status: "success" }],
      status: "invalid",
      reason: "native-plan-transcript-create-plan-missing",
    },
    {
      label: "prose only",
      entries: [{ role: "assistant", message: { content: [{ type: "text", text: rootPlan }] } }, { type: "turn_ended", status: "success" }],
      status: "invalid",
      reason: "native-plan-transcript-create-plan-missing",
    },
    {
      label: "multiple CreatePlans",
      entries: [transcriptPlanEntry(), transcriptPlanEntry(), { type: "turn_ended", status: "success" }],
      status: "ambiguous",
      reason: "native-plan-transcript-create-plan-ambiguous",
    },
    {
      label: "incomplete turn",
      entries: [transcriptPlanEntry(), { type: "turn_ended", status: "cancelled" }],
      status: "invalid",
      reason: "native-plan-transcript-turn-incomplete",
    },
  ];
  for (const counterProbe of cases) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-stop-counter-state-"));
    const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-stop-counter-file-"));
    try {
      const transcriptPath = writeTranscript(transcriptRoot, "conversation-1", counterProbe.entries);
      const result = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: createEvent({ hook_event_name: "stop", tool_name: undefined, tool_use_id: undefined, transcript_path: transcriptPath }),
        markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
        pluginRoot: defaultRoot,
        options: nativeOptions(),
      });
      assert.equal(result.status, counterProbe.status, counterProbe.label);
      assert.ok(result.reason_codes.includes(counterProbe.reason), counterProbe.label);
      assert.equal(readConversation(stateRoot).active, null, counterProbe.label);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
      rmSync(transcriptRoot, { recursive: true, force: true });
    }
  }
});

test("stop transcript binding rejects foreign conversation names, symlinks, and oversized files", () => {
  for (const probe of ["foreign-conversation", "symlink", "oversized"]) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-stop-file-probe-state-"));
    const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-stop-file-probe-transcript-"));
    try {
      const validEntries = [transcriptPlanEntry(), { type: "turn_ended", status: "success" }];
      let transcriptPath;
      if (probe === "foreign-conversation") {
        transcriptPath = writeTranscript(transcriptRoot, "foreign-conversation", validEntries);
      } else if (probe === "symlink") {
        const target = writeTranscript(transcriptRoot, "target", validEntries);
        transcriptPath = join(transcriptRoot, "conversation-1.jsonl");
        symlinkSync(target, transcriptPath);
      } else {
        transcriptPath = writeTranscript(transcriptRoot, "conversation-1", validEntries);
        truncateSync(transcriptPath, 32 * 1024 * 1024 + 1);
      }
      const result = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: createEvent({ hook_event_name: "stop", tool_name: undefined, tool_use_id: undefined, transcript_path: transcriptPath }),
        markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
        pluginRoot: defaultRoot,
        options: nativeOptions(),
      });
      assert.equal(result.status, "invalid", probe);
      assert.equal(readConversation(stateRoot).active, null, probe);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
      rmSync(transcriptRoot, { recursive: true, force: true });
    }
  }
});

test("missing transcript binds one recent native Plan file only provisionally", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-plan-file-state-"));
  const planDirectory = mkdtempSync(join(tmpdir(), "workflow-native-plan-file-dir-"));
  try {
    const planPath = join(planDirectory, "adaptive_retry.plan.md");
    writeFileSync(planPath, `---\nname: Adaptive retry\noverview: Retry safely.\ntodos: []\nisProject: false\n---\n${rootPlan}`);
    const observed = observeNativeCreatePlanAtStop({
      stateRoots: [stateRoot],
      input: createEvent({ hook_event_name: "stop", tool_name: undefined, tool_use_id: undefined, transcript_path: undefined }),
      markerStartedAt: new Date(Date.now() - 1_000).toISOString(),
      pluginRoot: defaultRoot,
      options: nativeOptions({ planDirectory }),
    });
    assert.equal(observed.status, "observed");
    assert.deepEqual(observed.root_binding, {
      status: "provisional",
      source: "recent-plan-file-stop",
      reason_codes: ["native-plan-transcript-unavailable"],
    });
    assert.equal(readConversation(stateRoot).active.root_source, "cursor-plan-file");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options: nativeOptions() }).status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: nativeOptions() });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.receipt.root_source, "cursor-plan-file");
    assert.deepEqual(consumed.receipt.root_binding, observed.root_binding);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(planDirectory, { recursive: true, force: true });
  }
});

test("native Plan-file fallback rejects stale, ambiguous, symlinked, and oversized candidates", () => {
  const probes = ["stale", "ambiguous", "symlink", "oversized"];
  for (const probe of probes) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-plan-file-probe-state-"));
    const planDirectory = mkdtempSync(join(tmpdir(), "workflow-native-plan-file-probe-dir-"));
    try {
      const source = `---\nname: Adaptive retry\ntodos: []\nisProject: false\n---\n${rootPlan}`;
      const first = join(planDirectory, "first.plan.md");
      if (probe === "symlink") {
        const target = join(planDirectory, "target.txt");
        writeFileSync(target, source);
        symlinkSync(target, first);
      } else {
        writeFileSync(first, source);
      }
      if (probe === "stale") {
        const old = new Date(Date.now() - 180_000);
        utimesSync(first, old, old);
      }
      if (probe === "ambiguous") writeFileSync(join(planDirectory, "second.plan.md"), source);
      if (probe === "oversized") truncateSync(first, 2 * 1024 * 1024 + 1);
      const result = observeNativeCreatePlanAtStop({
        stateRoots: [stateRoot],
        input: createEvent({ hook_event_name: "stop", tool_name: undefined, tool_use_id: undefined, transcript_path: undefined }),
        markerStartedAt: new Date(Date.now() - (probe === "stale" ? 240_000 : 1_000)).toISOString(),
        pluginRoot: defaultRoot,
        options: nativeOptions({ planDirectory }),
      });
      assert.notEqual(result.status, "observed", probe);
      assert.equal(readConversation(stateRoot).active, null, probe);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
      rmSync(planDirectory, { recursive: true, force: true });
    }
  }
});

test("Cursor receipt is opaque, exact, baseline-bound, and single-use", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-"));
  try {
    const options = establishReview(stateRoot);
    const event = reviewEvent({ tool_input: { ...reviewEvent().tool_input, root_plan_id: "wp-adaptive-retry", root_plan: rootPlan.slice(0, 300) } });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options });
    assert.equal(prepared.status, "prepared");
    assert.match(prepared.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(prepared.updated_input.native_review_receipt, prepared.token);
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.schema, 4);
    assert.equal(consumed.receipt.root_text, rootPlan);
    assert.equal(consumed.receipt.root_plan_id, "wp-adaptive-retry");
    assert.equal(consumed.receipt.root_source, "cursor-create-plan");
    assert.deepEqual(consumed.receipt.root_binding, { status: "enforced", source: "post-tool-use", reason_codes: [] });
    assert.equal(consumed.receipt.predecessor_mode, "full-rebuild");
    assert.equal(consumed.receipt.implementation_authorization, "host-owned-unattested");
    assert.equal(consumed.receipt.review_selection_source, "explicit-review-command");
    assert.deepEqual(consumed.receipt.review_enforcement, { status: "enforced", reason_codes: [] });
    assert.equal(consumed.receipt.repository_attribution.status, "bounded");
    assert.deepEqual(consumed.receipt.repository_attribution.pre_existing_paths, ["README.md"]);
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt: consumed.receipt }), { status: "valid" });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }), { status: "replayed" });
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("legacy conversation state without root_binding remains the enforced post-tool path", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-legacy-root-binding-"));
  try {
    const options = nativeOptions();
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(), pluginRoot: defaultRoot, options }).status, "observed");
    const legacy = readConversation(stateRoot);
    delete legacy.active.root_binding;
    delete legacy.active.root_source;
    writeConversation(stateRoot, legacy);
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options }).status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.receipt.root_source, "cursor-create-plan");
    assert.deepEqual(consumed.receipt.root_binding, { status: "enforced", source: "post-tool-use", reason_codes: [] });
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("explicit Review selects the Root; Implement Plan prose is inert", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-selection-"));
  try {
    const options = nativeOptions();
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(), pluginRoot: defaultRoot, options }).status, "observed");
    for (const prompt of [
      "Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.",
      "Do not implement the plan as specified, it is attached for your reference.",
      "```text\nImplement the plan as specified, it is attached for your reference.\n```",
    ]) assert.equal(approveNativeImplementPlan({ input: { prompt } }).status, "ignored");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options }).status, "unavailable");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options }).status, "selected");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options }).status, "prepared");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("a mutating tool in another conversation makes repository attribution unavailable", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-contamination-"));
  try {
    const options = nativeOptions();
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent(),
      pluginRoot: defaultRoot,
      options,
    }).status, "observed");
    assert.deepEqual(markNativeRepositoryMutation({
      stateRoots: [stateRoot],
      input: createEvent({
        hook_event_name: "preToolUse",
        tool_name: "Write",
        conversation_id: "conversation-2",
        generation_id: "implementation-generation",
        tool_use_id: "write-call",
        tool_input: { path: "README.md" },
      }),
      options,
    }), { status: "marked", marked: 1 });
    assert.equal(selectNativeReviewRoot({
      stateRoots: [stateRoot],
      input: reviewSelection(),
      pluginRoot: defaultRoot,
      options,
    }).status, "selected");
    const prepared = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent(),
      pluginRoot: defaultRoot,
      options,
    });
    assert.equal(prepared.status, "prepared");
    const consumed = consumeNativeReviewReceipt({
      stateRoot,
      token: prepared.token,
      input: prepared.updated_input,
    });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.repository_attribution.status, "unavailable");
    assert.deepEqual(consumed.receipt.repository_attribution.reason_codes, ["concurrent-repository-activity"]);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("receipt preparation rejects missing identity, model tokens, and Root mismatch", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-negative-"));
  try {
    const options = establishReview(stateRoot);
    assert.equal(prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ generation_id: undefined, tool_use_id: undefined }),
      pluginRoot: defaultRoot,
      options,
    }).status, "mismatch");
    assert.equal(prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ tool_input: { ...reviewEvent().tool_input, native_review_receipt: "x".repeat(43) } }),
      pluginRoot: defaultRoot,
      options,
    }).status, "mismatch");
    const mismatch = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ tool_input: { ...reviewEvent().tool_input, root_plan_id: "wp-other-root" } }),
      pluginRoot: defaultRoot,
      options,
    });
    assert.equal(mismatch.status, "mismatch");
    assert.equal(mismatch.expected_root_plan_id, "wp-adaptive-retry");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("token-addressed consumption rejects tampering and cross-token lookup", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-tamper-"));
  try {
    const options = establishReview(stateRoot);
    const event = reviewEvent();
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: "z".repeat(43), input: event.tool_input }), { status: "unavailable" });
    const path = nativeReviewReceiptPath(stateRoot, prepared.token);
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, `${JSON.stringify({ ...receipt, root_text: `${receipt.root_text}\n` }, null, 2)}\n`, { mode: 0o600 });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: event.tool_input }), { status: "mismatch" });
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("same host event is idempotent while a different Review call is busy", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-inflight-"));
  try {
    const options = establishReview(stateRoot);
    const first = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const duplicate = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    assert.equal(duplicate.status, "prepared");
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.token, first.token);
    assert.equal(prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ tool_use_id: "parallel-review-call" }),
      pluginRoot: defaultRoot,
      options,
    }).status, "busy");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("post-build receipt recheck detects Root or context revision drift", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-recheck-"));
  try {
    const options = establishReview(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt: consumed.receipt }), { status: "valid" });
    const newerRoot = rootPlan.replaceAll("wp-adaptive-retry", "wp-recheck-drift");
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({
        generation_id: "drift-plan-generation",
        tool_use_id: "drift-plan-call",
        tool_input: { name: "Drift retry", plan: newerRoot },
      }),
      pluginRoot: defaultRoot,
      options,
    }).status, "observed");
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt: consumed.receipt }), {
      status: "drift",
      reason: "context-revision-drift",
    });
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("receipt expiration is distinct from unavailable and replay", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-expiry-"));
  const start = new Date("2026-08-23T10:00:00.000Z");
  try {
    const options = establishReview(stateRoot, { options: { now: () => start } });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const later = new Date(start.getTime() + 6 * 60 * 1000);
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input, options: { now: () => later } }), { status: "expired" });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input, options: { now: () => later } }), { status: "expired" });
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("CreatePlan never replicates Root authority across multiple state roots", () => {
  const first = mkdtempSync(join(tmpdir(), "workflow-native-root-a-"));
  const second = mkdtempSync(join(tmpdir(), "workflow-native-root-b-"));
  try {
    assert.equal(observeNativeCreatePlan({ stateRoots: [first, second], input: createEvent(), pluginRoot: defaultRoot, options: nativeOptions() }).status, "ambiguous");
    assert.deepEqual(readdirSync(first), []);
    assert.deepEqual(readdirSync(second), []);
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});

test("a newer CreatePlan replaces the prior Root without prompt approval", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-new-root-"));
  const newerRoot = rootPlan.replaceAll("wp-adaptive-retry", "wp-newer-retry");
  try {
    const options = establishReview(stateRoot);
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({
        generation_id: "new-plan-generation",
        tool_use_id: "new-plan-call",
        tool_input: { name: "New retry", plan: newerRoot },
      }),
      pluginRoot: defaultRoot,
      options,
    }).status, "observed");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options }).status, "unavailable");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options }).status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.receipt.root_plan_id, "wp-newer-retry");
    assert.equal(consumed.receipt.root_text, newerRoot);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("only a complete Evidence-Review pair becomes task-chain predecessor state", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-chain-"));
  try {
    const options = establishReview(stateRoot);
    const event = reviewEvent();
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options });
    consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    const bundle = buildManualReviewLifecycle({
      rootPlanText: rootPlan,
      reviewInput: achievedReviewInput,
      checkEvidence: [verifiedCheck],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: baseline,
      captureSnapshot: options.captureSnapshot,
    });
    const output = {
      artifact_kind: "work-review",
      root_plan_id: "wp-adaptive-retry",
      delivery_evidence_artifact: bundle.delivery_evidence.artifact,
      delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
      artifact: bundle.review.artifact,
      artifact_hash: bundle.review.artifact_hash,
      review_input_hash: bundle.review.review_input_hash,
      repository_state_hash: bundle.repository_state_hash,
      chain_update: bundle.chain_update,
    };
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, hook_event_name: "postToolUse", tool_output: { structuredContent: output } },
      pluginRoot: defaultRoot,
      options,
    }).status, "recorded");
    const nextSelection = reviewSelection({ generation_id: "review-generation-2" });
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: nextSelection, pluginRoot: defaultRoot, options }).status, "selected");
    const next = reviewEvent({ generation_id: "review-generation-2", tool_use_id: "review-call-2" });
    const second = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: next, pluginRoot: defaultRoot, options });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: second.token, input: second.updated_input });
    assert.equal(consumed.receipt.predecessor_mode, "task-chain");
    assert.equal(consumed.receipt.artifacts.length, 2);
    assert.equal(consumed.receipt.repository_attribution.status, "bounded");
    assert.equal(consumed.receipt.mutation_epoch.status, "closed");
    assert.equal(consumed.receipt.artifacts.find((entry) => entry.text === bundle.review.artifact).builder_provenance.kind, "host-work-review-builder");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("native Review refreshes provisional Evidence, preserves its epoch, and degrades after repository drift", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-refresh-"));
  const baselineSnapshot = {
    ...baseline,
    dirty_paths: [],
    fingerprints: {},
    index_fingerprint: "1".repeat(64),
    status_fingerprint: "1".repeat(64),
    working_tree: "unchanged",
  };
  const snapshotC = snapshotAt("2", "2", "2");
  const snapshotD = snapshotAt("3", "3", "3");
  let currentSnapshot = baselineSnapshot;
  const options = nativeOptions({ captureSnapshot: () => currentSnapshot });
  try {
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent(),
      pluginRoot: defaultRoot,
      options,
    }).status, "observed");
    const initial = JSON.parse(readFileSync(conversationFile(stateRoot), "utf8"));
    const epochId = initial.mutation_epoch.id;
    const baselineHash = repositorySnapshotHash(baselineSnapshot);
    assert.equal(initial.baseline_hash, baselineHash);
    assert.equal(initial.mutation_epoch.baseline_hash, baselineHash);

    currentSnapshot = snapshotC;
    const selection1 = reviewSelection({ generation_id: "refresh-review-1" });
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selection1, pluginRoot: defaultRoot, options }).status, "selected");
    const event1 = reviewEvent({ generation_id: "refresh-review-1", tool_use_id: "refresh-call-1", tool_input: {
      ...reviewEvent().tool_input,
      check_evidence: [unavailableCheck],
    } });
    const prepared1 = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event1, pluginRoot: defaultRoot, options });
    const consumed1 = consumeNativeReviewReceipt({ stateRoot, token: prepared1.token, input: prepared1.updated_input });
    assert.equal(consumed1.status, "resolved");
    const bundle1 = buildFromReceipt(consumed1.receipt, currentSnapshot, unavailableCheck);
    assert.equal(bundle1.review.fields.delivery_status, "provisional");
    assert.notEqual(bundle1.review.fields.next_action, "none");
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event1, hook_event_name: "postToolUse", tool_output: { structuredContent: reviewOutput(bundle1) } },
      pluginRoot: defaultRoot,
      options,
    }).status, "recorded");
    const afterFirst = JSON.parse(readFileSync(conversationFile(stateRoot), "utf8"));
    assert.equal(afterFirst.mutation_epoch.id, epochId);
    assert.equal(afterFirst.mutation_epoch.status, "closed");
    assert.equal(afterFirst.mutation_epoch.baseline_hash, baselineHash);
    assert.equal(afterFirst.mutation_epoch.reviewed_repository_hash, bundle1.repository_state_hash);

    const selection2 = reviewSelection({ generation_id: "refresh-review-2" });
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selection2, pluginRoot: defaultRoot, options }).status, "selected");
    const event2 = reviewEvent({ generation_id: "refresh-review-2", tool_use_id: "refresh-call-2" });
    const prepared2 = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event2, pluginRoot: defaultRoot, options });
    const consumed2 = consumeNativeReviewReceipt({ stateRoot, token: prepared2.token, input: prepared2.updated_input });
    assert.equal(consumed2.receipt.mutation_epoch.id, epochId);
    assert.equal(consumed2.receipt.repository_attribution.status, "bounded");
    const bundle2 = buildFromReceipt(consumed2.receipt, currentSnapshot, verifiedCheck);
    assert.equal(bundle2.review.fields.delivery_status, "verified");
    assert.equal(bundle2.review.fields.next_action, "none");
    assert.notEqual(bundle2.delivery_evidence.fields.id, bundle1.delivery_evidence.fields.id);
    assert.match(bundle2.chain_update, /^replace-/);
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event2, hook_event_name: "postToolUse", tool_output: { structuredContent: reviewOutput(bundle2) } },
      pluginRoot: defaultRoot,
      options,
    }).status, "recorded");

    const selection3 = reviewSelection({ generation_id: "refresh-review-3" });
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selection3, pluginRoot: defaultRoot, options }).status, "selected");
    const event3 = reviewEvent({ generation_id: "refresh-review-3", tool_use_id: "refresh-call-3" });
    const prepared3 = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event3, pluginRoot: defaultRoot, options });
    const consumed3 = consumeNativeReviewReceipt({ stateRoot, token: prepared3.token, input: prepared3.updated_input });
    assert.equal(consumed3.receipt.predecessor_mode, "task-chain");
    assert.deepEqual(
      consumed3.receipt.artifacts.map((entry) => entry.label).sort(),
      [bundle2.delivery_evidence.fields.id, bundle2.review.fields.id].sort(),
    );
    assert.deepEqual(
      consumed3.receipt.artifacts.map((entry) => entry.text).sort(),
      [bundle2.delivery_evidence.artifact, bundle2.review.artifact].sort(),
    );

    currentSnapshot = snapshotD;
    const selection4 = reviewSelection({ generation_id: "refresh-review-4" });
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selection4, pluginRoot: defaultRoot, options }).status, "selected");
    const event4 = reviewEvent({ generation_id: "refresh-review-4", tool_use_id: "refresh-call-4" });
    const prepared4 = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event4, pluginRoot: defaultRoot, options });
    const consumed4 = consumeNativeReviewReceipt({ stateRoot, token: prepared4.token, input: prepared4.updated_input });
    assert.equal(consumed4.receipt.repository_attribution.status, "unavailable");
    assert.ok(consumed4.receipt.repository_attribution.reason_codes.includes("repository-drift-after-review"));
    const bundle3 = buildFromReceipt(consumed4.receipt, currentSnapshot, verifiedCheck);
    assert.equal(bundle3.delivery_evidence.fields.status, "provisional");
    assert.notEqual(bundle3.review.fields.delivery_status, "verified");
    assert.notEqual(bundle3.review.fields.next_action, "none");
    assert.notEqual(bundle3.delivery_evidence.fields.id, bundle2.delivery_evidence.fields.id);
    assert.match(bundle3.chain_update, /^replace-/);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("native authority rejects a logically inconsistent stored baseline binding", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-baseline-binding-"));
  try {
    const options = nativeOptions();
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(), pluginRoot: defaultRoot, options }).status, "observed");
    const contextPath = conversationFile(stateRoot);
    const context = JSON.parse(readFileSync(contextPath, "utf8"));
    context.mutation_epoch.baseline_hash = "f".repeat(64);
    writeFileSync(contextPath, `${JSON.stringify(context, null, 2)}\n`);
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options }).status, "invalid");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options }).status, "invalid");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("old or corrupt context cannot be recovered from transcript prose", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-invalid-state-"));
  try {
    const conversationHash = hashWorkflowIdentifier("conversation", "conversation-1");
    const path = join(stateRoot, "manual-native-task-review", "conversations", `${conversationHash}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{not-json\n");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot }).status, "invalid");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot }).status, "invalid");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("exact transcript recovery restores only provisional Review activation", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-recovery-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-transcript-"));
  const transcriptPath = join(transcriptRoot, "conversation-1.jsonl");
  try {
    const options = nativeOptions();
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(), pluginRoot: defaultRoot, options }).status, "observed");
    writeFileSync(transcriptPath, `${[
      { role: "assistant", message: { content: [{ type: "text", text: "A transcript Root claim is inert." }] } },
      { role: "user", message: { content: [{ type: "text", text: "Implement Plan" }] } },
      { role: "user", message: { content: [{ type: "text", text: "/review-work" }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    const recoveredInput = reviewEvent({ transcript_path: transcriptPath });
    const recovered = recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options });
    assert.equal(recovered.status, "selected-provisional");
    assert.deepEqual(recovered.review_enforcement, {
      status: "unavailable",
      reason_codes: ["review-observer-unavailable"],
    });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options });
    assert.equal(prepared.status, "prepared");
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
    assert.equal(consumed.receipt.review_selection_source, "transcript-exact-review-command");
    assert.deepEqual(consumed.receipt.review_enforcement.reason_codes, ["review-observer-unavailable"]);

    for (const text of ["/review-work please", "Do not /review-work", "`/review-work`"]) {
      writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text }] } })}\n`);
      assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).status, "unavailable");
    }
    writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "/review-work" }] } })}\nnot-json\n`);
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).status, "unavailable");
    const symlinkPath = join(transcriptRoot, "conversation-1-link.jsonl");
    symlinkSync(transcriptPath, symlinkPath);
    assert.equal(recoverNativeReviewSelection({
      stateRoots: [stateRoot],
      input: { ...recoveredInput, transcript_path: symlinkPath },
      pluginRoot: defaultRoot,
      options,
    }).status, "unavailable");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("transcript recovery and exact Shell authorization reject every missing host binding", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-recovery-boundaries-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-transcript-boundaries-"));
  const transcriptPath = join(transcriptRoot, "conversation-1.jsonl");
  const wrongTranscriptPath = join(transcriptRoot, "wrong-conversation.jsonl");
  try {
    const options = nativeOptions();
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(), pluginRoot: defaultRoot, options }).status, "observed");
    assert.deepEqual(authorizeNativeReviewShell({
      stateRoots: [stateRoot],
      input: { ...reviewEvent(), tool_name: "Shell", tool_input: { command: "git status --short" } },
      pluginRoot: defaultRoot,
      options,
    }), { status: "denied", reason: "review-selection-unavailable" });

    const recoveredInput = reviewEvent({ transcript_path: transcriptPath });
    assert.equal(recoverNativeReviewSelection({
      stateRoots: [stateRoot],
      input: { ...recoveredInput, transcript_path: "conversation-1.jsonl" },
      pluginRoot: defaultRoot,
      options,
    }).reason, "transcript-binding-unavailable");

    writeFileSync(wrongTranscriptPath, `${JSON.stringify({ role: "user", content: "/review-work" })}\n`);
    assert.equal(recoverNativeReviewSelection({
      stateRoots: [stateRoot],
      input: { ...recoveredInput, transcript_path: wrongTranscriptPath },
      pluginRoot: defaultRoot,
      options,
    }).reason, "transcript-conversation-mismatch");

    writeFileSync(transcriptPath, "");
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).reason, "transcript-empty");
    writeFileSync(transcriptPath, "[]\n");
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).reason, "transcript-invalid");
    writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "No user command." })}\n`);
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).reason, "transcript-user-message-invalid");
    writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", content: [{ type: "image", url: "inert" }] })}\n`);
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).reason, "transcript-user-message-invalid");
    writeFileSync(transcriptPath, "x");
    truncateSync(transcriptPath, 32 * 1024 * 1024 + 1);
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).reason, "transcript-path-invalid");

    writeFileSync(transcriptPath, `${JSON.stringify({
      role: "user",
      content: [{ type: "text", text: "/review-work" }, { type: "text", text: "duplicate" }],
    })}\n`);
    assert.equal(recoverNativeReviewSelection({ stateRoots: [stateRoot], input: recoveredInput, pluginRoot: defaultRoot, options }).reason, "transcript-user-message-invalid");

    writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", text: "/review-work" })}\n`);
    const { conversation_id: ignoredConversationId, ...sessionBoundInput } = recoveredInput;
    assert.equal(recoverNativeReviewSelection({
      stateRoots: [stateRoot],
      input: { ...sessionBoundInput, session_id: "conversation-1" },
      pluginRoot: defaultRoot,
      options,
    }).status, "selected-provisional");

    writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", content: "/review-work" })}\n`);
    assert.equal(recoverNativeReviewSelection({
      stateRoots: [stateRoot],
      input: { ...recoveredInput, workspace_roots: [stateRoot], cwd: stateRoot },
      pluginRoot: defaultRoot,
      options: { captureSnapshot: options.captureSnapshot },
    }).reason, "recovery-workspace-mismatch");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("repository fingerprints and unknown lock owners remain fail-closed", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-native-fingerprint-lock-"));
  const directory = join(root, "directory");
  const file = join(root, "file.txt");
  const link = join(root, "link.txt");
  const fifo = join(root, "pipe");
  const lock = join(root, "unknown.lock");
  try {
    mkdirSync(directory);
    writeFileSync(file, "content\n");
    symlinkSync(file, link);
    assert.match(repositoryPathFingerprint(root, "directory"), /^directory:/);
    assert.match(repositoryPathFingerprint(root, "file.txt"), /^file:/);
    assert.match(repositoryPathFingerprint(root, "link.txt"), /^symlink:/);
    assert.equal(repositoryPathFingerprint(root, "missing.txt"), "missing");
    assert.throws(() => repositoryPathFingerprint(root, "\0"), /path|argument|null/i);
    assert.equal(spawnSync("mkfifo", [fifo]).status, 0);
    assert.match(repositoryPathFingerprint(root, "pipe"), /^other:/);

    mkdirSync(lock);
    writeFileSync(join(lock, "owner.json"), "{}\n");
    assert.throws(() => withNativeStateLock(lock, () => {}, { lockWaitMs: 0 }), (error) => error?.code === "native-state-busy");
    assert.equal(existsSync(lock), true);
    const invalidTimeLock = join(root, "invalid-time.lock");
    assert.throws(() => withNativeStateLock(invalidTimeLock, () => {}, { now: () => "not-a-date" }), /Invalid time value/);
    assert.equal(existsSync(invalidTimeLock), false);

    const replacedDeadLock = join(root, "replaced-dead.lock");
    mkdirSync(replacedDeadLock);
    writeFileSync(join(replacedDeadLock, "owner.json"), `${JSON.stringify({
      owner_token: "stale-owner-token-000001",
      pid: 999999,
      acquired_at: "2000-01-01T00:00:00.000Z",
    })}\n`);
    assert.throws(() => withNativeStateLock(replacedDeadLock, () => {}, {
      lockWaitMs: 0,
      lockStaleMs: 0,
      now: () => "2026-08-24T00:00:00.000Z",
      pidIsAlive: () => {
        writeFileSync(join(replacedDeadLock, "owner.json"), `${JSON.stringify({
          owner_token: "replacement-owner-token-01",
          pid: process.pid,
          acquired_at: "2026-08-24T00:00:00.000Z",
        })}\n`);
        return false;
      },
    }), (error) => error?.code === "native-state-busy");
    assert.equal(JSON.parse(readFileSync(join(replacedDeadLock, "owner.json"), "utf8")).owner_token, "replacement-owner-token-01");

    const vanishedDeadLock = join(root, "vanished-dead.lock");
    mkdirSync(vanishedDeadLock);
    writeFileSync(join(vanishedDeadLock, "owner.json"), `${JSON.stringify({
      owner_token: "vanished-owner-token-0001",
      pid: 999998,
      acquired_at: "2000-01-01T00:00:00.000Z",
    })}\n`);
    assert.throws(() => withNativeStateLock(vanishedDeadLock, () => {}, {
      lockWaitMs: 0,
      lockStaleMs: 0,
      now: () => "2026-08-24T00:00:00.000Z",
      pidIsAlive: () => {
        rmSync(vanishedDeadLock, { recursive: true, force: true });
        return false;
      },
    }), (error) => error?.code === "native-state-busy");

    const unprobeableLock = join(root, "unprobeable.lock");
    mkdirSync(unprobeableLock);
    writeFileSync(join(unprobeableLock, "owner.json"), `${JSON.stringify({
      owner_token: "unprobeable-owner-token-01",
      pid: Number.MAX_SAFE_INTEGER,
      acquired_at: "2000-01-01T00:00:00.000Z",
    })}\n`);
    assert.throws(() => withNativeStateLock(unprobeableLock, () => {}, {
      lockWaitMs: 0,
      lockStaleMs: 0,
      now: () => "2026-08-24T00:00:00.000Z",
    }), (error) => error?.code === "native-state-busy");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ambiguous repositories and missing enforcement metadata stay non-authoritative", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-ambiguous-workspace-"));
  const otherRepository = mkdtempSync(join(tmpdir(), "workflow-native-other-repository-"));
  const fallbackRoots = [
    mkdtempSync(join(tmpdir(), "workflow-native-explicit-enforcement-")),
    mkdtempSync(join(tmpdir(), "workflow-native-recovered-enforcement-")),
  ];
  try {
    assert.equal(spawnSync("git", ["init", "-q", otherRepository]).status, 0);
    const ambiguous = observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({ workspace_roots: [defaultRoot, otherRepository] }),
      pluginRoot: defaultRoot,
      options: { captureSnapshot: () => ({ ...baseline }) },
    });
    assert.equal(ambiguous.status, "observed");
    assert.equal(readConversation(stateRoot).active.workspace_root, null);

    for (const [index, source] of ["explicit-review-command", "transcript-exact-review-command"].entries()) {
      const currentRoot = fallbackRoots[index];
      const options = establishReview(currentRoot);
      const context = readConversation(currentRoot);
      context.review_selection.source = source;
      delete context.review_selection.review_enforcement;
      writeConversation(currentRoot, context);
      const prepared = prepareNativeReviewReceipt({ stateRoots: [currentRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
      assert.equal(prepared.status, "prepared");
      const consumed = consumeNativeReviewReceipt({ stateRoot: currentRoot, token: prepared.token, input: prepared.updated_input });
      assert.equal(consumed.receipt.review_enforcement.status, source === "explicit-review-command" ? "enforced" : "unavailable");
    }
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(otherRepository, { recursive: true, force: true });
    for (const root of fallbackRoots) rmSync(root, { recursive: true, force: true });
  }
});

test("owner tokens prevent an older lock holder from deleting a replacement lock", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-native-owner-lock-"));
  const lock = join(root, "turn.lock");
  try {
    withNativeStateLock(lock, () => {
      rmSync(lock, { recursive: true, force: true });
      mkdirSync(lock);
      writeFileSync(join(lock, "owner.json"), `${JSON.stringify({
        owner_token: "replacement-owner-token-0001",
        pid: process.pid,
        acquired_at: new Date().toISOString(),
      })}\n`);
    }, { ownerToken: "original-owner-token-00001" });
    assert.equal(existsSync(lock), true);
    assert.equal(JSON.parse(readFileSync(join(lock, "owner.json"), "utf8")).owner_token, "replacement-owner-token-0001");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a live lock owner remains exclusive across processes even after the stale threshold", async () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-native-process-lock-"));
  const lock = join(root, "shared.lock");
  const moduleUrl = new URL("../src/core/native-task-review-state.mjs", import.meta.url).href;
  const child = spawn(process.execPath, ["--input-type=module", "-e", [
    `import { withNativeStateLock } from ${JSON.stringify(moduleUrl)};`,
    `withNativeStateLock(${JSON.stringify(lock)}, () => { process.stdout.write("held\\n"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 350); });`,
  ].join("\n")], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.stdout.once("data", (chunk) => String(chunk).includes("held") ? resolve() : reject(new Error("child did not acquire lock")));
    });
    assert.throws(() => withNativeStateLock(lock, () => {}, { lockWaitMs: 25, lockStaleMs: -1 }), (error) => error?.code === "native-state-busy");
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`lock child exited ${code}`)));
    });
    assert.equal(withNativeStateLock(lock, () => "acquired", { lockWaitMs: 25, lockStaleMs: -1 }), "acquired");
  } finally {
    child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});

test("conversation locking and CreatePlan transitions stay fail-closed and idempotent", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-locking-"));
  const conversationHash = hashWorkflowIdentifier("conversation", "conversation-1");
  const lock = join(stateRoot, "manual-native-task-review", "locks", `${conversationHash}.lock`);
  try {
    mkdirSync(lock, { recursive: true });
    assert.throws(() => observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent(),
      pluginRoot: defaultRoot,
      options: nativeOptions({ lockWaitMs: 15, lockStaleMs: 60_000 }),
    }), (error) => error?.code === "native-state-busy");

    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({
      owner_token: "dead-owner-token-0001",
      pid: 999999,
      acquired_at: "2000-01-01T00:00:00.000Z",
    })}\n`);

    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent(),
      pluginRoot: defaultRoot,
      options: nativeOptions({ lockStaleMs: -1 }),
    }).status, "observed");
    assert.deepEqual(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent(),
      pluginRoot: defaultRoot,
      options: nativeOptions(),
    }), { status: "observed", root_plan_id: "wp-adaptive-retry", duplicate: true });

    const conflictingRoot = rootPlan.replaceAll("wp-adaptive-retry", "wp-conflicting-retry");
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({ tool_use_id: "conflicting-call", tool_input: { name: "Conflicting retry", plan: conflictingRoot } }),
      pluginRoot: defaultRoot,
      options: nativeOptions(),
    }).status, "ambiguous");

    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({ generation_id: "replacement-generation", tool_use_id: "replacement-call" }),
      pluginRoot: defaultRoot,
      options: nativeOptions(),
    }).status, "observed");
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: reviewSelection(), pluginRoot: defaultRoot, options: nativeOptions() }).status, "selected");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options: nativeOptions() });
    assert.equal(prepared.status, "prepared");
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({ generation_id: "invalid-generation", tool_use_id: "invalid-call", tool_input: { name: "Invalid", plan: "not a Root" } }),
      pluginRoot: defaultRoot,
      options: nativeOptions(),
    }).status, "superseded");
    assert.equal(existsSync(nativeReviewReceiptPath(stateRoot, prepared.token, "revoked")), true);
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({ generation_id: "still-invalid", tool_use_id: "still-invalid", tool_input: null }),
      pluginRoot: defaultRoot,
      options: nativeOptions(),
    }).status, "superseded");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("workspace and baseline discovery represent absent or failed observation honestly", () => {
  const absentRoot = mkdtempSync(join(tmpdir(), "workflow-native-no-workspace-"));
  const failedRoot = mkdtempSync(join(tmpdir(), "workflow-native-failed-baseline-"));
  const advertisedRoot = mkdtempSync(join(tmpdir(), "workflow-native-advertised-workspace-"));
  const ambiguousWorkspaceRoot = mkdtempSync(join(tmpdir(), "workflow-native-ambiguous-workspace-"));
  try {
    const absent = observeNativeCreatePlan({
      stateRoots: [absentRoot],
      input: createEvent({ workspace_roots: undefined, cwd: undefined }),
      pluginRoot: defaultRoot,
      options: {},
    });
    assert.equal(absent.baseline_status, "unavailable");
    assert.equal(readConversation(absentRoot).baseline_reason, "workspace-unavailable");

    const failed = observeNativeCreatePlan({
      stateRoots: [failedRoot],
      input: createEvent({ workspace_roots: undefined, cwd: "/path/that/does/not/exist" }),
      pluginRoot: defaultRoot,
      options: { captureSnapshot: () => { throw new Error("snapshot probe failed"); } },
    });
    assert.equal(failed.baseline_status, "unavailable");
    assert.equal(readConversation(failedRoot).baseline_reason, "workspace-unavailable");

    const advertised = observeNativeCreatePlan({
      stateRoots: [advertisedRoot],
      input: createEvent({ workspace_roots: [defaultRoot] }),
      pluginRoot: defaultRoot,
      options: { captureSnapshot: () => ({ ...baseline }) },
    });
    assert.equal(advertised.baseline_status, "captured");
    assert.equal(readConversation(advertisedRoot).active.workspace_root, defaultRoot);

    const ambiguousWorkspace = observeNativeCreatePlan({
      stateRoots: [ambiguousWorkspaceRoot],
      input: createEvent({ workspace_roots: [defaultRoot, advertisedRoot], cwd: defaultRoot }),
      pluginRoot: defaultRoot,
      options: {},
    });
    assert.equal(ambiguousWorkspace.baseline_status, "unavailable");
    assert.equal(readConversation(ambiguousWorkspaceRoot).active.workspace_root, null);
  } finally {
    rmSync(absentRoot, { recursive: true, force: true });
    rmSync(failedRoot, { recursive: true, force: true });
    rmSync(advertisedRoot, { recursive: true, force: true });
    rmSync(ambiguousWorkspaceRoot, { recursive: true, force: true });
  }
});

test("predecessor validation rejects malformed, conflicting, foreign, and unproven artifacts", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-predecessor-matrix-"));
  try {
    const options = establishReview(stateRoot);
    const original = readConversation(stateRoot);
    const bundle = buildManualReviewLifecycle({
      rootPlanText: rootPlan,
      reviewInput: achievedReviewInput,
      checkEvidence: [verifiedCheck],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: baseline,
      captureSnapshot: options.captureSnapshot,
    });
    const evidence = { label: bundle.delivery_evidence.fields.id, text: bundle.delivery_evidence.artifact };
    const review = { label: bundle.review.fields.id, text: bundle.review.artifact, builder_provenance: bundle.review.provenance };
    const selectWith = (artifacts, generationId) => {
      writeConversation(stateRoot, { ...original, artifacts, review_selection: null, inflight: null });
      return selectNativeReviewRoot({
        stateRoots: [stateRoot],
        input: reviewSelection({ generation_id: generationId }),
        pluginRoot: defaultRoot,
        options,
      });
    };

    assert.equal(selectWith([{ label: "broken", text: "not an artifact" }], "invalid-artifact").status, "invalid");
    assert.equal(selectWith([{ label: "root", text: rootPlan }], "unexpected-artifact").status, "invalid");
    assert.equal(selectWith([evidence, { ...evidence, text: `${evidence.text}\n` }], "conflicting-artifact").status, "invalid");

    const foreignRoot = rootPlan.replaceAll("wp-adaptive-retry", "wp-foreign-retry");
    const foreign = buildManualReviewLifecycle({
      rootPlanText: foreignRoot,
      reviewInput: achievedReviewInput,
      checkEvidence: [verifiedCheck],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: baseline,
      captureSnapshot: options.captureSnapshot,
    });
    assert.equal(selectWith([{ label: foreign.delivery_evidence.fields.id, text: foreign.delivery_evidence.artifact }], "foreign-artifact").status, "invalid");
    assert.equal(selectWith([evidence, { label: review.label, text: review.text }], "missing-provenance").status, "invalid");

    assert.equal(selectWith([evidence], "evidence-only").status, "selected");
    const evidenceOnly = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ generation_id: "evidence-only", tool_use_id: "evidence-only-call" }),
      pluginRoot: defaultRoot,
      options,
    });
    assert.equal(evidenceOnly.status, "prepared");
    const rebuilt = consumeNativeReviewReceipt({ stateRoot, token: evidenceOnly.token, input: evidenceOnly.updated_input });
    assert.equal(rebuilt.receipt.predecessor_mode, "full-rebuild");
    assert.deepEqual(rebuilt.receipt.artifacts, []);

    assert.equal(selectWith([review], "review-only").status, "selected");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("correction selection requires an actionable complete Review and opens a fresh epoch", () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), "workflow-native-correction-empty-"));
  const correctionRoot = mkdtempSync(join(tmpdir(), "workflow-native-correction-ready-"));
  try {
    const emptyOptions = establishReview(emptyRoot);
    assert.equal(beginNativeCorrection({ stateRoots: [emptyRoot], input: { conversation_id: "conversation-1", generation_id: "correction-empty" }, pluginRoot: defaultRoot, options: emptyOptions }).status, "unavailable");
    assert.equal(beginNativeCorrection({ stateRoots: [], input: {}, pluginRoot: defaultRoot }).status, "ambiguous");
    assert.equal(beginNativeCorrection({ stateRoots: [emptyRoot], input: { conversation_id: "conversation-1" }, pluginRoot: defaultRoot }).status, "unavailable");

    const options = establishReview(correctionRoot);
    const event = reviewEvent({ tool_input: { ...reviewEvent().tool_input, review_input: correctionReviewInput } });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [correctionRoot], input: event, pluginRoot: defaultRoot, options });
    consumeNativeReviewReceipt({ stateRoot: correctionRoot, token: prepared.token, input: prepared.updated_input });
    const bundle = buildManualReviewLifecycle({
      rootPlanText: rootPlan,
      reviewInput: correctionReviewInput,
      checkEvidence: [verifiedCheck],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: baseline,
      captureSnapshot: options.captureSnapshot,
    });
    assert.equal(bundle.review.fields.next_action, "correct");
    assert.equal(observeNativeReviewResult({
      stateRoots: [correctionRoot],
      input: { ...event, hook_event_name: "postToolUse", tool_output: { structuredContent: reviewOutput(bundle) } },
      pluginRoot: defaultRoot,
      options,
    }).status, "recorded");
    const selected = beginNativeCorrection({
      stateRoots: [correctionRoot],
      input: { conversation_id: "conversation-1", generation_id: "correction-generation" },
      pluginRoot: defaultRoot,
      options,
    });
    assert.equal(selected.status, "selected");
    assert.equal(selected.mutation_epoch.kind, "correction");
    assert.equal(selected.mutation_epoch.boundary, "correction");
    assert.match(selected.mutation_epoch.source_review_id, /^wr-/);
    assert.match(selected.mutation_epoch.correction_id, /^cp-/);
  } finally {
    rmSync(emptyRoot, { recursive: true, force: true });
    rmSync(correctionRoot, { recursive: true, force: true });
  }
});

test("receipt validation checks every immutable authority and baseline binding", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-receipt-matrix-"));
  try {
    assert.equal(nativeReviewReceiptBindingHash(null), null);
    assert.equal(nativeReviewReceiptBindingHash([]), null);
    assert.equal(nativeReviewReceiptPath(stateRoot, "short"), null);
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: null }), { status: "unavailable" });

    const options = establishReview(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const path = nativeReviewReceiptPath(stateRoot, prepared.token);
    const original = JSON.parse(readFileSync(path, "utf8"));
    const variants = [
      ["schema", (value) => { value.schema = 1; }],
      ["kind", (value) => { value.kind = "other"; }],
      ["token hash", (value) => { value.token_hash = "0".repeat(64); }],
      ["request hash", (value) => { value.request_hash = "0".repeat(64); }],
      ["workspace hash", (value) => { value.workspace_hash = "0".repeat(32); }],
      ["conversation hash", (value) => { value.conversation_hash = "bad"; }],
      ["generation hash", (value) => { value.generation_hash = "bad"; }],
      ["tool hash", (value) => { value.tool_hash = "bad"; }],
      ["context revision type", (value) => { value.context_revision = "1"; }],
      ["context revision value", (value) => { value.context_revision = 0; }],
      ["root hash syntax", (value) => { value.root_hash = "bad"; }],
      ["root text type", (value) => { value.root_text = null; }],
      ["root hash binding", (value) => { value.root_text += "\n"; }],
      ["root binding missing", (value) => { value.root_binding = null; }],
      ["root binding status", (value) => { value.root_binding.status = "other"; }],
      ["root binding source", (value) => { value.root_binding.source = "recent-plan-file-stop"; }],
      ["root binding reasons type", (value) => { value.root_binding.reason_codes = null; }],
      ["enforced root binding reasons", (value) => { value.root_binding.reason_codes = ["native-plan-transcript-unavailable"]; }],
      ["root source binding", (value) => { value.root_source = "cursor-plan-file"; }],
      ["artifact collection", (value) => { value.artifacts = null; }],
      ["predecessor mode", (value) => { value.predecessor_mode = "other"; }],
      ["predecessor cardinality", (value) => { value.artifacts = [{ label: "x", text: "x" }]; }],
      ["repository attribution", (value) => { value.repository_attribution = null; }],
      ["mutation epoch", (value) => { value.mutation_epoch = null; }],
      ["epoch id", (value) => { value.mutation_epoch.id = "bad"; }],
      ["epoch status", (value) => { value.mutation_epoch.status = "other"; }],
      ["workspace root type", (value) => { value.workspace_root = null; }],
      ["baseline repository root", (value) => { value.baseline.repository_root = null; }],
      ["baseline hash", (value) => { value.baseline_hash = "0".repeat(64); }],
      ["epoch baseline hash", (value) => { value.mutation_epoch.baseline_hash = "0".repeat(64); }],
      ["baseline availability", (value) => { value.repository_attribution.baseline_available = false; }],
      ["attribution baseline hash", (value) => { value.repository_attribution.baseline_hash = "0".repeat(64); }],
      ["null baseline keeps hash", (value) => { value.baseline = null; }],
      ["null baseline keeps epoch hash", (value) => { value.baseline = null; value.baseline_hash = null; }],
      ["null baseline claims availability", (value) => {
        value.baseline = null;
        value.baseline_hash = null;
        value.mutation_epoch.baseline_hash = null;
      }],
      ["null baseline keeps attribution hash", (value) => {
        value.baseline = null;
        value.baseline_hash = null;
        value.mutation_epoch.baseline_hash = null;
        value.repository_attribution.baseline_available = false;
      }],
      ["workspace binding", (value) => { value.workspace_root = "/different/workspace"; }],
      ["review enforcement missing", (value) => { value.review_enforcement = null; }],
      ["review enforcement status", (value) => { value.review_enforcement.status = "other"; }],
      ["review enforcement reasons type", (value) => { value.review_enforcement.reason_codes = null; }],
      ["review enforcement reason value", (value) => { value.review_enforcement.reason_codes = [1]; }],
      ["enforced review cannot report limitations", (value) => { value.review_enforcement.reason_codes = ["review-observer-unavailable"]; }],
      ["unavailable review needs observer reason", (value) => { value.review_enforcement = { status: "unavailable", reason_codes: [] }; }],
      ["expiration", (value) => { value.expires_at = "not-a-date"; }],
    ];
    for (const [label, mutate] of variants) {
      const value = structuredClone(original);
      mutate(value);
      value.binding_hash = nativeReviewReceiptBindingHash(value);
      atomicNativeReviewReceipt(path, value);
      assert.deepEqual(
        consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }),
        { status: "mismatch" },
        label,
      );
    }
    atomicNativeReviewReceipt(path, { ...original, binding_hash: "0".repeat(64) });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }), { status: "mismatch" });

    atomicNativeReviewReceipt(path, original);
    assert.equal(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }).status, "resolved");
    assert.deepEqual(consumeNativeReviewReceipt({
      stateRoot,
      token: prepared.token,
      input: { ...prepared.updated_input, summary: "different semantic request" },
    }), { status: "mismatch" });
    const consumedPath = nativeReviewReceiptPath(stateRoot, prepared.token, "consumed");
    const consumed = JSON.parse(readFileSync(consumedPath, "utf8"));
    atomicNativeReviewReceipt(consumedPath, { ...consumed, binding_hash: "f".repeat(64) });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input }), { status: "mismatch" });

    assert.throws(() => atomicNativeReviewReceipt(
      join(stateRoot, "oversized.json"),
      { value: "x".repeat(2 * 1024 * 1024) },
    ), /exceeds size limit/);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("a non-canonical workspace blocks Review receipt creation without affecting CreatePlan observation", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-receipt-no-baseline-"));
  try {
    const create = createEvent({ workspace_roots: undefined, cwd: undefined });
    assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: create, pluginRoot: defaultRoot, options: {} }).status, "observed");
    const selection = reviewSelection({ workspace_roots: undefined, cwd: undefined });
    assert.equal(selectNativeReviewRoot({ stateRoots: [stateRoot], input: selection, pluginRoot: defaultRoot, options: {} }).status, "selected");
    const event = reviewEvent({ workspace_roots: undefined, cwd: undefined });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: {} });
    assert.equal(prepared.status, "mismatch");
    assert.equal(prepared.reason, "repository-mutated-during-review");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("post-build validation distinguishes every task-local drift dimension", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-receipt-drift-matrix-"));
  try {
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt: null }), { status: "invalid" });
    const options = establishReview(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    const receipt = consumed.receipt;
    const original = readConversation(stateRoot);
    rmSync(conversationFile(stateRoot));
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt }), { status: "drift", reason: "context-unavailable" });

    writeConversation(stateRoot, { ...original, active: { ...original.active, root_hash: "0".repeat(64) } });
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt }), { status: "drift", reason: "root-drift" });
    writeConversation(stateRoot, { ...original, mutation_epoch: { ...original.mutation_epoch, id: "0".repeat(64) } });
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt }), { status: "drift", reason: "mutation-epoch-drift" });
    writeConversation(stateRoot, { ...original, inflight: { ...original.inflight, token_hash: "0".repeat(64) } });
    assert.deepEqual(validateConsumedNativeReviewReceipt({ stateRoot, receipt }), { status: "drift", reason: "review-inflight-drift" });
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("failed Review output revokes only its exact inflight authority", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-failure-"));
  try {
    assert.equal(failNativeReview({ stateRoots: [], input: {} }).status, "ambiguous");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: {} }).status, "unavailable");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: reviewEvent() }).status, "ignored");
    const options = establishReview(stateRoot);
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot, options });
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: reviewEvent({ generation_id: "other-generation" }), options }).status, "ignored");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: reviewEvent({ tool_use_id: "other-tool" }), options }).status, "ignored");
    assert.equal(failNativeReview({ stateRoots: [stateRoot], input: reviewEvent(), options }).status, "revoked");
    assert.equal(existsSync(nativeReviewReceiptPath(stateRoot, prepared.token, "revoked")), true);
    assert.equal(readConversation(stateRoot).inflight, null);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("Review output parsing is bounded and validates every host-owned field", () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), "workflow-native-output-empty-"));
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-output-matrix-"));
  try {
    const postInput = { ...reviewEvent(), hook_event_name: "postToolUse" };
    for (const toolOutput of [
      undefined,
      null,
      [],
      [null, { text: "{not-json" }],
      "{not-json",
      "1",
      1,
      { structuredContent: "not-an-object" },
      { result: { output: { content: { result: { output: { artifact_kind: "work-review" } } } } } },
    ]) {
      assert.equal(observeNativeReviewResult({
        stateRoots: [emptyRoot],
        input: { ...postInput, tool_output: toolOutput },
        pluginRoot: defaultRoot,
      }).status, "ignored");
    }

    const options = establishReview(stateRoot);
    const event = reviewEvent();
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.token, input: prepared.updated_input });
    const bundle = buildFromReceipt(consumed.receipt, baseline, verifiedCheck);
    const output = reviewOutput(bundle);
    const result = (toolOutput, overrides = {}) => observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...event, hook_event_name: "postToolUse", tool_output: toolOutput, ...overrides },
      pluginRoot: defaultRoot,
      options,
    });

    assert.equal(result(output, { tool_name: "MCP:other" }).status, "ignored");
    assert.equal(observeNativeReviewResult({ stateRoots: [], input: postInput, pluginRoot: defaultRoot }).status, "ambiguous");
    assert.equal(result(output, {
      conversation_id: undefined,
      session_id: undefined,
      transcript_path: undefined,
      generation_id: undefined,
      turn_id: undefined,
      tool_use_id: undefined,
      tool_call_id: undefined,
    }).status, "unavailable");
    assert.equal(result({ ...output, root_plan_id: "wp-other-root" }).status, "mismatch");
    assert.equal(result(output, { generation_id: "other-generation" }).status, "mismatch");
    assert.equal(result(output, { tool_use_id: "other-tool" }).status, "mismatch");

    const invalidOutputs = [
      { ...output, delivery_evidence_artifact: "not an artifact" },
      { ...output, artifact: "not an artifact" },
      { ...output, delivery_evidence_hash: "0".repeat(64) },
      { ...output, artifact_hash: "0".repeat(64) },
      { ...output, review_input_hash: "invalid" },
      { ...output, repository_state_hash: "invalid" },
      { ...output, chain_update: "replace-everything" },
    ];
    for (const invalid of invalidOutputs) assert.equal(result(invalid).status, "invalid");

    const invalid = invalidOutputs[2];
    for (const wrapped of [
      { structuredContent: invalid },
      { tool_output: invalid },
      { result: invalid },
      { output: invalid },
      { content: invalid },
    ]) assert.equal(result(wrapped).status, "invalid");

    const nestedJson = JSON.stringify({ result: { structuredContent: output } });
    assert.equal(result([{ text: "{not-json" }, { text: nestedJson }]).status, "recorded");

    assert.equal(selectNativeReviewRoot({
      stateRoots: [stateRoot],
      input: reviewSelection({ generation_id: "repository-unavailable-review" }),
      pluginRoot: defaultRoot,
      options: { ...options, captureSnapshot: () => { throw new Error("repository unavailable"); } },
    }).status, "selected");
    assert.ok(readConversation(stateRoot).mutation_epoch.reason_codes.includes("repository-state-unavailable"));
  } finally {
    rmSync(emptyRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("replacement output cannot invent predecessor authority", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-replacement-"));
  try {
    const options = establishReview(stateRoot);
    const firstEvent = reviewEvent();
    const firstPrepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: firstEvent, pluginRoot: defaultRoot, options });
    const firstConsumed = consumeNativeReviewReceipt({ stateRoot, token: firstPrepared.token, input: firstPrepared.updated_input });
    const firstBundle = buildFromReceipt(firstConsumed.receipt, baseline, verifiedCheck);
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: {
        ...firstEvent,
        hook_event_name: "postToolUse",
        tool_output: { structuredContent: { ...reviewOutput(firstBundle), chain_update: "replace-full-tip" } },
      },
      pluginRoot: defaultRoot,
      options,
    }).status, "invalid");
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...firstEvent, hook_event_name: "postToolUse", tool_output: { structuredContent: reviewOutput(firstBundle) } },
      pluginRoot: defaultRoot,
      options,
    }).status, "recorded");

    const secondGeneration = "replacement-review-2";
    assert.equal(selectNativeReviewRoot({
      stateRoots: [stateRoot],
      input: reviewSelection({ generation_id: secondGeneration }),
      pluginRoot: defaultRoot,
      options,
    }).status, "selected");
    const secondEvent = reviewEvent({ generation_id: secondGeneration, tool_use_id: "replacement-call-2" });
    const secondPrepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: secondEvent, pluginRoot: defaultRoot, options });
    const secondConsumed = consumeNativeReviewReceipt({ stateRoot, token: secondPrepared.token, input: secondPrepared.updated_input });
    const secondBundle = buildFromReceipt(secondConsumed.receipt, baseline, verifiedCheck);
    assert.equal(observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: {
        ...secondEvent,
        hook_event_name: "postToolUse",
        tool_output: { structuredContent: { ...reviewOutput(secondBundle), chain_update: "replace-delta-suffix" } },
      },
      pluginRoot: defaultRoot,
      options,
    }).status, "invalid");
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("receipt preparation rolls back partial authority and cleanup never steals locks with unknown owners", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-rollback-"));
  const cleanupRoot = mkdtempSync(join(tmpdir(), "workflow-native-cleanup-"));
  try {
    const options = establishReview(stateRoot);
    let nowCalls = 0;
    const failingOptions = {
      ...options,
      now: () => (++nowCalls === 3 ? "not-a-date" : new Date("2026-08-23T12:00:00.000Z")),
    };
    assert.throws(() => prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent(),
      pluginRoot: defaultRoot,
      options: failingOptions,
    }), /Invalid time value/);
    const pendingDirectory = nativeReviewReceiptDirectory(stateRoot);
    assert.equal(existsSync(pendingDirectory), true);
    assert.deepEqual(readdirSync(pendingDirectory), []);
    assert.equal(readConversation(stateRoot).inflight, null);

    cleanupNativeTaskReviewContext(cleanupRoot);
    const context = join(cleanupRoot, "manual-native-task-review");
    const staleDirectory = join(context, "stale");
    const freshDirectory = join(context, "fresh");
    const staleLock = join(context, "locks", "stale.lock");
    const freshLock = join(context, "locks", "fresh.lock");
    for (const directory of [staleDirectory, freshDirectory, staleLock, freshLock]) mkdirSync(directory, { recursive: true });
    const staleFile = join(staleDirectory, "stale.json");
    const freshFile = join(freshDirectory, "fresh.json");
    const staleOwner = join(staleLock, "owner.json");
    const freshOwner = join(freshLock, "owner.json");
    for (const file of [staleFile, freshFile, staleOwner, freshOwner]) writeFileSync(file, "{}\n");
    const cleanupNow = new Date("2026-08-23T12:00:00.000Z");
    const staleTime = new Date(cleanupNow.getTime() - 31 * 24 * 60 * 60 * 1000);
    for (const path of [staleFile, staleOwner, staleDirectory, staleLock]) utimesSync(path, staleTime, staleTime);
    for (const path of [freshFile, freshOwner, freshDirectory, freshLock]) utimesSync(path, cleanupNow, cleanupNow);

    cleanupNativeTaskReviewContext(cleanupRoot, { now: () => cleanupNow });
    assert.equal(existsSync(staleDirectory), false);
    assert.equal(existsSync(staleLock), true);
    assert.equal(existsSync(freshFile), true);
    assert.equal(existsSync(freshLock), true);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(cleanupRoot, { recursive: true, force: true });
  }
});
