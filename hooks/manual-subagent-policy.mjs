import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const MANUAL_SUBAGENT_POLICY_SCHEMA = 1;
export const MANUAL_SUBAGENT_MODES = Object.freeze(["parent-only", "parent-or-approved"]);
export const MANUAL_SUBAGENT_HOSTS = Object.freeze(["cursor", "codex"]);

export const MANUAL_SUBAGENT_PRESETS = Object.freeze({
  "cursor-composer-grok-v1": Object.freeze({
    host: "cursor",
    version: 1,
    parent_fallback: true,
    candidates: Object.freeze([
      Object.freeze({ model_id: "composer-2.5-fast" }),
      Object.freeze({ model_id: "cursor-grok-4.5-high-fast" }),
    ]),
  }),
  "codex-efficient-gpt-v1": Object.freeze({
    host: "codex",
    version: 1,
    parent_fallback: true,
    candidates: Object.freeze([
      Object.freeze({ model_id: "gpt-5.6-luna-max", reasoning_effort: "low" }),
      Object.freeze({ model_id: "gpt-5.6-terra-xhigh", reasoning_effort: "medium" }),
    ]),
  }),
});

const objectLike = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanId = (value) => typeof value === "string" && value.trim() !== ""
  ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 256)
  : null;

function sharedWorkflowHome(options = {}) {
  return resolve(options.homeRoot ?? process.env.GELDMACHER_WORKFLOW_HOME ?? join(homedir(), ".geldmacher", "workflow"));
}

function defaultHostPreferencesPath(options = {}) {
  return options.preferencesPath
    ?? process.env.GELDMACHER_WORKFLOW_PREFERENCES
    ?? join(sharedWorkflowHome(options), "preferences.yaml");
}

function scalar(token) {
  if (token === "true") return true;
  if (token === "false") return false;
  if (token === "null" || token === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1);
  }
  return token;
}

export function parsePreferenceYaml(source) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(source).split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const line = raw.trim();
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new Error("array item without array parent");
      const item = line.slice(2).trim();
      const colon = item.indexOf(":");
      if (colon >= 0) {
        const key = item.slice(0, colon).trim();
        const rest = item.slice(colon + 1).trim();
        const object = {};
        if (rest) object[key] = scalar(rest);
        parent.push(object);
        stack.push({ indent, value: object });
      } else {
        parent.push(scalar(item));
      }
      continue;
    }

    if (!objectLike(parent) || Array.isArray(parent)) throw new Error("mapping entry without object parent");
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`invalid mapping line: ${line}`);
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (rest === "[]") {
      parent[key] = [];
      continue;
    }
    if (rest) {
      parent[key] = scalar(rest);
      continue;
    }
    let nextIndex = lineIndex + 1;
    while (nextIndex < lines.length && (!lines[nextIndex].trim() || lines[nextIndex].trim().startsWith("#"))) nextIndex += 1;
    const next = nextIndex < lines.length ? lines[nextIndex] : "";
    const nextIndent = next.match(/^ */)?.[0].length ?? 0;
    const nextTrimmed = next.trim();
    if (next && nextIndent > indent && nextTrimmed.startsWith("- ")) {
      const child = [];
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      const child = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    }
  }
  return root;
}

function parentOnlyResolution(source, path, issues = []) {
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-only",
    source,
    path,
    authoritative: false,
    hosts: Object.freeze({
      cursor: Object.freeze({ host: "cursor", parent_fallback: true, candidates: Object.freeze([]), preset: null }),
      codex: Object.freeze({ host: "codex", parent_fallback: true, candidates: Object.freeze([]), preset: null }),
    }),
    ...(issues.length > 0 ? { issues: Object.freeze([...issues]) } : {}),
  });
}

