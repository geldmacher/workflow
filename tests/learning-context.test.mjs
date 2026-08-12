import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  controllerLearningEventRefs,
  deliveryPathsHash,
  deriveControllerLearningContext,
  derivePreparationLearningContext,
  materializeControllerLearningCandidates,
  mergeControllerLearningCandidates,
  normalizeDecisionLearningCandidates,
  verifyEventChain,
} from "../src/controller/learning-context.mjs";
import { createLearningSourceReceiptAuthority } from "../src/controller/learning-source-receipt.mjs";
import { LEGACY_WORKFLOW_4, protocolFields, runEventSubject } from "../src/controller/protocol.mjs";
import { createInitialStrategy } from "../src/controller/strategy.mjs";
import { changedPathsBetween, workspaceDeliveryMatch } from "../src/controller/worktree.mjs";
import { defaultRoot, executionContractFromArtifactText } from "../scripts/validate-artifact.source.mjs";

const rootPlanFixture = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const confirmedSourceBinding = { confirmed: true, kind: "test-receipt" };

function modernRunSource({ runId = "run-binding", rootPlanId = "wp-binding", effectiveProfile = "supervised" } = {}) {
  const rootPlanText = rootPlanFixture.replace("id: wp-adaptive-retry", `id: ${rootPlanId}`);
  const contract = executionContractFromArtifactText(rootPlanText, defaultRoot);
  return {
    ...protocolFields(),
    run_id: runId,
    root_plan_text: rootPlanText,
    root_plan_hash: contract.raw_hash,
    root_authoritative_projection_hash: contract.authoritative_projection_hash,
    plan: contract,
    intent_hash: contract.authoritative_projection_hash,
    effective_profile: effectiveProfile,
    strategy: createInitialStrategy(contract),
  };
}

function reviewerReceipt(requestId, intentHash, phase = "reviewer") {
  return {
    phase,
    request_id: requestId,
    agent_id: `${phase}-agent`,
    model_attested: true,
    duration_ms: 1,
    usage: { totalTokens: 1 },
    cost_usd: 0,
    artifact_projection_hash: intentHash,
    status: "finished",
  };
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function event(type, payload, previousHash = null, id = "event-1", subject = null) {
  const value = { id, at: "2026-08-10T10:00:00.000Z", type, payload, ...(subject ? { subject } : {}), previous_hash: previousHash };
  return { ...value, event_hash: hash(value) };
}

test("reviewer learning proposals are bounded, correct-only, normalized, and exactly deduplicated", () => {
  const candidate = {
    finding_keys: ["retry-boundary"],
    reusable_guidance: " Keep the retry boundary explicit. ",
    candidate_targets: ["AGENTS.md"],
    confirmation_evidence: "CHECK-1 passes after correction.",
  };
  const normalized = normalizeDecisionLearningCandidates([candidate, candidate], ["retry-boundary"], "correct");
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].reusable_guidance, "Keep the retry boundary explicit.");
  assert.deepEqual(normalizeDecisionLearningCandidates(null, ["retry-boundary"], "correct"), []);
  assert.throws(() => normalizeDecisionLearningCandidates([candidate], ["retry-boundary"], "none"), /allowed only/);
  assert.throws(() => normalizeDecisionLearningCandidates([{ ...candidate, finding_keys: ["unknown"] }], ["retry-boundary"], "correct"), /unknown finding/);
  assert.throws(() => normalizeDecisionLearningCandidates([{ ...candidate, candidate_targets: ["../AGENTS.md"] }], ["retry-boundary"], "correct"), /non-project target/);
  assert.throws(() => normalizeDecisionLearningCandidates([{ ...candidate, reusable_guidance: "x".repeat(2_001) }], ["retry-boundary"], "correct"), /exceeds/);
  const reordered = normalizeDecisionLearningCandidates([{
    ...candidate,
    finding_keys: ["second-boundary", "retry-boundary"],
    candidate_targets: ["docs/profiles.md", "AGENTS.md"],
  }], ["retry-boundary", "second-boundary"], "correct");
  const canonical = normalizeDecisionLearningCandidates([{
    ...candidate,
    finding_keys: ["retry-boundary", "second-boundary"],
    candidate_targets: ["AGENTS.md", "docs/profiles.md"],
  }], ["retry-boundary", "second-boundary"], "correct");
  assert.deepEqual(reordered, canonical);
});

