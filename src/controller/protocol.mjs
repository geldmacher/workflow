export const PLUGIN_VERSION = "3.0.0";
export const ARTIFACT_SCHEMA = 3;
export const RUN_RECORD_SCHEMA = 1;
export const PREPARATION_RECORD_SCHEMA = 1;
export const CONTROLLER_PROTOCOL = 3;

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
  return {
    compatible,
    compatibility: compatible ? "compatible" : "read-only-incompatible",
    blocker: compatible ? null : "incompatible-run-protocol",
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
  return {
    compatible,
    compatibility: compatible ? "compatible" : "read-only-incompatible",
    blocker: compatible ? null : "incompatible-preparation-protocol",
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
