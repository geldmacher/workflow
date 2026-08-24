#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);

// src/controller/protocol.mjs
var PLUGIN_VERSION = "5.5.1";
var LEGACY_WORKFLOW_3 = Object.freeze({
  plugin_version: "3.0.0",
  artifact_schema: 3,
  run_record_schema: 1,
  preparation_record_schema: 1,
  controller_protocol: 3
}), LEGACY_WORKFLOW_4 = Object.freeze({
  plugin_version: "4.0.0",
  artifact_schema: 4,
  run_record_schema: 2,
  preparation_record_schema: 2,
  controller_protocol: 4
});
function matchesProtocol(record, expected, recordSchemaField) {
  return record?.[recordSchemaField] === expected[recordSchemaField] && record?.artifact_schema === expected.artifact_schema && record?.controller_protocol === expected.controller_protocol;
}
function legacyClassification(record, recordSchemaField, subject) {
  return matchesProtocol(record, LEGACY_WORKFLOW_4, recordSchemaField) ? {
    legacy: !0,
    compatibility: "read-only-workflow-4",
    blocker: "legacy-workflow-4-read-only"
  } : matchesProtocol(record, LEGACY_WORKFLOW_3, recordSchemaField) ? {
    legacy: !0,
    compatibility: "read-only-workflow-3",
    blocker: "legacy-workflow-3-read-only"
  } : { legacy: !1, compatibility: "read-only-incompatible", blocker: `incompatible-${subject}-protocol` };
}
function protocolFields() {
  return {
    run_record_schema: 2,
    artifact_schema: 5,
    controller_protocol: 5,
    plugin_version: PLUGIN_VERSION,
    event_subject_schema: 1
  };
}
function runEventSubject(run) {
  return {
    schema: 1,
    kind: "controller-run",
    run_id: run?.run_id ?? null,
    root_plan_id: run?.plan?.fields?.id ?? run?.root_plan_id ?? null,
    intent_hash: run?.intent_hash ?? null,
    effective_profile: run?.effective_profile ?? null
  };
}
function preparationProtocolFields() {
  return {
    preparation_record_schema: 2,
    artifact_schema: 5,
    controller_protocol: 5,
    plugin_version: PLUGIN_VERSION
  };
}
function classifyRunCompatibility(run) {
  let baseCompatible = run?.run_record_schema === 2 && run?.artifact_schema === 5 && run?.controller_protocol === 5, eventSubjectCompatible = !Object.hasOwn(run ?? {}, "event_subject_schema") || run?.event_subject_schema === 1, compatible = baseCompatible && eventSubjectCompatible;
  if (baseCompatible && !eventSubjectCompatible) return {
    compatible: !1,
    legacy: !1,
    compatibility: "read-only-incompatible",
    blocker: "incompatible-run-event-subject-schema"
  };
  let classification = compatible ? null : legacyClassification(run, "run_record_schema", "run");
  return {
    compatible,
    legacy: classification?.legacy ?? !1,
    compatibility: compatible ? "compatible" : classification.compatibility,
    blocker: compatible ? null : classification.blocker
  };
}
function assertCompatibleRun(run) {
  let classification = classifyRunCompatibility(run);
  if (!classification.compatible) throw new Error(classification.blocker);
  return run;
}
function classifyPreparationCompatibility(preparation) {
  let compatible = preparation?.preparation_record_schema === 2 && preparation?.artifact_schema === 5 && preparation?.controller_protocol === 5, classification = compatible ? null : legacyClassification(preparation, "preparation_record_schema", "preparation");
  return {
    compatible,
    legacy: classification?.legacy ?? !1,
    compatibility: compatible ? "compatible" : classification.compatibility,
    blocker: compatible ? null : classification.blocker
  };
}
function assertCompatiblePreparation(preparation) {
  let classification = classifyPreparationCompatibility(preparation);
  if (!classification.compatible) throw new Error(classification.blocker);
  return preparation;
}
function runView(run) {
  let classification = classifyRunCompatibility(run), {
    delivery_evidence_artifact: _deliveryEvidenceArtifact,
    work_review_artifact: _workReviewArtifact,
    workflow_artifacts: _workflowArtifacts,
    work_review_builder_provenance: _workReviewBuilderProvenance,
    learning_candidates: _learningCandidates,
    ...visible
  } = run ?? {};
  return classification.compatible ? { ...visible, compatibility: classification.compatibility } : {
    ...visible,
    compatibility: classification.compatibility,
    lifecycle: "stopped",
    blockers: [.../* @__PURE__ */ new Set([...run?.blockers ?? [], classification.blocker])]
  };
}
function preparationView(preparation) {
  let classification = classifyPreparationCompatibility(preparation), { input_root_lineage_artifacts: lineageArtifacts, ...visible } = preparation ?? {}, projected = {
    ...visible,
    input_root_lineage_artifact_count: Array.isArray(lineageArtifacts) ? lineageArtifacts.length : 0
  };
  return classification.compatible ? { ...projected, compatibility: classification.compatibility } : {
    ...projected,
    compatibility: classification.compatibility,
    status: "stopped",
    blockers: [.../* @__PURE__ */ new Set([...projected.blockers ?? [], classification.blocker])]
  };
}

export {
  PLUGIN_VERSION,
  protocolFields,
  runEventSubject,
  preparationProtocolFields,
  classifyRunCompatibility,
  assertCompatibleRun,
  classifyPreparationCompatibility,
  assertCompatiblePreparation,
  runView,
  preparationView
};