test("controller materialization owns stable LRN and correction IDs and rejects conflicting reuse", () => {
  const run = { run_id: "run-1", plan: { fields: { id: "wp-learning-test" } }, strategy: { revision: 2 } };
  const decision = {
    assessment: "mostly-achieved",
    delivery_status: "blocked",
    next_action: "correct",
    finding_keys: ["retry-boundary"],
    findings: [],
    learning_candidates: [{ finding_keys: ["retry-boundary"], reusable_guidance: "Keep the boundary.", candidate_targets: ["AGENTS.md"], confirmation_evidence: "CHECK-1 passes." }],
  };
  const first = materializeControllerLearningCandidates({ run, decision, correctionCycle: 3, receiptIds: ["review-1"] });
  const again = materializeControllerLearningCandidates({ run, decision, correctionCycle: 3, receiptIds: ["review-1"] });
  assert.deepEqual(first, again);
  assert.equal(first.correction_id, "cp-learning-test-controller-3");
  assert.match(first.candidates[0].learning_id, /^LRN-learning-test-[a-f0-9]{12}$/);
  assert.equal(mergeControllerLearningCandidates(first.candidates, again.candidates).length, 1);
  const later = materializeControllerLearningCandidates({ run, decision, correctionCycle: 4, receiptIds: ["review-2"] });
  assert.equal(later.candidates[0].learning_id, first.candidates[0].learning_id);
  const merged = mergeControllerLearningCandidates(first.candidates, later.candidates);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].lineage.length, 2);
  assert.deepEqual(merged[0].source_receipt_ids, ["review-1", "review-2"]);
  assert.throws(() => mergeControllerLearningCandidates(first.candidates, [{ ...first.candidates[0], reusable_guidance: "Conflict." }]), /inconsistent content identity/);
});

test("event-chain and controller learning projection fail closed on tampering, provisional delivery, and absent acceptance", () => {
  const candidate = {
    learning_id: "LRN-learning-test-abc123",
    correction_id: "cp-learning-test-controller-1",
    finding_keys: ["retry-boundary"],
    source_receipt_ids: ["review-1"],
    source_decision_hash: "decision-hash",
  };
  const correction = event("decision", { correction_id: candidate.correction_id, learning_candidate_ids: [candidate.learning_id], actor_receipt: "review-1", input_hashes: [candidate.source_decision_hash] });
  const delivery = event("decision", { evidence_refs: ["evidence-hash"], result: "waiting-human" }, correction.event_hash, "event-2");
  assert.equal(verifyEventChain([correction, delivery]).valid, true);
  assert.equal(verifyEventChain([{ ...correction, payload: { ...correction.payload, result: "tampered" } }, delivery]).valid, false);

  const base = {
    run_id: "run-1",
    lifecycle: "achieved",
    delivery_status: "verified",
    evidence_grade: "verified",
    root_review_complete: true,
    review: { assessment: "achieved", delivery_status: "verified", finding_keys: [] },
    blockers: [],
    effective_profile: "supervised",
    delivery_accepted: false,
    accepted_as: null,
    plan: { fields: { id: "wp-learning-test" } },
    delivery_evidence_hash: "evidence-hash",
    learning_candidates: [candidate],
  };
  const projection = deriveControllerLearningContext({ run: base, events: [correction, delivery], workspaceRoot: process.cwd() });
  assert.equal(projection.eligible, false);
  assert.ok(projection.blockers.includes("supervised-learning-requires-verified-acceptance"));
  assert.ok(projection.blockers.includes("controller-delivery-fingerprint-unavailable"));
  const missingChain = deriveControllerLearningContext({ run: base, events: [], workspaceRoot: process.cwd() });
  assert.ok(missingChain.blockers.includes("controller-event-chain-missing"));
  const provisional = deriveControllerLearningContext({ run: { ...base, lifecycle: "accepted-provisional", delivery_status: "provisional", evidence_grade: "partial" }, events: [correction, delivery], workspaceRoot: process.cwd() });
  assert.equal(provisional.eligible, false);
  assert.ok(provisional.blockers.includes("learning-source-not-achieved"));
});

