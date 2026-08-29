import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv from "ajv";
import { inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { executeManualOperation, serializeManualResult } from "../src/manual/manual-workflow.mjs";
import { reviewInputSchema } from "../src/mcp/review-input-contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const rootPlan = readFileSync(join(root, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

function reviewInput(overrides = {}) {
  return {
    schema: 1,
    kind: "review-input",
    assessment: "achieved",
    recommended_action: "none",
    assessment_summary: "The acceptance outcome is present in the inspected repository state.",
    snapshot_assessment: "consistent",
    snapshot_summary: "The supplied read-only repository observation is internally consistent.",
    findings: [],
    missing_evidence: [],
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    schema: 1,
    operation: "build-review",
    root_plan: rootPlan,
    artifacts: [],
    review_input: reviewInput(),
    repository_observation: {
      schema: 1,
      kind: "unprotected-repository-observation",
      repository_root: root,
      changed_paths: ["src/controller/manual-status.mjs"],
      snapshot_material: ["tree:fixture-manual-review", "diff:manual-status"],
      limitations: ["Repository observation was supplied by the active project harness without protected attestation."],
    },
    check_observations: [{
      check_id: "CHECK-1",
      grade: "supported",
      observed: "The relevant repository verification completed successfully.",
      evidence_material: ["CHECK-1:pass:fixture"],
      limitations: [],
    }],
    ...overrides,
  };
}

function exactArtifacts(result) {
  return result.artifacts.map(({ label, text }) => ({ label, text }));
}

function correctionContractInput(overrides = {}) {
  return reviewInput({
    assessment: "mostly-achieved",
    recommended_action: "correct",
    findings: [{
      key: "contract-gap",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The bounded contract gap remains.",
      reasoning: "The current delivery needs one correction.",
      resolution: "correct",
    }],
    correction: {
      fixes: [{ key: "close-gap", finding_keys: ["contract-gap"], required_outcome: "Close the gap.", evidence: "The change remains Root-bounded." }],
      checks: [{
        key: "verify-gap",
        fix_keys: ["close-gap"],
        verification_intent: "Verify the corrected outcome.",
        expected_evidence: "Current repository evidence.",
        evidence_class: "harness-verifiable",
        required: true,
        cost_class: "standard",
        prerequisites: ["The correction is complete."],
      }],
      steps: [{
        key: "apply-gap",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Close the gap.",
        implementation_latitude: "The harness selects implementation details.",
        completion_probe: "The corrected outcome is observable.",
        check_keys: ["verify-gap"],
        deviation_action: "Replan if authority changes.",
      }],
      learning_candidates: [{
        key: "retain-contract",
        finding_keys: ["contract-gap"],
        reusable_guidance: "Keep the boundary explicit.",
        candidate_targets: ["project guidance"],
        confirmation_evidence: "Verified corrected delivery.",
      }],
    },
    ...overrides,
  });
}

test("Manual builder validates a Root without MCP or state", () => {
  const result = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: rootPlan });
  assert.equal(result.ok, true);
  assert.equal(result.root_plan_id, "wp-adaptive-retry");
  assert.equal(result.artifacts.length, 0);
  assert.match(result.human_output, /implement-plan/);
});

test("public Manual request schema is closed and matches the runtime contract", () => {
  const schema = JSON.parse(readFileSync(join(root, "schemas", "manual-workflow", "request-1.schema.json"), "utf8"));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(request()), true, JSON.stringify(validate.errors));
  const invalid = request();
  invalid.repository_observation.attestation_hash = "a".repeat(64);
  assert.equal(validate(invalid), false);
  assert.ok(validate.errors.some((error) => error.keyword === "additionalProperties"));
});

