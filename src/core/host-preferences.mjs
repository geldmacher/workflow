import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

export const TOOL_APPROVAL_MODES = Object.freeze(["strict", "allowlisted"]);
const preferenceKeys = Object.freeze(["schema", "tool_approval", "manual_subagent_policy", "extensions"]);

export function sharedWorkflowHome(options = {}) {
  return resolve(options.homeRoot ?? process.env.GELDMACHER_WORKFLOW_HOME ?? join(homedir(), ".geldmacher", "workflow"));
}

export function defaultHostPreferencesPath(options = {}) {
  return options.preferencesPath
    ?? process.env.GELDMACHER_WORKFLOW_PREFERENCES
    ?? join(sharedWorkflowHome(options), "preferences.yaml");
}

function objectLike(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strictSummary(path, source, issues = []) {
  return Object.freeze({
    tool_approval: "strict",
    source,
    path,
    authoritative: false,
    grants_host_approval: false,
    host_allowlist_required: false,
    ...(issues.length > 0 ? { issues: Object.freeze([...issues]) } : {}),
  });
}

export function validateHostPreferences(value, label = "preferences") {
  const errors = [];
  if (!objectLike(value)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  for (const key of Object.keys(value)) {
    if (!preferenceKeys.includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (value.schema !== 1) errors.push(`${label}.schema must be 1`);
  if (!TOOL_APPROVAL_MODES.includes(value.tool_approval)) {
    errors.push(`${label}.tool_approval must be strict or allowlisted`);
  }
  if (value.manual_subagent_policy !== undefined && !objectLike(value.manual_subagent_policy)) {
    errors.push(`${label}.manual_subagent_policy must be an object`);
  }
  if (value.extensions !== undefined && !objectLike(value.extensions)) {
    errors.push(`${label}.extensions must be an object`);
  }
  return errors;
}

export function resolveHostToolApproval(options = {}) {
  const path = defaultHostPreferencesPath(options);
  if (!existsSync(path)) return strictSummary(path, "default");
  let parsed;
  try {
    parsed = parse(readFileSync(path, "utf8"));
  } catch (error) {
    return strictSummary(path, "invalid-fallback", [`preferences file is unreadable: ${error.message}`]);
  }
  const errors = validateHostPreferences(parsed);
  if (errors.length > 0) return strictSummary(path, "invalid-fallback", errors);
  const allowlisted = parsed.tool_approval === "allowlisted";
  return Object.freeze({
    tool_approval: parsed.tool_approval,
    source: "file",
    path,
    authoritative: false,
    grants_host_approval: false,
    host_allowlist_required: allowlisted,
  });
}