function validateCandidate(candidate, label, errors) {
  if (!objectLike(candidate)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  for (const key of Object.keys(candidate)) {
    if (!["model_id", "reasoning_effort"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  const modelId = cleanId(candidate.model_id);
  if (!modelId) errors.push(`${label}.model_id is required`);
  let reasoning = null;
  if (candidate.reasoning_effort !== undefined) {
    reasoning = cleanId(candidate.reasoning_effort);
    if (!reasoning) errors.push(`${label}.reasoning_effort must be a non-empty string when set`);
  }
  return modelId ? Object.freeze({ model_id: modelId, ...(reasoning ? { reasoning_effort: reasoning } : {}) }) : null;
}

function resolveHostPolicy(raw, host, label, errors) {
  if (raw === undefined) {
    return Object.freeze({ host, parent_fallback: true, candidates: Object.freeze([]), preset: null });
  }
  if (!objectLike(raw)) {
    errors.push(`${label} must be an object`);
    return Object.freeze({ host, parent_fallback: true, candidates: Object.freeze([]), preset: null });
  }
  for (const key of Object.keys(raw)) {
    if (!["preset", "candidates", "parent_fallback"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (raw.preset !== undefined && raw.candidates !== undefined) {
    errors.push(`${label} may set preset or candidates, not both`);
  }
  let preset = null;
  let candidates = [];
  if (raw.preset !== undefined) {
    preset = cleanId(raw.preset);
    if (!preset) errors.push(`${label}.preset must be a non-empty string`);
    else {
      const definition = MANUAL_SUBAGENT_PRESETS[preset];
      if (!definition) errors.push(`${label}.preset is unknown: ${preset}`);
      else if (definition.host !== host) errors.push(`${label}.preset ${preset} is not valid for ${host}`);
      else candidates = definition.candidates.map((entry) => Object.freeze({ ...entry }));
    }
  }
  if (Array.isArray(raw.candidates)) {
    if (raw.candidates.length === 0) errors.push(`${label}.candidates must not be empty`);
    candidates = raw.candidates
      .map((entry, index) => validateCandidate(entry, `${label}.candidates[${index}]`, errors))
      .filter(Boolean);
  } else if (raw.candidates !== undefined) {
    errors.push(`${label}.candidates must be an array`);
  }
  const parentFallback = raw.parent_fallback === undefined
    ? true
    : raw.parent_fallback === true
      ? true
      : raw.parent_fallback === false
        ? false
        : (errors.push(`${label}.parent_fallback must be a boolean`), true);
  if (host === "cursor") {
    for (const [index, candidate] of candidates.entries()) {
      if (candidate.reasoning_effort) errors.push(`${label}.candidates[${index}] must not set reasoning_effort on Cursor`);
    }
  }
  return Object.freeze({
    host,
    parent_fallback: parentFallback,
    candidates: Object.freeze(candidates),
    preset,
  });
}

export function validateManualSubagentPolicy(value, label = "manual_subagent_policy") {
  const errors = [];
  if (!objectLike(value)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  for (const key of Object.keys(value)) {
    if (!["schema", "mode", "hosts"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (value.schema !== MANUAL_SUBAGENT_POLICY_SCHEMA) errors.push(`${label}.schema must be ${MANUAL_SUBAGENT_POLICY_SCHEMA}`);
  if (!MANUAL_SUBAGENT_MODES.includes(value.mode)) errors.push(`${label}.mode must be parent-only or parent-or-approved`);
  if (value.hosts !== undefined) {
    if (!objectLike(value.hosts)) errors.push(`${label}.hosts must be an object`);
    else {
      for (const key of Object.keys(value.hosts)) {
        if (!MANUAL_SUBAGENT_HOSTS.includes(key)) errors.push(`${label}.hosts has unknown host ${key}`);
      }
      for (const host of MANUAL_SUBAGENT_HOSTS) {
        resolveHostPolicy(value.hosts[host], host, `${label}.hosts.${host}`, errors);
      }
    }
  }
  return errors;
}

export function resolveManualSubagentPolicy(options = {}) {
  const path = options.preferencesPath ?? defaultHostPreferencesPath(options);
  if (!existsSync(path)) return parentOnlyResolution("default", path);
  let parsed;
  try {
    parsed = parsePreferenceYaml(readFileSync(path, "utf8"));
  } catch (error) {
    return parentOnlyResolution("invalid-fallback", path, [`preferences file is unreadable: ${error.message}`]);
  }
  if (!objectLike(parsed)) return parentOnlyResolution("invalid-fallback", path, ["preferences must be an object"]);
  if (parsed.manual_subagent_policy === undefined) return parentOnlyResolution("default", path);
  const errors = validateManualSubagentPolicy(parsed.manual_subagent_policy);
  if (errors.length > 0) return parentOnlyResolution("invalid-fallback", path, errors);
  const policy = parsed.manual_subagent_policy;
  if (policy.mode === "parent-only") {
    return Object.freeze({
      ...parentOnlyResolution("file", path),
      mode: "parent-only",
    });
  }
  const hostErrors = [];
  const hosts = Object.freeze({
    cursor: resolveHostPolicy(policy.hosts?.cursor, "cursor", "manual_subagent_policy.hosts.cursor", hostErrors),
    codex: resolveHostPolicy(policy.hosts?.codex, "codex", "manual_subagent_policy.hosts.codex", hostErrors),
  });
  if (hostErrors.length > 0) return parentOnlyResolution("invalid-fallback", path, hostErrors);
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-or-approved",
    source: "file",
    path,
    authoritative: false,
    hosts,
  });
}

export function approvedModelIds(hostPolicy) {
  return new Set((hostPolicy?.candidates ?? []).map((entry) => entry.model_id));
}

export function childAllowedByPolicy({ parentModel, observedChild, hostPolicy, mode }) {
  const parent = cleanId(parentModel);
  const child = cleanId(observedChild);
  if (!parent || !child) return { allowed: false, match_mode: null };
  if (child === parent) return { allowed: true, match_mode: "exact-parent" };
  if (mode !== "parent-or-approved") return { allowed: false, match_mode: null };
  if (approvedModelIds(hostPolicy).has(child)) return { allowed: true, match_mode: "approved-candidate" };
  return { allowed: false, match_mode: null };
}

export function selectCodexCandidate({ hostPolicy, mode, unavailable = [], parentModel = null }) {
  if (mode !== "parent-or-approved") {
    return Object.freeze({ kind: "parent", model_id: cleanId(parentModel), reasoning_effort: null, index: -1 });
  }
  const blocked = new Set((unavailable ?? []).map(cleanId).filter(Boolean));
  const candidates = hostPolicy?.candidates ?? [];
  for (const [index, candidate] of candidates.entries()) {
    if (blocked.has(candidate.model_id)) continue;
    return Object.freeze({
      kind: "candidate",
      model_id: candidate.model_id,
      reasoning_effort: candidate.reasoning_effort ?? null,
      index,
    });
  }
  if (hostPolicy?.parent_fallback !== false) {
    return Object.freeze({ kind: "parent", model_id: cleanId(parentModel), reasoning_effort: null, index: -1 });
  }
  return null;
}

export function expandPreset(name) {
  const preset = MANUAL_SUBAGENT_PRESETS[name];
  return preset ? Object.freeze({ ...preset, candidates: preset.candidates.map((entry) => Object.freeze({ ...entry })) }) : null;
}
