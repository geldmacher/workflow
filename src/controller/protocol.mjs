export const PLUGIN_VERSION = "4.0.0";
export const ARTIFACT_SCHEMA = 4;
export const RUN_RECORD_SCHEMA = 2;
export const PREPARATION_RECORD_SCHEMA = 2;
export const CONTROLLER_PROTOCOL = 4;

export const LEGACY_WORKFLOW_3 = Object.freeze({
  plugin_version: "3.0.0",
  artifact_schema: 3,
  run_record_schema: 1,
  preparation_record_schema: 1,
  controller_protocol: 3,
});

export function protocolFields() {
  return {
    run_record_schema: RUN_RECORD_SCHEMA,
    artifact_schema: ARTIFACT_SCHEMA,
    controller_protocol: CONTROLLER_PROTOCOL,
    plugin_version: PLUGIN_VERSION,
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
  const compatible = run?.run_record_schema === RUN_RECORD_SCHEMA
    && run?.artifact_schema === ARTIFACT_SCHEMA
    && run?.controller_protocol === CONTROLLER_PROTOCOL
    && run?.plugin_version === PLUGIN_VERSION;
  const legacy = run?.run_record_schema === LEGACY_WORKFLOW_3.run_record_schema
    && run?.artifact_schema === LEGACY_WORKFLOW_3.artifact_schema
    && run?.controller_protocol === LEGACY_WORKFLOW_3.controller_protocol
    && run?.plugin_version === LEGACY_WORKFLOW_3.plugin_version;
  return {
    compatible,
    legacy,
    compatibility: compatible ? "compatible" : legacy ? "read-only-workflow-3" : "read-only-incompatible",
    blocker: compatible ? null : legacy ? "legacy-workflow-3-read-only" : "incompatible-run-protocol",
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
    && preparation?.controller_protocol === CONTROLLER_PROTOCOL
    && preparation?.plugin_version === PLUGIN_VERSION;
  const legacy = preparation?.preparation_record_schema === LEGACY_WORKFLOW_3.preparation_record_schema
    && preparation?.artifact_schema === LEGACY_WORKFLOW_3.artifact_schema
    && preparation?.controller_protocol === LEGACY_WORKFLOW_3.controller_protocol
    && preparation?.plugin_version === LEGACY_WORKFLOW_3.plugin_version;
  return {
    compatible,
    legacy,
    compatibility: compatible ? "compatible" : legacy ? "read-only-workflow-3" : "read-only-incompatible",
    blocker: compatible ? null : legacy ? "legacy-workflow-3-read-only" : "incompatible-preparation-protocol",
  };
}

export function assertCompatiblePreparation(preparation) {
  const classification = classifyPreparationCompatibility(preparation);
  if (!classification.compatible) throw new Error(classification.blocker);
  return preparation;
}

export function runView(run) {
  const classification = classifyRunCompatibility(run);
  if (classification.compatible) return { ...run, compatibility: classification.compatibility };
  return {
    ...run,
    compatibility: classification.compatibility,
    lifecycle: "stopped",
    blockers: [...new Set([...(run?.blockers ?? []), classification.blocker])],
  };
}

export function preparationView(preparation) {
  const classification = classifyPreparationCompatibility(preparation);
  if (classification.compatible) return { ...preparation, compatibility: classification.compatibility };
  return {
    ...preparation,
    compatibility: classification.compatibility,
    status: "stopped",
    blockers: [...new Set([...(preparation?.blockers ?? []), classification.blocker])],
  };
}
