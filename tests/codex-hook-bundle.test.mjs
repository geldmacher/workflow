import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const hookPath = join(defaultRoot, "dist", "codex", "workflow-hook.mjs");
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");
const rootMatch = rootPlan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const humanDetails = `### Outcome and approach

- Outcome: Retry handling is deterministic without changing the public contract.
- Approach and rationale: Update retry implementation and focused tests while preserving the public API.

### Scope and boundaries

- In scope: Repository changes under src and tests.
- Non-goals: No deployment or external service change.
- Constraints: Preserve the public API and repository-only delivery.

### Verification, risks, and recovery

- Acceptance and verification: Run retry verification twice and confirm the public API remains stable.
- Risks and trade-offs: The main risk is a public-contract regression; prefer the smallest deterministic change.
- Unknowns and recovery: Replan if scope, acceptance, or risk must change.`;
const proposedPlan = `<proposed_plan>\n## Quick decision\n\nImplement the approved Root.\n\n### Next step\n\nHuman: approve Implement Plan.\n\n## Details\n\n${humanDetails}\n\n## Agent and machine contract (authoritative)\n\nThe sections above are human projections. The exact Root below is the only implementation authority.\n\n### Completion handoff\n\nAfter **Implement Plan**, reply in this order: \`Quick decision\` with result, Check summary, optional blocker, and one action (\`Human: start fresh /review-work or $review-work\`); complete human \`Details\` covering outcome, approach, scope/non-goals, verification/limits, risks/unknowns/recovery; then authoritative \`Agent and machine contract\` with exact changed paths, Check commands/directories/observations, failures/uncertainty, and continuation. Do not claim Evidence, Review, or Learning.\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}\n</proposed_plan>`;

function runHook(input, stateRoot) {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: defaultRoot,
    input: JSON.stringify({ session_id: "bundle-session", turn_id: "bundle-turn", model: "gpt-parent", cwd: defaultRoot, ...input }),
    encoding: "utf8",
    env: { ...process.env, PLUGIN_DATA: stateRoot },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout || "{}");
}

function stateFiles(root) {
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
  return walk(root).filter((path) => path.endsWith(".json"));
}

test("built Codex hook validates native Plan without closeout ceremony", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-plan-"));
  try {
    const started = runHook({ hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work bundle" }, stateRoot);
    assert.match(started.hookSpecificOutput.additionalContext, /Native task plans are the only Manual plan authority/);
    assert.deepEqual(runHook({ hook_event_name: "Stop", last_assistant_message: proposedPlan }, stateRoot), {});
    const stored = JSON.parse(readFileSync(stateFiles(stateRoot)[0], "utf8"));
    assert.equal(stored.schema, 2);
    assert.equal(stored.kind, "manual-native-plan-review");
    assert.equal(stored.turn, null);
    assert.equal(stored.active_root_plan_id, undefined);

    runHook({ hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work bundle again" }, stateRoot);
    const denied = runHook({
      hook_event_name: "Stop",
      last_assistant_message: proposedPlan.replace(/## Quick decision[\s\S]*?(?=\`\`\`yaml artifact-envelope)/, "Arbitrary preamble only.\n\n"),
    }, stateRoot);
    assert.equal(denied.decision, "block");
    assert.match(denied.reason, /ordered H2 layers/);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook rejects duplicate Next step sections across human layers", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-layout-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work bundle layout" }, stateRoot);
    const denied = runHook({
      hook_event_name: "Stop",
      last_assistant_message: proposedPlan.replace("## Details", "## Details\n\n### Next step\n\nHuman: take a conflicting second action."),
    }, stateRoot);
    assert.equal(denied.decision, "block");
    assert.match(denied.reason, /exactly one.*Next step|Next step.*exactly one/i);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook requires the native implementation Completion handoff", () => {
  for (const [label, lastAssistantMessage] of [
    ["missing", proposedPlan.replace("### Completion handoff", "### Completion notes")],
    ["incomplete", proposedPlan.replace("Human: start fresh /review-work or $review-work", "Agent: optionally review later")],
  ]) {
    const stateRoot = mkdtempSync(join(tmpdir(), `codex-bundle-handoff-${label}-`));
    try {
      runHook({ hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work bundle handoff" }, stateRoot);
      const denied = runHook({ hook_event_name: "Stop", last_assistant_message: lastAssistantMessage }, stateRoot);
      assert.equal(denied.decision, "block", label);
      assert.match(denied.reason, /Completion handoff/, label);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  }
});

test("built Codex hook rejects incomplete human detail coverage", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-details-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work bundle details" }, stateRoot);
    const denied = runHook({
      hook_event_name: "Stop",
      last_assistant_message: proposedPlan.replace("- Non-goals: No deployment or external service change.", "- Non-goals:"),
    }, stateRoot);
    assert.equal(denied.decision, "block");
    assert.match(denied.reason, /Details coverage|Details requires/);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook stays inactive throughout ordinary implementation", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-implementation-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement this plan" }, stateRoot);
    assert.deepEqual(runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } }, stateRoot), {});
    const stopped = runHook({ hook_event_name: "Stop", last_assistant_message: "Implemented and checked." }, stateRoot);
    assert.deepEqual(stopped, {});
    assert.equal("decision" in stopped, false);
    assert.equal("continue" in stopped, false);
    assert.deepEqual(stateFiles(stateRoot), []);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook cannot turn unavailable inactive state into a host blockade", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-bundle-passive-"));
  const unavailable = join(root, "plugin-data-is-a-file");
  writeFileSync(unavailable, "not a directory");
  try {
    assert.deepEqual(runHook({ hook_event_name: "SessionStart" }, unavailable), {});
    assert.deepEqual(runHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement this plan" }, unavailable), {});
    assert.deepEqual(runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } }, unavailable), {});
    assert.deepEqual(runHook({ hook_event_name: "Stop", last_assistant_message: "Done." }, unavailable), {});

    const active = runHook({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, unavailable);
    assert.equal(active.decision, "block");
    assert.match(active.reason, /Workflow hook failed closed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("built Codex hook enforces read-only Review and admits atomic builder", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-review-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, stateRoot);
    const denied = runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } }, stateRoot);
    assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
    const allowed = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { artifact_kind: "work-review" },
    }, stateRoot);
    assert.deepEqual(allowed, {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook discards legacy state and removed close-work input", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-legacy-"));
  try {
    const ordinary = runHook({ hook_event_name: "UserPromptSubmit", prompt: "$close-work wp-old" }, stateRoot);
    assert.deepEqual(ordinary, {});
    assert.deepEqual(stateFiles(stateRoot), []);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook contains no native recovery prompt surface", () => {
  const bundle = readFileSync(hookPath, "utf8");
  assert.doesNotMatch(bundle, /\$close-work|\/close-work/);
  assert.doesNotMatch(bundle, /followup_message/);
  assert.doesNotMatch(bundle, /active_root_plan_id/);
});