test("public Review-input length limits match the runtime at every distinct boundary", () => {
  const schema = JSON.parse(readFileSync(join(root, "schemas", "manual-workflow", "request-1.schema.json"), "utf8"));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const cases = [
    {
      name: "normal Review text",
      maximum: 2_000,
      input: (length) => reviewInput({ assessment_summary: "x".repeat(length) }),
    },
    {
      name: "Finding evidence",
      maximum: 4_000,
      input: (length) => reviewInput({
        assessment: "partially-achieved",
        recommended_action: "clarify",
        findings: [{
          key: "length-gap",
          severity: "medium",
          objective_ids: ["OBJ-1"],
          check_ids: ["CHECK-1"],
          evidence: "x".repeat(length),
          reasoning: "The boundary needs clarification.",
          resolution: "clarify",
        }],
      }),
    },
    {
      name: "correction target",
      maximum: 1_000,
      input: (length) => {
        const input = correctionContractInput();
        input.correction.steps[0].targets = ["x".repeat(length)];
        return input;
      },
    },
  ];
  for (const boundary of cases) {
    const accepted = boundary.input(boundary.maximum);
    assert.equal(reviewInputSchema.safeParse(accepted).success, true, `${boundary.name} runtime maximum`);
    assert.equal(validate(request({ review_input: accepted })), true, `${boundary.name} public maximum: ${JSON.stringify(validate.errors)}`);
    const rejected = boundary.input(boundary.maximum + 1);
    assert.equal(reviewInputSchema.safeParse(rejected).success, false, `${boundary.name} runtime overflow`);
    assert.equal(validate(request({ review_input: rejected })), false, `${boundary.name} public overflow`);
  }
});

test("Manual builder deterministically creates one provisional Evidence and Review pair", () => {
  const first = executeManualOperation("build-review", request());
  const second = executeManualOperation("build-review", structuredClone(request()));
  assert.equal(first.ok, true);
  assert.equal(serializeManualResult(first), serializeManualResult(second));
  assert.deepEqual(first.artifacts.map((entry) => entry.artifact), ["delivery-evidence", "work-review"]);

  const evidence = inspectArtifactText(first.artifacts[0].text, root).artifact.fields;
  const review = inspectArtifactText(first.artifacts[1].text, root).artifact.fields;
  assert.equal(evidence.overall_grade, "supported");
  assert.equal(evidence.status, "provisional");
  assert.equal(review.delivery_status, "provisional");
  assert.equal(review.next_action, "accept-provisional");
  assert.equal(first.presentation.next_action, review.next_action);
  assert.match(first.human_output, /Now: accept-provisional/);
});

test("changed observation bytes create newly bound IDs", () => {
  const first = executeManualOperation("build-review", request());
  const changed = request();
  changed.repository_observation.snapshot_material[0] = "tree:fixture-manual-review-changed";
  const second = executeManualOperation("build-review", changed);
  assert.equal(second.ok, true);
  assert.notEqual(first.artifacts[0].label, second.artifacts[0].label);
  assert.notEqual(first.artifacts[1].label, second.artifacts[1].label);
  assert.notEqual(first.repository_snapshot_hash, second.repository_snapshot_hash);
});

test("Manual status and provisional acceptance use only exact artifact bytes", () => {
  const built = executeManualOperation("build-review", request());
  const statusInput = { schema: 1, operation: "status", root_plan: rootPlan, artifacts: exactArtifacts(built) };
  const status = executeManualOperation("status", statusInput);
  assert.equal(status.ok, true);
  assert.equal(status.snapshot.state, "delivery-ready-provisional");
  assert.equal(status.snapshot.next_action, "accept-provisional");

  const accepted = executeManualOperation("accept-provisional", { ...statusInput, operation: "accept-provisional" });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.persisted, false);
  assert.equal(accepted.snapshot.state, "accepted-provisional");
  assert.equal(accepted.snapshot.acceptance_persisted, false);
});

test("failed required Checks remain blocking and cannot be accepted", () => {
  const failedRequest = request();
  failedRequest.check_observations[0] = {
    check_id: "CHECK-1",
    grade: "failed",
    observed: "The required verification failed.",
    evidence_material: ["CHECK-1:failed:fixture"],
    limitations: [],
  };
  const built = executeManualOperation("build-review", failedRequest);
  assert.equal(built.ok, true);
  assert.equal(built.presentation.delivery_status, "blocked");
  assert.equal(built.presentation.evidence_grade, "failed");
  assert.match(built.artifacts[0].text, /required verification intent failed/);
  assert.doesNotMatch(built.artifacts[0].text, /harness-attested/);

  const accepted = executeManualOperation("accept-provisional", {
    schema: 1,
    operation: "accept-provisional",
    root_plan: rootPlan,
    artifacts: exactArtifacts(built),
  });
  assert.equal(accepted.ok, false);
  assert.equal(accepted.mode, "shadow");
  assert.equal(accepted.artifacts.length, 0);
  assert.equal(accepted.next_action, "retry-review");
});

