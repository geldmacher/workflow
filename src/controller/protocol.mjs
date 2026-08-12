export const PLUGIN_VERSION = "5.3.0";
export const ARTIFACT_SCHEMA = 5;
export const RUN_RECORD_SCHEMA = 2;
export const PREPARATION_RECORD_SCHEMA = 2;
export const CONTROLLER_PROTOCOL = 5;
export const RUN_EVENT_SUBJECT_SCHEMA = 1;

export const LEGACY_WORKFLOW_3 = Object.freeze({
  plugin_version: "3.0.0",
  artifact_schema: 3,
  run_record_schema: 1,
  preparation_record_schema: 1,
  controller_protocol: 3,
});

export const LEGACY_WORKFLOW_4 = Object.freeze({
  plugin_version: "4.0.0",
  artifact_schema: 4,
  run_record_schema: 2,
  preparation_record_schema: 2,
  controller_protocol: 4,
});

function matchesProtocol(record, expected, recordSchemaField) {
  return record?.[recordSchemaField] === expected[recordSchemaField]
    && record?.artifact_schema === expected.artifact_schema
    && record?.controller_protocol === expected.controller_protocol;
}

function legacyClassification(record, recordSchemaField, subject) {
  if (matchesProtocol(record, LEGACY_WORKFLOW_4, recordSchemaField)) return {
    legacy: true,
    compatibility: "read-only-workflow-4",
    blocker: "legacy-workflow-4-read-only",
  };
  if (matchesProtocol(record, LEGACY_WORKFLOW_3, recordSchemaField)) return {
    legacy: true,
    compatibility: "read-only-workflow-3",
    blocker: "legacy-workflow-3-read-only",
  };
  return { legacy: false, compatibility: "read-only-incompatible", blocker: `incompatible-${subject}-protocol` };
}

export function protocolFields() {
  return {
    run_record_schema: RUN_RECORD_SCHEMA,
    artifact_schema: ARTIFACT_SCHEMA,
    controller_protocol: CONTROLLER_PROTOCOL,
    plugin_version: PLUGIN_VERSION,
    event_subject_schema: RUN_EVENT_SUBJECT_SCHEMA,
  };
}

export function runEventSubject(run) {
  return {
    schema: RUN_EVENT_SUBJECT_SCHEMA,
    kind: "controller-run",
    run_id: run?.run_id ?? null,
    root_plan_id: run?.plan?.fields?.id ?? run?.root_plan_id ?? null,
    intent_hash: run?.intent_hash ?? null,
    effective_profile: run?.effective_profile ?? null,
  };
}

export function preparationProtocolFields() {
  return {
    preparation_record_schema: PREPARATION_RECORD_SCHEMA,
    artifact_schema: ARTIFACT_SCHEMA,
    controller_protocol: CONTROLLER_PROTOCOL,
    plugin_version: PLUGIN_VERSION,
  };
}

export function classifyRunCompatibility(run) {
  const baseCompatible = run?.run_record_schema === RUN_RECORD_SCHEMA
    && run?.artifact_schema === ARTIFACT_SCHEMA
    && run?.controller_protocol === CONTROLLER_PROTOCOL;
  const eventSubjectCompatible = !Object.hasOwn(run ?? {}, "event_subject_schema")
    || run?.event_subject_schema === RUN_EVENT_SUBJECT_SCHEMA;
  const compatible = baseCompatible && eventSubjectCompatible;
  if (baseCompatible && !eventSubjectCompatible) return {
    compatible: false,
    legacy: false,
    compatibility: "read-only-incompatible",
    blocker: "incompatible-run-event-subject-schema",
  };
  const classification = compatible ? null : legacyClassification(run, "run_record_schema", "run");
  return {
    compatible,
    legacy: classification?.legacy ?? false,
    compatibility: compatible ? "compatible" : classification.compatibility,
    blocker: compatible ? null : classification.blocker,
  };
}

export function assertCompatibleRun(run) {
  const classification = classifyRunCompatibility(run);
  if (!classification.compatible) throw new Error(classification.blocker);
  return run;
}

export function classifyPreparationCompatibility(preparation) {
  const compatible = preparation?.preparation_record_schema === PREPARATION_RECORD_SCHEMA
    && preparation?.artifact_schema === ARTIFACT_SCHEMA
    && preparation?.controller_protocol === CONTROLLER_PROTOCOL;
  const classification = compatible ? null : legacyClassification(preparation, "preparation_record_schema", "preparation");
  return {
    compatible,
    legacy: classification?.legacy ?? false,
    compatibility: compatible ? "compatible" : classification.compatibility,
    blocker: compatible ? null : classification.blocker,
  };
}

export function assertCompatiblePreparation(preparation) {
  const classification = classifyPreparationCompatibility(preparation);
  if (!classification.compatible) throw new Error(classification.blocker);
  return preparation;
}

export function runView(run) {
  const classification = classifyRunCompatibility(run);
  const {
    delivery_evidence_artifact: _deliveryEvidenceArtifact,
    learning_candidates: _learningCandidates,
    ...visible
  } = run ?? {};
  if (classification.compatible) return { ...visible, compatibility: classification.compatibility };
  return {
    ...visible,
    compatibility: classification.compatibility,
    lifecycle: "stopped",
    blockers: [...new Set([...(run?.blockers ?? []), classification.blocker])],
  };
}

export function preparationView(preparation) {
  const classification = classifyPreparationCompatibility(preparation);
  const { input_root_lineage_artifacts: lineageArtifacts, ...visible } = preparation ?? {};
  const projected = {
    ...visible,
    input_root_lineage_artifact_count: Array.isArray(lineageArtifacts) ? lineageArtifacts.length : 0,
  };
  if (classification.compatible) return { ...projected, compatibility: classification.compatibility };
  return {
    ...projected,
    compatibility: classification.compatibility,
    status: "stopped",
    blockers: [...new Set([...(projected.blockers ?? []), classification.blocker])],
  };
}
