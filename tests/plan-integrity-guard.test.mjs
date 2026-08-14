import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { evaluateCloseoutGuard, readActiveRootPlan, readManualChain, updateManualChain } from "../hooks/closeout-guard.mjs";
import { PLAN_CLOSEOUT_ATTESTATION } from "../src/core/manual-attestation.mjs";
import { finalCloseoutTodo } from "./support/manual-attestation-fixtures.mjs";
import { defaultRoot, rootContentHash } from "../scripts/validate-artifact.source.mjs";

const marker = "[workflow-model-inherit-v1]";
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const rootMatch = rootPlan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const nativePlan = `# Adaptive retry\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}`;
const replanRoot = rootPlan
  .replace("id: wp-adaptive-retry", "id: wp-adaptive-retry-v2")
  .replace("hard_triggers: []", "hard_triggers: []\npredecessor_plan_id: wp-adaptive-retry\nreplan_source_review_id: wr-adaptive-retry");
const replanMatch = replanRoot.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const replanNativePlan = `# Adaptive retry v2\n\n\`\`\`yaml artifact-envelope\n${replanMatch[1]}\n\`\`\`\n${replanMatch[2]}`;
const validReview = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-review.valid.md"), "utf8");
const closeoutGuardModule = new URL("../hooks/closeout-guard.mjs", import.meta.url).href;

function replanReviewText(reviewId = "wr-adaptive-retry") {
  const finding = [
    "| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |",
    "|---|---|---|---|---|---|",
    "| root-boundary | medium | OBJ-1 | CHECK-1 | Current Root cannot authorize the requested change. | A fresh Root is required. |",
  ].join("\n");
  return validReview
    .replace("id: wr-adaptive-retry", `id: ${reviewId}`)
    .replace("assessment: achieved", "assessment: partially-achieved")
    .replace("delivery_status: verified", "delivery_status: blocked")
    .replace("next_action: none", "next_action: replan")
    .replace("Achieved. The required evidence is verified and no finding remains.", "Partially-achieved. A fresh Root is required.")
    .replace("## Findings\n\nNone.", `## Findings\n\n${finding}`)
    .replace("## Next action\n\nNone.", "## Next action\n\nreplan: create a fresh Root.");
}

function seedReplanReview(input, options, reviewId = "wr-adaptive-retry") {
  const artifact = replanReviewText(reviewId);
  assert.equal(updateManualChain(input, {
    current_review: {
      review_artifact_id: reviewId,
      review_artifact: artifact,
      review_artifact_hash: rootContentHash(artifact),
      latest_evidence_id: "de-adaptive-retry",
      next_action: "replan",
      correction_id: null,
      recorded_at: new Date().toISOString(),
    },
    phase_status: "review-complete",
  }, options), true);
  return artifact;
}

function processUpdate(stateRoot, conversationId, key) {
  const code = [
    "const { updateManualChain } = await import(process.env.WORKFLOW_CLOSEOUT_GUARD);",
    "const input = { conversation_id: process.env.WORKFLOW_CONVERSATION };",
    "const key = process.env.WORKFLOW_PATCH_KEY;",
    "if (!updateManualChain(input, { [key]: key }, { stateRoot: process.env.WORKFLOW_STATE_ROOT })) process.exit(2);",
  ].join("\n");
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
      env: {
        ...process.env,
        WORKFLOW_CLOSEOUT_GUARD: closeoutGuardModule,
        WORKFLOW_CONVERSATION: conversationId,
        WORKFLOW_PATCH_KEY: key,
        WORKFLOW_STATE_ROOT: stateRoot,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("exit", (status) => status === 0 ? resolvePromise() : rejectPromise(new Error(`chain update child exited ${status}: ${stderr}`)));
  });
}

function event(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    conversation_id: "create-plan-conversation",
    generation_id: "create-plan-generation",
    tool_name: "CreatePlan",
    tool_use_id: "create-plan-tool-use",
    tool_input: {
      name: "Adaptive retry",
      overview: "Implement and verify deterministic retry handling.",
      plan: nativePlan,
      todos: [
        { id: "STEP-1", content: "STEP-1 implement deterministic retry handling" },
        { ...finalCloseoutTodo, content: `${marker} Run CHECK-1 and close out delivery.` },
      ],
    },
    ...overrides,
  };
}

