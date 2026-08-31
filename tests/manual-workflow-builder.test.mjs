import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { executeManualOperation, serializeManualResult } from "../src/manual/manual-workflow.mjs";
import { inspectArtifactText, validateArtifactText } from "../scripts/validate-artifact.source.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  achievedReviewInput,
  authorityCore,
  manualSupportedObservation,
  nativePlan,
  planMarkdown,
  rootPlan,
} from "./support/workflow-fixtures.mjs";

function repositoryObservation({ subject = ["src/retry.mjs"], ambient = [], limitations = [] } = {}) {
  return {
    schema: 1,
    kind: "unprotected-repository-observation",
    repository_root: defaultRoot,
    subject_changed_paths: subject,
    ambient_changed_paths: ambient,
    snapshot_material: ["git tree and focused repository checks at the current snapshot"],
    limitations,
  };
}

function buildReviewRequest(overrides = {}) {
  return {
    schema: 1,
    operation: "build-review",
    root_plan: nativePlan(),
    artifacts: [],
    review_input: achievedReviewInput(),
    repository_observation: repositoryObservation(),
    check_observations: [manualSupportedObservation()],
    presentation_locale: "en",
    ...overrides,
  };
}

function correctionInput() {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "correction-needed",
    assessment_summary: "One current Root outcome needs a bounded correction.",
    snapshot_summary: "The exact current snapshot was inspected read-only.",
    findings: [{
      key: "retry-backoff",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The retry path still lacks bounded backoff.",
      reasoning: "The change is correctable inside the approved src authority.",
      resolution: "correct",
    }],
    open_points: [],
    correction: {
      fixes: [{ key: "fix-backoff", finding_keys: ["retry-backoff"], required_outcome: "Retry backoff satisfies the approved behavior.", evidence: "The Finding identifies the current gap." }],
      steps: [{
        key: "implement-backoff",
        fix_keys: ["fix-backoff"],
        targets: ["src"],
        required_outcome: "Retry behavior satisfies OBJ-1.",
        implementation_latitude: "Use the smallest project-appropriate change.",
        completion_probe: "Inspect the changed behavior locally before handoff.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report an Open Point instead of expanding scope.",
      }],
    },
  };
}