test("ephemeral controller source receipts bind one exact returned Run and expire fail closed", () => {
  let current = Date.parse("2026-08-10T10:00:00.000Z");
  const authority = createLearningSourceReceiptAuthority({ secret: Buffer.alloc(32, 7), now: () => current, ttlMs: 1_000 });
  const run = { run_id: "run-current-task", plan: { fields: { id: "wp-current-task" } } };
  const receipt = authority.issue(run);
  assert.deepEqual(authority.verify(receipt, run), { confirmed: true, kind: "ephemeral-receipt", blocker: null });
  assert.equal(authority.verify(receipt, { ...run, run_id: "run-history" }).confirmed, false);
  assert.equal(authority.verify(`${receipt}x`, run).blocker, "controller-learning-source-receipt-invalid");
  current += 1_001;
  assert.equal(authority.verify(receipt, run).blocker, "controller-learning-source-receipt-expired");
});

test("preparation learning projection is uniform and explicitly ineligible", () => {
  const projection = derivePreparationLearningContext({
    preparation_record_schema: 2,
    artifact_schema: 5,
    controller_protocol: 5,
    preparation_id: "prep-current",
    requested_profile: "supervised",
  });
  assert.equal(projection.eligible, false);
  assert.equal(projection.source_kind, "controller-preparation");
  assert.ok(projection.blockers.includes("learning-source-not-delivery-run"));
  assert.deepEqual(projection.candidates, []);
  assert.equal(projection.workspace_match.status, "not-applicable");
});