function post(candidate) {
  return { ...candidate, hook_event_name: "postToolUse" };
}

function promptEvent(prompt, overrides = {}) {
  return {
    hook_event_name: "beforeSubmitPrompt",
    conversation_id: "create-plan-conversation",
    generation_id: "create-plan-generation",
    prompt,
    ...overrides,
  };
}

test("CreatePlan guard accepts a valid native Schema-5 plan", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-valid-"));
  try {
    assert.deepEqual(evaluateCreatePlanGuard(event(), { pluginRoot: defaultRoot, stateRoot }), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("CreatePlan guard accepts typed plan-closeout attestation metadata", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-attestation-"));
  const candidate = event();
  candidate.tool_input.todos[1] = {
    ...finalCloseoutTodo,
    content: `${marker} Verify CHECK-1 and close out delivery.`,
  };
  try {
    assert.deepEqual(evaluateCreatePlanGuard(candidate, { pluginRoot: defaultRoot, stateRoot }), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("CreatePlan guard rejects the KIP pattern without marked deterministic closeout", () => {
  const result = evaluateCreatePlanGuard(event({
    tool_input: {
      name: "Decouple handoff tooling",
      overview: "Remove local handoff guidance.",
      plan: nativePlan,
      todos: [
        { id: "STEP-1", content: "Delete local handoff tooling" },
        { id: "STEP-2", content: "Rewrite project guidance" },
      ],
    },
  }), { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /workflow-model-inherit-v1|final native todo/);
  assert.match(result.user_message, /workflow_attestation|plan-closeout|workflow_closeout|workflow-closeout-v1|closeout/);
  assert.match(result.user_message, /no Plan was created/);
});

test("CreatePlan guard accepts STEP todos without the inheritance marker when closeout is marked", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-step-todos-"));
  try {
    assert.deepEqual(evaluateCreatePlanGuard(event(), { pluginRoot: defaultRoot, stateRoot }), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("CreatePlan guard activates the approved Root only after matching successful postToolUse", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-integrity-coverage-"));
  try {
    const candidate = event({ conversation_id: "create-plan-active-root" });
    const accepted = evaluateCreatePlanGuard(candidate, { pluginRoot: defaultRoot, stateRoot });
    assert.deepEqual(accepted, {});
    assert.equal(readActiveRootPlan(candidate, { stateRoot }), null);
    assert.deepEqual(evaluateCreatePlanGuard(post(candidate), { pluginRoot: defaultRoot, stateRoot }), {});
    const active = readActiveRootPlan(candidate, { stateRoot });
    assert.equal(active.root_plan_id, "wp-adaptive-retry");
    assert.equal(active.root_plan_text, rootPlan);
    assert.match(active.root_content_hash, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("CreatePlan guard rejects infeasible preflight", () => {
  const denied = evaluateCreatePlanGuard(event(), {
    pluginRoot: defaultRoot,
    preflightRootPlan: () => ({
      feasible: false,
      blocking_issues: [{ message: "authority envelope incomplete" }],
    }),
  });
  assert.equal(denied.permission, "deny");
  assert.match(denied.user_message, /Root preflight failed|authority envelope incomplete|no Plan was created/);
});

test("Cursor replan preserves its committed predecessor until a fresh lineage-valid receipt commits", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-replan-receipt-"));
  const options = { pluginRoot: defaultRoot, stateRoot };
  try {
    const initial = event({ generation_id: "gen-initial", tool_use_id: "tool-initial" });
    assert.deepEqual(evaluateCreatePlanGuard(initial, options), {});
    assert.deepEqual(evaluateCreatePlanGuard(post(initial), options), {});
    assert.equal(readActiveRootPlan(initial, options).root_plan_id, "wp-adaptive-retry");
    const predecessorReview = seedReplanReview(initial, options);

    const replanPrompt = promptEvent("/plan-work replan wp-adaptive-retry", { generation_id: "gen-replan" });
    assert.deepEqual(evaluateCreatePlanGuard(replanPrompt, options), {});
    assert.equal(readActiveRootPlan(replanPrompt, options).root_plan_id, "wp-adaptive-retry");
    assert.equal(readManualChain(replanPrompt, options).current_review.review_artifact, predecessorReview);

    const candidate = event({
      generation_id: "gen-replan",
      tool_use_id: "tool-replan",
      tool_input: {
        ...event().tool_input,
        name: "Adaptive retry v2",
        plan: replanNativePlan,
      },
    });
    assert.deepEqual(evaluateCreatePlanGuard(candidate, options), {});
    assert.equal(readActiveRootPlan(candidate, options).root_plan_id, "wp-adaptive-retry");
    assert.deepEqual(evaluateCreatePlanGuard(post(candidate), options), {});
    const active = readActiveRootPlan(candidate, options);
    assert.equal(active.root_plan_id, "wp-adaptive-retry-v2");
    assert.equal(active.root_plan_text, replanRoot);
    const transactionRoot = join(stateRoot, "manual-plan-transactions");
    const conversationDirectory = join(transactionRoot, readdirSync(transactionRoot)[0]);
    const receipts = readdirSync(conversationDirectory)
      .map((name) => JSON.parse(readFileSync(join(conversationDirectory, name), "utf8")))
      .filter((entry) => entry.status === "committed" && entry.mode === "replan");
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].receipt.tool_use_id, "tool-replan");
    assert.equal(receipts[0].receipt.root_plan_id, "wp-adaptive-retry-v2");
    assert.equal(receipts[0].receipt.predecessor_plan_id, "wp-adaptive-retry");
    assert.equal(receipts[0].receipt.replan_source_review_id, "wr-adaptive-retry");
    assert.equal(receipts[0].receipt.predecessor_root_content_hash, rootContentHash(rootPlan));
    assert.equal(receipts[0].receipt.replan_source_review_hash, rootContentHash(predecessorReview));
    assert.match(receipts[0].receipt.root_content_hash, /^[a-f0-9]{64}$/);
    const chain = readManualChain(candidate, options);
    const predecessor = chain.lineage.at(-1);
    assert.equal(predecessor.root.root_plan_text, rootPlan);
    assert.equal(predecessor.root.root_content_hash, rootContentHash(rootPlan));
    assert.equal(predecessor.current_review.review_artifact, predecessorReview);
    assert.equal(predecessor.current_review.review_artifact_hash, rootContentHash(predecessorReview));
    const processRead = spawnSync(process.execPath, ["--input-type=module", "-e", [
      "const { readManualChain } = await import(process.env.WORKFLOW_CLOSEOUT_GUARD);",
      "const chain = readManualChain({ conversation_id: process.env.WORKFLOW_CONVERSATION }, { stateRoot: process.env.WORKFLOW_STATE_ROOT });",
      "process.stdout.write(JSON.stringify(chain));",
    ].join("\n")], {
      encoding: "utf8",
      env: {
        ...process.env,
        WORKFLOW_CLOSEOUT_GUARD: closeoutGuardModule,
        WORKFLOW_CONVERSATION: candidate.conversation_id,
        WORKFLOW_STATE_ROOT: stateRoot,
      },
    });
    assert.equal(processRead.status, 0, processRead.stderr);
    const processChain = JSON.parse(processRead.stdout);
    assert.equal(processChain.lineage.at(-1).root.root_plan_text, rootPlan);
    assert.equal(processChain.lineage.at(-1).current_review.review_artifact, predecessorReview);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("failed, mismatched, and superseded replan receipts preserve the committed predecessor without activating the candidate", () => {
  for (const failure of ["post-mismatch", "tool-failure", "superseded"]) {
    const stateRoot = mkdtempSync(join(tmpdir(), `workflow-plan-replan-${failure}-`));
    const options = { pluginRoot: defaultRoot, stateRoot };
    try {
      const initial = event({ generation_id: `gen-initial-${failure}`, tool_use_id: `tool-initial-${failure}` });
      evaluateCreatePlanGuard(initial, options);
      evaluateCreatePlanGuard(post(initial), options);
      seedReplanReview(initial, options);
      const replanPrompt = promptEvent("/plan-work replan", { generation_id: `gen-replan-${failure}` });
      assert.deepEqual(evaluateCreatePlanGuard(replanPrompt, options), {});
      const candidate = event({
        generation_id: `gen-replan-${failure}`,
        tool_use_id: `tool-replan-${failure}`,
        tool_input: { ...event().tool_input, name: "Adaptive retry v2", plan: replanNativePlan },
      });
      assert.deepEqual(evaluateCreatePlanGuard(candidate, options), {});
      if (failure === "post-mismatch") {
        evaluateCreatePlanGuard(post({ ...candidate, tool_use_id: "foreign-tool-use" }), options);
      } else if (failure === "tool-failure") {
        evaluateCreatePlanGuard({ ...candidate, hook_event_name: "postToolUseFailure", failure_type: "error" }, options);
      } else {
        evaluateCreatePlanGuard(promptEvent("ordinary unrelated prompt", { generation_id: "gen-new-human" }), options);
        evaluateCreatePlanGuard(post(candidate), options);
      }
      const active = readActiveRootPlan(candidate, options);
      const chain = readManualChain(candidate, options);
      assert.equal(active.root_plan_id, "wp-adaptive-retry", failure);
      assert.equal(active.root_plan_text, rootPlan, failure);
      assert.equal(chain.root.root_plan_id, "wp-adaptive-retry", failure);
      assert.equal(chain.current_review.review_artifact_id, "wr-adaptive-retry", failure);
      assert.equal(chain.current_review.next_action, "replan", failure);
      const implicitResume = evaluateCloseoutGuard({
        hook_event_name: "beforeSubmitPrompt",
        conversation_id: candidate.conversation_id,
        generation_id: `implicit-predecessor-resume-${failure}`,
        prompt: "Implement Plan",
      }, options);
      assert.equal(implicitResume.permission, "deny", failure);
      assert.match(implicitResume.user_message, /requires replan|recovery context/i, failure);
      assert.deepEqual(evaluateCreatePlanGuard(promptEvent("/plan-work replan", {
        generation_id: `retry-replan-${failure}`,
      }), options), {}, failure);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  }
});

test("replan requires explicit intent, fresh identity, and exact predecessor lineage", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-replan-lineage-"));
  const options = { pluginRoot: defaultRoot, stateRoot };
  try {
    const lineageWithoutPrompt = event({
      generation_id: "lineage-without-prompt",
      tool_use_id: "lineage-without-prompt-tool",
      tool_input: { ...event().tool_input, plan: replanNativePlan },
    });
    assert.match(evaluateCreatePlanGuard(lineageWithoutPrompt, options).user_message, /explicit \/plan-work replan/i);

    const initial = event({ generation_id: "lineage-initial", tool_use_id: "lineage-initial-tool" });
    evaluateCreatePlanGuard(initial, options);
    evaluateCreatePlanGuard(post(initial), options);
    seedReplanReview(initial, options);
    evaluateCreatePlanGuard(promptEvent("/plan-work replan", { generation_id: "lineage-replan" }), options);
    for (const plan of [
      replanNativePlan.replace("id: wp-adaptive-retry-v2", "id: wp-adaptive-retry"),
      replanNativePlan.replace("predecessor_plan_id: wp-adaptive-retry", "predecessor_plan_id: wp-foreign"),
      replanNativePlan.replace("replan_source_review_id: wr-adaptive-retry", "replan_source_review_id: missing"),
    ]) {
      const denied = evaluateCreatePlanGuard(event({
        generation_id: "lineage-replan",
        tool_use_id: `lineage-${plan.length}`,
        tool_input: { ...event().tool_input, plan },
      }), options);
      assert.equal(denied.permission, "deny");
      assert.match(denied.user_message, /fresh wp|predecessor_plan_id|replan_source_review_id|lineage/i);
    }
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("replan binds the exact current Review tip into the fresh CreatePlan receipt", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-current-review-"));
  const options = { pluginRoot: defaultRoot, stateRoot };
  try {
    const initial = event({ generation_id: "current-review-initial", tool_use_id: "current-review-initial-tool" });
    evaluateCreatePlanGuard(initial, options);
    evaluateCreatePlanGuard(post(initial), options);
    const predecessorReview = seedReplanReview(initial, options, "wr-current-replan");

    const prompt = promptEvent("/plan-work replan", { generation_id: "current-review-replan" });
    assert.deepEqual(evaluateCreatePlanGuard(prompt, options), {});
    const candidate = event({
      generation_id: "current-review-replan",
      tool_use_id: "current-review-replan-tool",
      tool_input: {
        ...event().tool_input,
        plan: replanNativePlan.replace("replan_source_review_id: wr-adaptive-retry", "replan_source_review_id: wr-current-replan"),
      },
    });
    assert.deepEqual(evaluateCreatePlanGuard(candidate, options), {});
    assert.deepEqual(evaluateCreatePlanGuard(post(candidate), options), {});
    const chain = readManualChain(candidate, options);
    assert.equal(chain.root.root_plan_id, "wp-adaptive-retry-v2");
    assert.equal(chain.create_plan_receipt.predecessor_plan_id, "wp-adaptive-retry");
    assert.equal(chain.create_plan_receipt.replan_source_review_id, "wr-current-replan");
    assert.equal(chain.create_plan_receipt.predecessor_root_content_hash, rootContentHash(rootPlan));
    assert.equal(chain.create_plan_receipt.replan_source_review_hash, rootContentHash(predecessorReview));
    assert.equal(chain.lineage.at(-1).current_review.review_artifact, predecessorReview);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("replan requires one exact current Review tip", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-replan-review-required-"));
  const options = { pluginRoot: defaultRoot, stateRoot };
  try {
    const initial = event({ generation_id: "review-required-initial", tool_use_id: "review-required-tool" });
    evaluateCreatePlanGuard(initial, options);
    evaluateCreatePlanGuard(post(initial), options);
    const missing = evaluateCreatePlanGuard(promptEvent("/plan-work replan", { generation_id: "review-required-replan" }), options);
    assert.equal(missing.continue, false);
    assert.match(missing.user_message, /exact current Review|fresh Review/i);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Manual chain commits serialize concurrent hook processes without lost updates", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-chain-concurrent-writers-"));
  const conversationId = "concurrent-chain-writers";
  const options = { pluginRoot: defaultRoot, stateRoot };
  try {
    const initial = event({ conversation_id: conversationId, generation_id: "concurrent-initial", tool_use_id: "concurrent-initial-tool" });
    evaluateCreatePlanGuard(initial, options);
    evaluateCreatePlanGuard(post(initial), options);
    const keys = Array.from({ length: 16 }, (_, index) => `concurrent_patch_${index}`);
    await Promise.all(keys.map((key) => processUpdate(stateRoot, conversationId, key)));
    const chain = readManualChain(initial, options);
    for (const key of keys) assert.equal(chain[key], key);
    assert.ok(chain.revision >= keys.length + 2);
    const chainDirectory = join(stateRoot, "manual-chains", readdirSync(join(stateRoot, "manual-chains"))[0]);
    const pointer = JSON.parse(readFileSync(join(chainDirectory, "current.json"), "utf8"));
    assert.equal(pointer.revision, chain.revision);
    assert.ok(readdirSync(chainDirectory).includes(`${chain.root.root_content_hash}.${chain.revision}.json`));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("planning prompt gates reject missing identity, predecessor, and selector drift", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-plan-prompt-gates-"));
  const options = { pluginRoot: defaultRoot, stateRoot };
  try {
    const missingIdentity = evaluateCreatePlanGuard(promptEvent("/plan-work", {
      conversation_id: null,
      generation_id: null,
    }), options);
    assert.equal(missingIdentity.continue, false);
    assert.match(missingIdentity.user_message, /conversation_id.*generation_id/i);

    const missingPredecessor = evaluateCreatePlanGuard(promptEvent("/plan-work replan", {
      generation_id: "missing-predecessor",
    }), options);
    assert.equal(missingPredecessor.continue, false);
    assert.match(missingPredecessor.user_message, /no exact active.*predecessor/i);

    const initial = event({ generation_id: "selector-initial", tool_use_id: "selector-initial-tool" });
    evaluateCreatePlanGuard(initial, options);
    evaluateCreatePlanGuard(post(initial), options);
    const wrongSelector = evaluateCreatePlanGuard(promptEvent("/plan-work replan wp-foreign", {
      generation_id: "selector-replan",
    }), options);
    assert.equal(wrongSelector.continue, false);
    assert.match(wrongSelector.user_message, /wp-foreign.*wp-adaptive-retry/i);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("pending planning rejects omitted Root and missing tool receipt identity", () => {
  for (const failure of ["omitted-root", "missing-tool-use"]) {
    const stateRoot = mkdtempSync(join(tmpdir(), `workflow-plan-stage-${failure}-`));
    const options = { pluginRoot: defaultRoot, stateRoot };
    try {
      const generation_id = `stage-${failure}`;
      assert.deepEqual(evaluateCreatePlanGuard(promptEvent("/plan-work create a Root", { generation_id }), options), {});
      const candidate = event({ generation_id });
      if (failure === "omitted-root") {
        candidate.tool_input = {
          ...candidate.tool_input,
          plan: "# Ordinary plan\n\nImplement a local refactor.",
        };
      } else {
        candidate.tool_use_id = "";
      }
      const denied = evaluateCreatePlanGuard(candidate, options);
      assert.equal(denied.permission, "deny");
      assert.match(denied.user_message, failure === "omitted-root" ? /exact Schema-5 Root/i : /tool_use_id/i);
      assert.equal(readActiveRootPlan(candidate, options), null);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  }
});

test("unrelated hook events and tools stay inert", () => {
  assert.deepEqual(evaluateCreatePlanGuard(event({ hook_event_name: "unknownEvent" }), { pluginRoot: defaultRoot }), {});
  for (const hook_event_name of ["preToolUse", "postToolUse", "postToolUseFailure"]) {
    assert.deepEqual(evaluateCreatePlanGuard(event({ hook_event_name, tool_name: "Read" }), { pluginRoot: defaultRoot }), {});
  }
});

test("CreatePlan guard rejects cache-dependent or noncanonical closeout todos", () => {
  for (const replacement of [
    "call workflow_closeout with cached context, and print its returned artifact unchanged",
    "call workflow_closeout with the exact Root/chain, and report completion",
    "call workflow_closeout with the exact Root/chain, and print the artifact unchanged",
  ]) {
    const candidate = event();
    candidate.tool_input.todos[1].content = `${marker} Run CHECK-1, ${replacement}`;
    const result = evaluateCreatePlanGuard(candidate, { pluginRoot: defaultRoot });
    assert.equal(result.permission, "deny");
  }
});

test("CreatePlan guard leaves ordinary Cursor plans untouched", () => {
  const ordinary = event();
  ordinary.tool_input.plan = "# Ordinary plan\n\nImplement a local refactor.";
  ordinary.tool_input.todos = [{ id: "step", content: "Implement the refactor" }];
  assert.deepEqual(evaluateCreatePlanGuard(ordinary, { pluginRoot: defaultRoot }), {});
});

test("CreatePlan guard fails closed for invalid or todo-less Workflow payloads", () => {
  const invalid = event();
  invalid.tool_input = { name: "Missing plan" };
  assert.equal(evaluateCreatePlanGuard(invalid, { pluginRoot: defaultRoot }).permission, "deny");

  const todoLess = event();
  todoLess.tool_input.todos = [];
  const result = evaluateCreatePlanGuard(todoLess, { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /native todos are required/);
});

test("CreatePlan guard fails closed for malformed hook input without echoing it", () => {
  const hookPath = join(defaultRoot, "hooks", "plan-integrity-guard.mjs");
  const result = spawnSync(process.execPath, [hookPath], { input: "not-json secret-plan", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.permission, "deny");
  assert.doesNotMatch(result.stdout, /secret-plan/);
});