test("build-plan accepts arbitrary Markdown and deterministically generates one bound Core", () => {
  const request = {
    schema: 1,
    operation: "build-plan",
    plan_markdown: `${planMarkdown}\n## Unordered appendix\n\n| Free | Form |\n|---|---|\n| yes | yes |\n`,
    authority_core: authorityCore(),
    presentation_locale: "en",
  };
  const first = executeManualOperation("build-plan", request);
  const second = executeManualOperation("build-plan", request);
  assert.equal(first.ok, true);
  assert.equal(first.root_plan, second.root_plan);
  assert.equal((first.root_plan.match(/```yaml workflow-authority/g) ?? []).length, 1);
  assert.match(first.root_plan, /plan_content_hash: [a-f0-9]{64}/);
  assert.match(first.root_plan, /authority_hash: [a-f0-9]{64}/);
  assert.deepEqual(validateArtifactText(first.root_plan), []);
  assert.equal(first.artifacts.length, 0);
});

test("validate-plan checks Core and hashes but not editorial structure", () => {
  const valid = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: nativePlan(), presentation_locale: "de" });
  assert.equal(valid.ok, true);
  assert.equal(valid.root_plan_id, "wp-adaptive-retry");
  assert.match(valid.human_output, /Planvalidierung/);
  const tamperedText = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: nativePlan().replace("Adaptive retry delivery", "Changed delivery") });
  assert.equal(tamperedText.ok, false);
  assert.match(JSON.stringify(tamperedText.result.blocking_issues), /plan_content_hash/);
  const tamperedCore = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: nativePlan().replace("risk: medium", "risk: high") });
  assert.equal(tamperedCore.ok, false);
  assert.match(JSON.stringify(tamperedCore.result.blocking_issues), /authority_hash/);
});

test("closed public request schema and runtime reject removed operations and unknown input", () => {
  const schema = JSON.parse(readFileSync(new URL("../schemas/manual-workflow/request-1.schema.json", import.meta.url), "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(buildReviewRequest()), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...buildReviewRequest(), delivery_status: "provisional" }), false);
  assert.equal(validate({ schema: 1, operation: "accept-provisional", root_plan: rootPlan(), artifacts: [] }), false);
  const removed = executeManualOperation("accept-provisional", { schema: 1, operation: "accept-provisional", root_plan: rootPlan(), artifacts: [] });
  assert.equal(removed.ok, false);
  assert.equal(removed.error.code, "unsupported-operation");
  assert.equal(removed.next_action, "human-assessment");
});

test("finding-free supported result is Achieved without Delivery provisional", () => {
  const result = executeManualOperation("build-review", buildReviewRequest());
  assert.equal(result.ok, true);
  assert.equal(result.presentation.outcome, "achieved");
  assert.equal(result.presentation.next_action, "none");
  assert.equal(result.artifacts.length, 2);
  assert.match(result.human_output, /^## Review result · achieved/);
  assert.doesNotMatch(result.human_output, /Delivery provisional|accept-provisional|Accept Work/i);
  const review = inspectArtifactText(result.artifacts[1].text).artifact;
  assert.equal(review.fields.outcome, "achieved");
  assert.ok(!Object.hasOwn(review.fields, "delivery_status"));
});

test("an unchanged review chain is reused while repository drift replaces only its evidence suffix", () => {
  const first = executeManualOperation("build-review", buildReviewRequest());
  const artifacts = first.artifacts.map(({ label, text }) => ({ label, text }));
  const reused = executeManualOperation("build-review", buildReviewRequest({ artifacts }));
  assert.equal(reused.ok, true);
  assert.equal(reused.chain_update, "reuse");
  assert.equal(reused.artifacts[0].text, first.artifacts[0].text);

  const changedObservation = repositoryObservation();
  changedObservation.snapshot_material = ["a different exact repository snapshot and focused check result"];
  const replaced = executeManualOperation("build-review", buildReviewRequest({
    artifacts,
    repository_observation: changedObservation,
  }));
  assert.equal(replaced.ok, true);
  assert.match(replaced.chain_update, /^replace-/);
  assert.notEqual(replaced.artifacts[0].text, first.artifacts[0].text);
});

test("invalid Check observation evidence and limitations fail through the closed Shadow projection", () => {
  for (const check of [
    { check_id: "CHECK-1", grade: "supported", observed: "No evidence supplied.", evidence_material: [], limitations: [] },
    { check_id: "CHECK-1", grade: "partial", observed: "No limitation supplied.", evidence_material: ["partial output"], limitations: [] },
  ]) {
    const result = executeManualOperation("build-review", buildReviewRequest({
      check_observations: [check],
      presentation_locale: "de",
    }));
    assert.equal(result.ok, false);
    assert.equal(result.kind, "manual-workflow-error");
    assert.equal(result.error.code, "manual-input-invalid");
    assert.match(result.human_output, /geschlossene Eingabe/i);
  }
});

test("missing required observations return an artifact-free internal retry with exact IDs", () => {
  const result = executeManualOperation("build-review", buildReviewRequest({ check_observations: [] }));
  assert.equal(result.kind, "manual-review-internal-retry");
  assert.equal(result.mode, "internal-retry");
  assert.deepEqual(result.missing_check_ids, ["CHECK-1"]);
  assert.match(result.retry_signature, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.artifacts, []);
  assert.equal(result.next_action, "internal-retry");
});

test("explicit required-Check unavailability becomes a concrete Open Point", () => {
  const unavailable = {
    check_id: "CHECK-1",
    grade: "unavailable",
    observed: "The integrated environment could not start.",
    evidence_material: [],
    limitations: ["The environment endpoint was unavailable."],
  };
  const result = executeManualOperation("build-review", buildReviewRequest({ check_observations: [unavailable] }));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.outcome, "open-points");
  assert.equal(result.presentation.next_action, "human-assessment");
  const review = inspectArtifactText(result.artifacts[1].text).artifact;
  assert.equal(review.fields.open_points[0].type, "environment");
  assert.match(review.fields.open_points[0].evidence, /endpoint was unavailable/);
});

test("a truly red unrelated integrated Check can end as a named Open Point", () => {
  const request = buildReviewRequest({
    review_input: {
      ...achievedReviewInput(),
      outcome: "open-points",
      assessment_summary: "An unrelated integrated gate is red.",
      open_points: [{
        key: "unrelated-red-gate",
        type: "environment",
        summary: "An integrated gate unrelated to the delivered behavior is red.",
        evidence: "The gate reports an exact unrelated fixture failure.",
        impact: "The full integrated environment is not green although the planned behavior is implemented.",
        question: "Should the human close this delivery with the unrelated gate recorded as open?",
      }],
    },
    check_observations: [{
      check_id: "CHECK-1",
      grade: "failed",
      observed: "The integrated gate failed on an unrelated fixture.",
      evidence_material: ["unrelated fixture failure output"],
      limitations: [],
    }],
  });
  const result = executeManualOperation("build-review", request);
  assert.equal(result.presentation.outcome, "open-points");
  assert.match(result.human_output, /unrelated integrated gate|unrelated-red-gate/i);
});

test("mixed correctable Findings take precedence and retain Open Points in one Correction", () => {
  const input = correctionInput();
  input.open_points.push({
    key: "proof-limit",
    type: "evidence",
    summary: "Protected proof is unavailable.",
    evidence: "Only supported repository evidence exists.",
    impact: "Proof remains supported.",
    question: "Is supported proof sufficient for the human assessment?",
  });
  const result = executeManualOperation("build-review", buildReviewRequest({ review_input: input }));
  assert.equal(result.presentation.outcome, "correction-needed");
  assert.equal(result.presentation.next_action, "correct");
  const review = inspectArtifactText(result.artifacts[1].text).artifact;
  assert.equal(review.fields.correction_id.startsWith("cp-"), true);
  assert.equal(review.fields.open_points.length, 1);
  assert.match(result.artifacts[1].text, /\| CHECK-1 \|/);
  assert.doesNotMatch(result.artifacts[1].text, /CORR-CHECK|FIX-CHECK/);
});

test("outside-authority and protected subject paths become Authority Open Points, ambient paths do not", () => {
  for (const subject of [["README.md"], [".git/config"]]) {
    const result = executeManualOperation("build-review", buildReviewRequest({ repository_observation: repositoryObservation({ subject }) }));
    assert.equal(result.presentation.outcome, "open-points");
    assert.equal(inspectArtifactText(result.artifacts[1].text).artifact.fields.open_points[0].type, "authority");
  }
  const ambient = executeManualOperation("build-review", buildReviewRequest({ repository_observation: repositoryObservation({ subject: ["src/retry.mjs"], ambient: ["README.md"] }) }));
  assert.equal(ambient.presentation.outcome, "achieved");
  assert.deepEqual(ambient.path_authority.ambient_paths, ["README.md"]);
});

test("invalid formal binding still returns a useful read-only Shadow Review", () => {
  const reviewInput = correctionInput();
  const result = executeManualOperation("build-review", buildReviewRequest({
    root_plan: `${planMarkdown}\nNo generated Authority Core.\n`,
    review_input: reviewInput,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.kind, "manual-shadow-review");
  assert.equal(result.outcome, "shadow-review");
  assert.equal(result.next_action, "human-assessment");
  assert.equal(result.findings[0].key, "retry-backoff");
  assert.equal(result.open_points.at(-1).type, "formal-binding");
  assert.deepEqual(result.artifacts, []);
  assert.doesNotMatch(result.human_output, /Correct Work/);
});

test("German and English presentation lead with exact result and one human action", () => {
  const en = executeManualOperation("build-review", buildReviewRequest({ review_input: correctionInput(), presentation_locale: "en" }));
  const de = executeManualOperation("build-review", buildReviewRequest({ review_input: correctionInput(), presentation_locale: "de" }));
  assert.match(en.human_output, /^## Review result · correction needed/);
  assert.match(de.human_output, /^## Review-Ergebnis · Korrektur erforderlich/);
  assert.equal((en.human_output.match(/\*\*Correct Work\*\*/g) ?? []).length, 1);
  assert.equal((de.human_output.match(/\*\*Correct Work\*\*/g) ?? []).length, 1);
  assert.equal(en.artifacts[1].text, de.artifacts[1].text);
  assert.equal(serializeManualResult(en), serializeManualResult(en));
});

test("status exposes only Root ready, Review needed, Correction needed, Achieved, Open points, or Shadow Review", () => {
  const built = executeManualOperation("build-review", buildReviewRequest({ review_input: correctionInput() }));
  const status = executeManualOperation("status", {
    schema: 1,
    operation: "status",
    root_plan: nativePlan(),
    artifacts: built.artifacts.map(({ label, text }) => ({ label, text })),
    presentation_locale: "en",
  });
  assert.equal(status.snapshot.state, "correction-needed");
  assert.equal(status.snapshot.next_action, "correct");
  assert.doesNotMatch(status.human_output, /accept|clarify|replan|retry review/i);
});

test("optional Root Checks may be omitted while required observations remain explicit", () => {
  const verification = [
    ...authorityCore().verification,
    {
      check_id: "CHECK-2",
      objectives: ["OBJ-1"],
      verification_intent: "Observe an optional secondary signal.",
      expected_evidence: "Optional repository observation.",
      required: false,
      evidence_class: "reviewer-observable",
      cost_class: "cheap",
      prerequisites: ["The secondary surface is present."],
    },
  ];
  const plan = nativePlan("manual", { verification });
  const result = executeManualOperation("build-review", buildReviewRequest({ root_plan: plan }));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.outcome, "achieved");
});