test("controller candidate confirmation binds payload, lineage, reviewer provenance, and terminal delivery projection", () => {
  const repo = mkdtempSync(join(tmpdir(), "workflow-learning-binding-"));
  try {
    git(repo, ["init"]);
    writeFileSync(join(repo, "result.txt"), "baseline\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "baseline"]);
    const baseline = git(repo, ["rev-parse", "HEAD"]);
    writeFileSync(join(repo, "result.txt"), "delivered\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "delivery"]);
    const deliveryCommit = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "--allow-empty", "-m", "equivalent delivery commit"]);
    const equivalentDeliveryCommit = git(repo, ["rev-parse", "HEAD"]);
    const runSource = modernRunSource();
    const subject = runEventSubject(runSource);
    const decision = {
      assessment: "mostly-achieved",
      delivery_status: "blocked",
      next_action: "correct",
      finding_keys: ["retry-boundary"],
      findings: [{ key: "retry-boundary", summary: "Retry boundary is incomplete." }],
      learning_candidates: [{
        finding_keys: ["retry-boundary"],
        reusable_guidance: "Keep the retry boundary explicit.",
        candidate_targets: ["AGENTS.md"],
        confirmation_evidence: "CHECK-1 passes after correction.",
      }],
    };
    const materialized = materializeControllerLearningCandidates({ run: runSource, decision, correctionCycle: 1, receiptIds: ["reviewer-receipt", "investigator-receipt"] });
    const correction = event("decision", {
      actor_receipt: "reviewer-receipt",
      actor_receipts: ["investigator-receipt", "reviewer-receipt"],
      correction_id: materialized.correction_id,
      learning_candidate_ids: materialized.candidates.map((candidate) => candidate.learning_id),
      learning_candidate_refs: controllerLearningEventRefs(materialized.candidates),
    }, null, "event-1", subject);
    const accepted = event("decision", {
      evidence_refs: ["evidence-hash", "other-evidence-hash"],
      result: "accepted-verified",
      delivery_evidence_hash: "evidence-hash",
      delivery_commit: deliveryCommit,
      delivered_paths_hash: deliveryPathsHash(deliveryCommit, ["result.txt"]),
    }, correction.event_hash, "event-2", subject);
    const run = {
      ...runSource,
      lifecycle: "achieved",
      delivery_status: "verified",
      evidence_grade: "verified",
      root_review_complete: true,
      review: { assessment: "achieved", delivery_status: "verified", finding_keys: [] },
      blockers: [],
      effective_profile: "supervised",
      delivery_accepted: true,
      accepted_as: "verified",
      delivery_evidence_hash: "evidence-hash",
      delivery_commit: deliveryCommit,
      delivered_paths: ["result.txt"],
      worktree: { human_baseline: baseline },
      receipts: [
        reviewerReceipt("reviewer-receipt", runSource.intent_hash),
        reviewerReceipt("investigator-receipt", runSource.intent_hash, "investigator"),
      ],
      learning_candidates: materialized.candidates,
    };
    const confirmed = deriveControllerLearningContext({ run, events: [correction, accepted], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
    assert.equal(confirmed.eligible, true);
    assert.equal(confirmed.candidates[0].evidence_confirmed, true);

    const unboundSource = deriveControllerLearningContext({ run, events: [correction, accepted], workspaceRoot: repo, pluginRoot: defaultRoot });
    assert.equal(unboundSource.eligible, false);
    assert.ok(unboundSource.blockers.includes("controller-learning-source-not-current-task-bound"));

    for (const receiptTamperedRun of [
      { ...run, receipts: [] },
      { ...run, receipts: [{ ...run.receipts[0], model_attested: false }] },
      { ...run, receipts: [{ ...run.receipts[0], artifact_projection_hash: "f".repeat(64) }] },
      { ...run, receipts: [{ ...run.receipts[0], phase: "writer" }] },
    ]) {
      const receiptTampered = deriveControllerLearningContext({ run: receiptTamperedRun, events: [correction, accepted], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
      assert.equal(receiptTampered.eligible, true);
      assert.equal(receiptTampered.candidates[0].evidence_confirmed, false);
    }

    const correctionWithoutActors = event("decision", {
      actor_receipt: "reviewer-receipt",
      actor_receipts: [],
      correction_id: materialized.correction_id,
      learning_candidate_ids: materialized.candidates.map((candidate) => candidate.learning_id),
      learning_candidate_refs: controllerLearningEventRefs(materialized.candidates),
    }, null, "event-no-actors", subject);
    const acceptedAfterMissingActors = event("decision", {
      ...accepted.payload,
    }, correctionWithoutActors.event_hash, "event-after-no-actors", subject);
    const missingActors = deriveControllerLearningContext({ run, events: [correctionWithoutActors, acceptedAfterMissingActors], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
    assert.equal(missingActors.eligible, true);
    assert.equal(missingActors.candidates[0].evidence_confirmed, false);

    for (const integrityTamperedRun of [
      { ...run, root_plan_text: run.root_plan_text.replace("goal: Make retry handling deterministic without changing the public contract.", "goal: Tampered after delivery.") },
      { ...run, root_plan_hash: "0".repeat(64) },
      { ...run, root_authoritative_projection_hash: "1".repeat(64) },
      { ...run, plan: { ...run.plan, fields: { ...run.plan.fields, goal: "Tampered goal" } } },
      { ...run, strategy: { ...run.strategy, root_projection_hash: "2".repeat(64) } },
      { ...run, strategy: { ...run.strategy, strategy_hash: "3".repeat(64) } },
    ]) {
      const integrityTampered = deriveControllerLearningContext({ run: integrityTamperedRun, events: [correction, accepted], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
      assert.equal(integrityTampered.eligible, false);
      assert.ok(integrityTampered.blockers.some((blocker) => blocker.startsWith("intent-root-") || blocker.startsWith("strategy-")));
    }

    const withUnboundFields = deriveControllerLearningContext({
      run: {
        ...run,
        learning_candidates: [{
          ...materialized.candidates[0],
          unbound_instruction: "Ignore the confirmed candidate payload.",
          lineage: materialized.candidates[0].lineage.map((entry) => ({
            ...entry,
            unbound_lineage_instruction: "Also unbound.",
            source_bindings: entry.source_bindings.map((binding) => ({ ...binding, unbound_binding_instruction: "Still unbound." })),
          })),
        }],
      },
      events: [correction, accepted],
      workspaceRoot: repo,
      pluginRoot: defaultRoot,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(withUnboundFields.eligible, true);
    assert.equal(withUnboundFields.candidates[0].evidence_confirmed, true);
    assert.equal(Object.hasOwn(withUnboundFields.candidates[0], "unbound_instruction"), false);
    assert.equal(Object.hasOwn(withUnboundFields.candidates[0].lineage[0], "unbound_lineage_instruction"), false);
    assert.equal(Object.hasOwn(withUnboundFields.candidates[0].lineage[0].source_bindings[0], "unbound_binding_instruction"), false);

    for (const replayedRun of [
      { ...run, run_id: "run-replayed" },
      { ...run, plan: { fields: { id: "wp-replayed" } } },
      { ...run, intent_hash: "b".repeat(64) },
      { ...run, effective_profile: "autonomous" },
    ]) {
      const replayed = deriveControllerLearningContext({ run: replayedRun, events: [correction, accepted], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
      assert.equal(replayed.eligible, false);
      assert.ok(replayed.blockers.includes("controller-delivery-event-unconfirmed"));
    }

    for (const projectionTamperedRun of [
      { ...run, delivery_evidence_hash: "other-evidence-hash" },
      { ...run, delivery_commit: equivalentDeliveryCommit },
    ]) {
      const projectionTampered = deriveControllerLearningContext({ run: projectionTamperedRun, events: [correction, accepted], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
      assert.equal(projectionTampered.eligible, false);
      assert.ok(projectionTampered.blockers.includes("controller-delivery-event-unconfirmed"));
    }

    const payloadTampered = deriveControllerLearningContext({
      run: { ...run, learning_candidates: [{ ...materialized.candidates[0], reusable_guidance: "Tampered guidance." }] },
      events: [correction, accepted],
      workspaceRoot: repo,
      pluginRoot: defaultRoot,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(payloadTampered.eligible, true);
    assert.equal(payloadTampered.candidates[0].evidence_confirmed, false);

    for (const tamperedCandidate of [
      { ...materialized.candidates[0], run_id: "run-other" },
      { ...materialized.candidates[0], root_plan_id: "wp-other" },
      { ...materialized.candidates[0], source_receipt_ids: ["other-receipt"] },
      { ...materialized.candidates[0], source_decision_hash: "0".repeat(64) },
    ]) {
      const tampered = deriveControllerLearningContext({
        run: { ...run, learning_candidates: [tamperedCandidate] },
        events: [correction, accepted],
        workspaceRoot: repo,
        pluginRoot: defaultRoot,
        sourceBinding: confirmedSourceBinding,
      });
      assert.equal(tampered.candidates[0].evidence_confirmed, false);
    }

    const lineage = materialized.candidates[0].lineage[0];
    const lineageTampered = deriveControllerLearningContext({
      run: {
        ...run,
        learning_candidates: [{
          ...materialized.candidates[0],
          strategy_revision: 3,
          lineage: [{ ...lineage, strategy_revision: 3 }],
        }],
      },
      events: [correction, accepted],
      workspaceRoot: repo,
      pluginRoot: defaultRoot,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(lineageTampered.candidates[0].evidence_confirmed, false);

    const appendedLineage = deriveControllerLearningContext({
      run: {
        ...run,
        learning_candidates: [{
          ...materialized.candidates[0],
          source_receipt_ids: ["other-receipt", "reviewer-receipt"],
          lineage: [
            lineage,
            {
              ...lineage,
              correction_id: "cp-binding-controller-2",
              correction_cycle: 2,
              source_bindings: [{ source_receipt_id: "other-receipt", source_decision_hash: "1".repeat(64) }],
            },
          ],
        }],
      },
      events: [correction, accepted],
      workspaceRoot: repo,
      pluginRoot: defaultRoot,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(appendedLineage.candidates[0].evidence_confirmed, false);

    const noAcceptanceEvent = deriveControllerLearningContext({ run, events: [correction], workspaceRoot: repo, pluginRoot: defaultRoot, sourceBinding: confirmedSourceBinding });
    assert.equal(noAcceptanceEvent.eligible, false);
    assert.ok(noAcceptanceEvent.blockers.includes("controller-delivery-event-unconfirmed"));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("cumulative delivery paths and workspace matching accept equivalent content and reject drift", () => {
  const repo = mkdtempSync(join(tmpdir(), "workflow-learning-git-"));
  try {
    git(repo, ["init"]);
    writeFileSync(join(repo, "result.txt"), "baseline\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "baseline"]);
    const baseline = git(repo, ["rev-parse", "HEAD"]);
    writeFileSync(join(repo, "result.txt"), "delivered\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "delivery"]);
    const delivery = git(repo, ["rev-parse", "HEAD"]);
    assert.deepEqual(changedPathsBetween(repo, baseline, delivery), ["result.txt"]);
    assert.equal(workspaceDeliveryMatch(repo, delivery, ["result.txt"]).status, "matched");
    const created = event("run-created", { requested_profile: "autonomous" });
    const achieved = event("decision", { evidence_refs: ["evidence-hash"], result: "achieved" }, created.event_hash, "event-2");
    const { event_subject_schema: _eventSubjectSchema, ...legacyCompatibleProtocol } = protocolFields();
    const compatibleRun = {
        ...legacyCompatibleProtocol,
        run_id: "run-legacy-compatible",
        lifecycle: "achieved",
        delivery_status: "verified",
        evidence_grade: "verified",
        root_review_complete: true,
        review: { assessment: "achieved", delivery_status: "verified", finding_keys: [] },
        blockers: [],
        effective_profile: "autonomous",
        plan: { fields: { id: "wp-legacy-compatible" } },
        delivery_evidence_hash: "evidence-hash",
        delivery_commit: delivery,
        worktree: { human_baseline: baseline },
      };
    const legacyCompatible = deriveControllerLearningContext({
      run: compatibleRun,
      events: [created, achieved],
      workspaceRoot: repo,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(legacyCompatible.eligible, true);
    assert.deepEqual(legacyCompatible.delivered_paths, ["result.txt"]);
    const emptyStoredProjection = deriveControllerLearningContext({
      run: { ...compatibleRun, delivered_paths: [] },
      events: [created, achieved],
      workspaceRoot: repo,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(emptyStoredProjection.eligible, false);
    assert.ok(emptyStoredProjection.blockers.includes("controller-delivery-paths-invalid"));
    const partialStoredProjection = deriveControllerLearningContext({
      run: { ...compatibleRun, delivered_paths: ["other.txt"] },
      events: [created, achieved],
      workspaceRoot: repo,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(partialStoredProjection.eligible, false);
    assert.ok(partialStoredProjection.blockers.includes("controller-delivery-paths-mismatch"));
    const incompatible = deriveControllerLearningContext({
      run: { ...compatibleRun, ...LEGACY_WORKFLOW_4 },
      events: [created, achieved],
      workspaceRoot: repo,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(incompatible.eligible, false);
    assert.ok(incompatible.blockers.includes("legacy-workflow-4-read-only"));
    const unknownEventSubjectSchema = deriveControllerLearningContext({
      run: { ...compatibleRun, event_subject_schema: 2 },
      events: [created, achieved],
      workspaceRoot: repo,
      sourceBinding: confirmedSourceBinding,
    });
    assert.equal(unknownEventSubjectSchema.eligible, false);
    assert.ok(unknownEventSubjectSchema.blockers.includes("incompatible-run-event-subject-schema"));
    writeFileSync(join(repo, "result.txt"), "drifted\n");
    assert.equal(workspaceDeliveryMatch(repo, delivery, ["result.txt"]).status, "drifted");
    git(repo, ["checkout", baseline, "--", "result.txt"]);
    assert.equal(workspaceDeliveryMatch(repo, delivery, ["result.txt"]).matched, false);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("workspace matching treats Git pathspec magic literally and detects untracked recreation of delivered deletions", () => {
  const repo = mkdtempSync(join(tmpdir(), "workflow-learning-literal-paths-"));
  try {
    git(repo, ["init"]);
    const magicPath = ":(exclude)critical.js";
    writeFileSync(join(repo, magicPath), "baseline\n");
    writeFileSync(join(repo, "removed.txt"), "remove me\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "baseline"]);
    writeFileSync(join(repo, magicPath), "delivered\n");
    rmSync(join(repo, "removed.txt"));
    git(repo, ["add", "-A"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "delivery"]);
    const delivery = git(repo, ["rev-parse", "HEAD"]);

    assert.equal(workspaceDeliveryMatch(repo, delivery, [magicPath, "removed.txt"]).status, "matched");
    writeFileSync(join(repo, magicPath), "drifted\n");
    assert.equal(workspaceDeliveryMatch(repo, delivery, [magicPath]).status, "drifted");
    writeFileSync(join(repo, magicPath), "delivered\n");
    writeFileSync(join(repo, "removed.txt"), "untracked recreation\n");
    assert.equal(workspaceDeliveryMatch(repo, delivery, ["removed.txt"]).status, "drifted");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("cumulative delivery paths include both halves of a rename and reject source-path recreation", () => {
  const repo = mkdtempSync(join(tmpdir(), "workflow-learning-rename-paths-"));
  try {
    git(repo, ["init"]);
    writeFileSync(join(repo, "old-name.txt"), "delivered content\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "baseline"]);
    const baseline = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["mv", "old-name.txt", "new-name.txt"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "rename delivery"]);
    const delivery = git(repo, ["rev-parse", "HEAD"]);
    const deliveredPaths = changedPathsBetween(repo, baseline, delivery);

    assert.deepEqual(deliveredPaths, ["new-name.txt", "old-name.txt"]);
    assert.equal(workspaceDeliveryMatch(repo, delivery, deliveredPaths).status, "matched");
    writeFileSync(join(repo, "old-name.txt"), "recreated source\n");
    assert.equal(workspaceDeliveryMatch(repo, delivery, deliveredPaths).status, "drifted");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("workspace matching accepts exact file-directory and directory-file replacements", () => {
  const repo = mkdtempSync(join(tmpdir(), "workflow-learning-path-kind-"));
  try {
    git(repo, ["init"]);
    writeFileSync(join(repo, "node"), "file\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "file baseline"]);
    const fileBaseline = git(repo, ["rev-parse", "HEAD"]);
    rmSync(join(repo, "node"));
    writeFileSync(join(repo, "placeholder"), "temporary\n");
    git(repo, ["add", "-A"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "remove file"]);
    rmSync(join(repo, "placeholder"));
    mkdirSync(join(repo, "node"));
    writeFileSync(join(repo, "node", "child"), "directory child\n");
    git(repo, ["add", "-A"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "file to directory"]);
    const directoryDelivery = git(repo, ["rev-parse", "HEAD"]);
    const fileToDirectoryPaths = changedPathsBetween(repo, fileBaseline, directoryDelivery);
    assert.deepEqual(fileToDirectoryPaths, ["node", "node/child"]);
    assert.equal(workspaceDeliveryMatch(repo, directoryDelivery, fileToDirectoryPaths).status, "matched");

    rmSync(join(repo, "node"), { recursive: true });
    writeFileSync(join(repo, "node"), "file again\n");
    git(repo, ["add", "-A"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "directory to file"]);
    const fileDelivery = git(repo, ["rev-parse", "HEAD"]);
    const directoryToFilePaths = changedPathsBetween(repo, directoryDelivery, fileDelivery);
    assert.deepEqual(directoryToFilePaths, ["node", "node/child"]);
    assert.equal(workspaceDeliveryMatch(repo, fileDelivery, directoryToFilePaths).status, "matched");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