test("verified claims and attestation fields are rejected without partial artifacts", () => {
  const verified = request();
  verified.check_observations[0].grade = "verified";
  const rejectedGrade = executeManualOperation("build-review", verified);
  assert.equal(rejectedGrade.ok, false);
  assert.equal(rejectedGrade.error.code, "manual-input-invalid");
  assert.deepEqual(rejectedGrade.artifacts, []);

  const attested = request();
  attested.check_observations[0].attestation_hash = "a".repeat(64);
  const rejectedAttestation = executeManualOperation("build-review", attested);
  assert.equal(rejectedAttestation.ok, false);
  assert.equal(rejectedAttestation.error.code, "manual-input-invalid");
  assert.deepEqual(rejectedAttestation.artifacts, []);
});

test("ordinary paths outside allowed roots stay visible and provisionally acceptable", () => {
  const outside = request();
  outside.repository_observation.changed_paths = ["README.md", "src/controller/manual-status.mjs"];
  const built = executeManualOperation("build-review", outside);
  assert.equal(built.ok, true);
  const evidence = inspectArtifactText(built.artifacts[0].text, root).artifact.fields;
  const review = inspectArtifactText(built.artifacts[1].text, root).artifact.fields;
  assert.deepEqual(evidence.changed_paths, ["README.md", "src/controller/manual-status.mjs"]);
  assert.equal(review.next_action, "accept-provisional");
  assert.equal(built.path_authority.status, "provisional-drift");
  assert.deepEqual(built.path_authority.outside_allowed_paths, ["README.md"]);
  assert.match(built.human_output, /Provisional scope drift/);
  const accepted = executeManualOperation("accept-provisional", {
    schema: 1,
    operation: "accept-provisional",
    root_plan: rootPlan,
    artifacts: exactArtifacts(built),
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.persisted, false);
  assert.equal(accepted.path_authority.status, "provisional-drift");
});

test("approval-required paths also force clarify", () => {
  const approvalRoot = rootPlan.replace("  approval_required_paths: []", "  approval_required_paths:\n    - src/controller");
  const approval = request({ root_plan: approvalRoot });
  const built = executeManualOperation("build-review", approval);
  assert.equal(built.ok, true, built.error?.message);
  const evidence = inspectArtifactText(built.artifacts[0].text, root).artifact.fields;
  const review = inspectArtifactText(built.artifacts[1].text, root).artifact.fields;
  assert.deepEqual(evidence.changed_paths, ["src/controller/manual-status.mjs"]);
  assert.equal(evidence.status, "blocked");
  assert.equal(review.next_action, "clarify");
  assert.equal(built.path_authority.status, "approval-required");
  assert.match(built.human_output, /requiring separate human approval/);
  const status = executeManualOperation("status", {
    schema: 1,
    operation: "status",
    root_plan: approvalRoot,
    artifacts: exactArtifacts(built),
  });
  assert.equal(status.snapshot.next_action, "clarify");
  assert.equal(status.path_authority.status, "approval-required");
});

test("protected paths stay visible and block Manual acceptance", () => {
  const protectedInput = request();
  protectedInput.repository_observation.changed_paths = [".git/config", "src/controller/manual-status.mjs"];
  const built = executeManualOperation("build-review", protectedInput);
  assert.equal(built.ok, true, built.error?.message);
  const evidence = inspectArtifactText(built.artifacts[0].text, root).artifact.fields;
  const review = inspectArtifactText(built.artifacts[1].text, root).artifact.fields;
  assert.deepEqual(evidence.changed_paths, [".git/config", "src/controller/manual-status.mjs"]);
  assert.equal(evidence.status, "blocked");
  assert.equal(review.delivery_status, "blocked");
  assert.equal(review.next_action, "clarify");
  assert.equal(built.path_authority.status, "protected");
  const denied = executeManualOperation("accept-provisional", {
    schema: 1,
    operation: "accept-provisional",
    root_plan: rootPlan,
    artifacts: exactArtifacts(built),
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.next_action, "clarify");
});

test("Cursor recursive-root regression stays provisional instead of false clarify", () => {
  const incidentRoot = rootPlan.replace(
    "    - src\n    - tests",
    [
      "    - packages/of_distribution/Classes/Service/Install/**",
      "    - packages/of_distribution/Configuration/System/TYPO3/AdditionalConfiguration.php",
      "    - packages/of_distribution/Tests/Unit/Service/Install/**",
      "    - packages/of_distribution/AGENTS.md",
      "    - docs/DEVELOPMENT.md",
    ].join("\n"),
  );
  const incident = request({
    root_plan: incidentRoot,
    repository_observation: {
      ...request().repository_observation,
      changed_paths: [
        "docs/DEVELOPMENT.md",
        "packages/of_distribution/AGENTS.md",
        "packages/of_distribution/Classes/Service/Install/SystemConfigurationService.php",
        "packages/of_distribution/Configuration/System/TYPO3/AdditionalConfiguration.php",
        "packages/of_distribution/Tests/Unit/Service/Install/SystemConfigurationServiceTest.php",
      ],
      snapshot_material: ["cursor-task:43424a3b-b24c-4f98-a734-ecda9cf2bf36"],
    },
  });
  const validation = executeManualOperation("validate-plan", {
    schema: 1,
    operation: "validate-plan",
    root_plan: incidentRoot,
  });
  assert.equal(validation.ok, true, validation.human_output);
  const built = executeManualOperation("build-review", incident);
  assert.equal(built.ok, true, built.error?.message);
  const evidence = inspectArtifactText(built.artifacts[0].text, root).artifact.fields;
  const review = inspectArtifactText(built.artifacts[1].text, root).artifact.fields;
  assert.deepEqual(evidence.changed_paths, incident.repository_observation.changed_paths);
  assert.equal(built.path_authority.status, "within-authority");
  assert.equal(review.delivery_status, "provisional");
  assert.equal(review.next_action, "accept-provisional");
  assert.deepEqual(built.presentation.findings, []);
  assert.doesNotMatch(built.human_output, /exceed the Root authority|Now: clarify|Now: replan/);
});

test("plan validation advises ordinary acceptance drift and rejects malformed authority patterns", () => {
  const driftRoot = rootPlan.replace(
    "Retry behavior is deterministic and repository validation remains consistent.",
    "Retry behavior is deterministic and `README.md` records the repository outcome.",
  );
  const drift = executeManualOperation("validate-plan", {
    schema: 1,
    operation: "validate-plan",
    root_plan: driftRoot,
  });
  assert.equal(drift.ok, true, drift.human_output);
  assert.ok(drift.result.advisories.some((entry) => entry.code === "acceptance-path-outside-allowed-roots"));

  const overlappingRoot = rootPlan.replace("    - src", "    - .git");
  const overlapping = executeManualOperation("validate-plan", {
    schema: 1,
    operation: "validate-plan",
    root_plan: overlappingRoot,
  });
  assert.equal(overlapping.ok, true, overlapping.human_output);
  assert.ok(overlapping.result.advisories.some((entry) => entry.code === "shadowed-allowed-root"));

  const malformedRoot = rootPlan.replace("    - src", "    - src/ab**cd");
  const malformed = executeManualOperation("validate-plan", {
    schema: 1,
    operation: "validate-plan",
    root_plan: malformedRoot,
  });
  assert.equal(malformed.ok, false);
  assert.ok(malformed.result.blocking_issues.some((entry) => entry.code === "invalid-authority-pattern"));
});

test("presentation includes every finding and uses the artifact next action", () => {
  const findingRequest = request({
    review_input: reviewInput({
      assessment: "partially-achieved",
      recommended_action: "clarify",
      findings: [
        {
          key: "high-contract-gap",
          severity: "high",
          objective_ids: ["OBJ-1"],
          check_ids: ["CHECK-1"],
          evidence: "src/controller/manual-status.mjs does not establish the missing contract.",
          reasoning: "The objective remains ambiguous at the repository boundary.",
          resolution: "clarify",
        },
        {
          key: "critical-authority-gap",
          severity: "critical",
          objective_ids: ["OBJ-1"],
          check_ids: ["CHECK-1"],
          evidence: "The exact authority decision is absent.",
          reasoning: "No implementation may safely infer the missing decision.",
          resolution: "clarify",
        },
      ],
    }),
  });
  const built = executeManualOperation("build-review", findingRequest);
  assert.equal(built.ok, true);
  assert.match(built.human_output, /high-contract-gap/);
  assert.match(built.human_output, /critical-authority-gap/);
  const review = inspectArtifactText(built.artifacts[1].text, root).artifact.fields;
  assert.equal(built.presentation.next_action, review.next_action);
  assert.match(built.human_output, new RegExp(`Now: ${review.next_action}`));
});

test("explicitly attached correction chains produce delta Evidence and a fresh provisional Review", () => {
  const correctionInput = reviewInput({
    assessment: "mostly-achieved",
    recommended_action: "correct",
    assessment_summary: "One bounded retry outcome remains incomplete.",
    findings: [{
      key: "retry-gap",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The retry outcome is incomplete.",
      reasoning: "The acceptance outcome is not fully established.",
      resolution: "correct",
    }],
    correction: {
      fixes: [{
        key: "close-gap",
        finding_keys: ["retry-gap"],
        required_outcome: "Complete the retry outcome.",
        evidence: "The finding is bounded to OBJ-1.",
      }],
      checks: [{
        key: "prove-gap",
        fix_keys: ["close-gap"],
        verification_intent: "Prove the corrected retry outcome.",
        expected_evidence: "Evidence for the current repository snapshot.",
        evidence_class: "harness-verifiable",
        required: true,
        cost_class: "standard",
        prerequisites: ["The correction is implemented."],
      }],
      steps: [{
        key: "apply-gap",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Complete the retry outcome.",
        implementation_latitude: "The project harness chooses the implementation.",
        completion_probe: "The required outcome is observable.",
        check_keys: ["prove-gap"],
        deviation_action: "Replan if Root authority must change.",
      }],
      learning_candidates: [{
        key: "keep-boundary",
        finding_keys: ["retry-gap"],
        reusable_guidance: "Keep verification intent separate from execution.",
        candidate_targets: ["project guidance"],
        confirmation_evidence: "Verified corrected delivery.",
      }],
    },
  });
  const first = executeManualOperation("build-review", request({ review_input: correctionInput }));
  assert.equal(first.ok, true);
  assert.equal(first.presentation.next_action, "correct");
  const correctionStatus = executeManualOperation("status", {
    schema: 1,
    operation: "status",
    root_plan: rootPlan,
    artifacts: exactArtifacts(first),
  });
  assert.equal(correctionStatus.snapshot.next_action, "correct");
  const deniedCorrection = executeManualOperation("accept-provisional", {
    schema: 1,
    operation: "accept-provisional",
    root_plan: rootPlan,
    artifacts: exactArtifacts(first),
  });
  assert.equal(deniedCorrection.next_action, "correct");

  const corrected = request({
    artifacts: exactArtifacts(first),
    repository_observation: {
      ...request().repository_observation,
      snapshot_material: ["tree:fixture-corrected-review", "diff:corrected-manual-status"],
    },
    check_observations: [
      request().check_observations[0],
      {
        check_id: "CHECK-2",
        grade: "supported",
        observed: "The bounded correction outcome is present.",
        evidence_material: ["CHECK-2:pass:fixture"],
        limitations: [],
      },
    ],
  });
  const second = executeManualOperation("build-review", corrected);
  assert.equal(second.ok, true, second.error?.message);
  const evidence = inspectArtifactText(second.artifacts[0].text, root).artifact.fields;
  assert.equal(evidence.representation, "delta");
  assert.equal(evidence.source_review_id, first.artifacts[1].label);
  assert.equal(second.presentation.next_action, "accept-provisional");

  const resumed = executeManualOperation("status", {
    schema: 1,
    operation: "status",
    root_plan: rootPlan,
    artifacts: [...exactArtifacts(first), ...exactArtifacts(second)],
  });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.snapshot.state, "delivery-ready-provisional");
});

test("a human-attached replan chain remains exact and Schema-6-only", () => {
  const first = executeManualOperation("build-review", request({
    review_input: reviewInput({
      assessment: "not-achieved",
      recommended_action: "replan",
      assessment_summary: "The intended outcome requires a newly approved Root.",
    }),
  }));
  assert.equal(first.ok, true);
  assert.equal(first.presentation.next_action, "replan");
  const deniedReplan = executeManualOperation("accept-provisional", {
    schema: 1,
    operation: "accept-provisional",
    root_plan: rootPlan,
    artifacts: exactArtifacts(first),
  });
  assert.equal(deniedReplan.next_action, "replan");
  const replanRoot = rootPlan.replace(
    "id: wp-adaptive-retry",
    `id: wp-adaptive-retry-replan\npredecessor_plan_id: wp-adaptive-retry\nreplan_source_review_id: ${first.artifacts[1].label}`,
  );
  const validation = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: replanRoot });
  assert.equal(validation.ok, true, validation.human_output);
  const replanned = executeManualOperation("build-review", request({
    root_plan: replanRoot,
    artifacts: [{ label: "wp-adaptive-retry", text: rootPlan }, ...exactArtifacts(first)],
    repository_observation: {
      ...request().repository_observation,
      snapshot_material: ["tree:fixture-replan", "diff:replanned-manual-status"],
    },
  }));
  assert.equal(replanned.ok, true, replanned.error?.message);
  assert.equal(replanned.root_plan_id, "wp-adaptive-retry-replan");
  assert.equal(replanned.presentation.next_action, "accept-provisional");
});

test("invalid or conflicting chains return Shadow without pseudo-artifacts", () => {
  const built = executeManualOperation("build-review", request());
  const conflict = request({
    artifacts: [
      exactArtifacts(built)[0],
      { label: built.artifacts[0].label, text: built.artifacts[0].text.replace("status: provisional", "status: blocked") },
    ],
  });
  const rejected = executeManualOperation("build-review", conflict);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.mode, "shadow");
  assert.equal(rejected.input_preserved, true);
  assert.deepEqual(rejected.artifacts, []);

  const foreignRoot = rootPlan.replace("id: wp-adaptive-retry", "id: wp-foreign-root");
  const foreign = executeManualOperation("build-review", request({ artifacts: [{ label: "wp-foreign-root", text: foreignRoot }] }));
  assert.equal(foreign.ok, false);
  assert.equal(foreign.error.code, "foreign-artifact-chain");
  assert.deepEqual(foreign.artifacts, []);
});

test("provisional acceptance with missing chain bytes asks for artifacts", () => {
  const denied = executeManualOperation("accept-provisional", {
    schema: 1,
    operation: "accept-provisional",
    root_plan: rootPlan,
    artifacts: [],
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.next_action, "provide-artifacts");
  assert.deepEqual(denied.artifacts, []);
});

test("Manual builder source has no execution or MCP dependency", () => {
  const source = readFileSync(join(root, "src", "manual", "manual-workflow.mjs"), "utf8");
  assert.doesNotMatch(source, /node:child_process|workflow_[a-z_]+|captureRepositorySnapshot|native-task-review-state/);
});

test("Manual Commands and Skills contain no MCP tool invocation", () => {
  const commandFiles = readdirSync(join(root, "commands"))
    .filter((name) => name.endsWith(".md") && name !== "auto-work.md")
    .map((name) => join(root, "commands", name));
  const cursorSkillFiles = readdirSync(join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "work-automation" && existsSync(join(root, "skills", entry.name, "SKILL.md")))
    .map((entry) => join(root, "skills", entry.name, "SKILL.md"));
  const targetSkillFiles = ["codex", "agent-plugins"].flatMap((target) => readdirSync(join(root, "targets", target, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, "targets", target, "skills", entry.name, "SKILL.md")))
    .map((entry) => join(root, "targets", target, "skills", entry.name, "SKILL.md")));
  for (const path of [...commandFiles, ...cursorSkillFiles, ...targetSkillFiles]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /workflow_[a-z_]+/, `${path} contains an MCP tool invocation`);
  }
});

test("Manual Review guidance requires conclusive current-snapshot evidence and exact output", () => {
  for (const path of [
    join(root, "skills", "work-review", "SKILL.md"),
    join(root, "targets", "codex", "skills", "review-work", "SKILL.md"),
    join(root, "targets", "agent-plugins", "skills", "review-work", "SKILL.md"),
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /masked exit status/i, `${path} must reject masked outcomes`);
    assert.match(source, /same-task observations.*snapshot is unchanged/i, `${path} must allow exact current-snapshot reuse`);
    assert.match(source, /no independent postscript/i, `${path} must preserve the builder decision`);
  }
});

test("global prompt and Stop hooks do not depend on Manual closeout", () => {
  const hooks = JSON.parse(readFileSync(join(root, "hooks", "hooks.json"), "utf8")).hooks;
  assert.equal(hooks.stop, undefined);
  assert.equal(hooks.beforeSubmitPrompt.length, 1);
  assert.match(hooks.beforeSubmitPrompt[0].command, /automation-guard/);
  const closeoutHooks = Object.entries(hooks).flatMap(([event, entries]) => entries
    .filter((entry) => /closeout-guard/.test(entry.command))
    .map((entry) => ({ event, matcher: entry.matcher ?? null })));
  assert.deepEqual(closeoutHooks, [
    { event: "preToolUse", matcher: "MCP:workflow_closeout" },
    { event: "postToolUse", matcher: "CreatePlan|MCP:workflow_closeout" },
    { event: "postToolUseFailure", matcher: "MCP:workflow_closeout" },
  ]);
});
