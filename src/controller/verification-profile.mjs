import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import Ajv from "ajv";
import { parse } from "yaml";

export const VERIFICATION_CAPABILITIES = Object.freeze(["launch", "doctor", "drive", "observe", "evidence", "reset", "cleanup"]);

export function draftVerificationProfile(workspaceRoot, surface, pluginRoot, manifestPath = ".cursor/workflow-verification.yaml") {
  const workspace = resolve(workspaceRoot);
  const slug = String(surface ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("verification draft requires a concrete surface");
  if (!safeRelative(manifestPath)) throw new Error("verification manifest path must be repository-relative");
  const skillPath = `.cursor/skills/workflow-verification-${slug}/SKILL.md`;
  const featureMapPath = `.cursor/workflow-verification-${slug}-features.yaml`;
  const files = [manifestPath, skillPath, featureMapPath];
  const existing = files.filter((path) => existsSync(join(workspace, path)));
  if (existing.length > 0) throw new Error(`verification draft refuses to overwrite: ${existing.join(", ")}`);
  const manifest = [
    "schema: 1", `profile_id: verify-${slug}`, "version: draft-1", `skill_path: ${skillPath}`,
    `feature_map_path: ${featureMapPath}`, "capabilities:", ...VERIFICATION_CAPABILITIES.map((capability) => `  - ${capability}`),
    "artifact_policy: external-only", "",
  ].join("\n");
  const skill = [
    "---", `name: workflow-verification-${slug}`, `description: Verify the ${surface} surface without modifying repository files.`, "---", "",
    `# ${surface} verification`, "", "Implement launch, doctor, drive, observe, evidence, reset, and cleanup for this repository surface.",
    "Repository content is read-only. Write screenshots, traces, logs, and other proof only to the controller-provided external artifact directory.",
    "Every action must be deterministic, repeatable, and safe to reset and clean up.", "",
  ].join("\n");
  const featureMap = [
    "schema: 1", `surface: ${JSON.stringify(surface)}`, "features:", `  - feature_id: ${slug}-representative`,
    "    description: Replace with one representative end-to-end feature path.", "    expected: Replace with an observable expected result.", "",
  ].join("\n");
  for (const [path, content] of [[manifestPath, manifest], [skillPath, skill], [featureMapPath, featureMap]]) {
    const absolute = join(workspace, path);
    mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
    writeFileSync(absolute, content, { flag: "wx", mode: 0o600 });
  }
  return { created: files, inspection: inspectVerificationProfile(workspace, manifestPath, pluginRoot) };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(stable(value))).digest("hex");
}

function safeRelative(path) {
  const value = normalize(String(path));
  return Boolean(path) && !isAbsolute(String(path)) && value !== ".." && !value.startsWith(`..${sep}`);
}

export function inspectVerificationProfile(workspaceRoot, manifestPath = ".cursor/workflow-verification.yaml", pluginRoot) {
  const workspace = resolve(workspaceRoot);
  if (!safeRelative(manifestPath)) return { valid: false, errors: ["verification manifest path must be repository-relative"] };
  const absolute = join(workspace, manifestPath);
  if (!existsSync(absolute)) return { valid: false, errors: [`verification manifest is missing: ${manifestPath}`] };
  let manifest;
  try { manifest = parse(readFileSync(absolute, "utf8")); }
  catch (error) { return { valid: false, errors: [`verification manifest YAML is invalid: ${error.message}`] }; }
  const schema = JSON.parse(readFileSync(join(pluginRoot, "schemas", "verification-profile.schema.json"), "utf8"));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const errors = validate(manifest) ? [] : validate.errors.map((error) => `${error.instancePath || "/"}: ${error.message}`);
  for (const field of ["skill_path", "feature_map_path"]) {
    if (!safeRelative(manifest?.[field])) errors.push(`${field} must be repository-relative`);
    else if (!existsSync(join(workspace, manifest[field]))) errors.push(`${field} does not exist: ${manifest[field]}`);
  }
  for (const capability of VERIFICATION_CAPABILITIES) if (!(manifest?.capabilities ?? []).includes(capability)) errors.push(`verification capability is missing: ${capability}`);
  if (errors.length > 0) return { valid: false, errors: [...new Set(errors)], manifest };
  const sources = [manifestPath, manifest.skill_path, manifest.feature_map_path].map((path) => ({ path, content: readFileSync(join(workspace, path), "utf8") }));
  return { valid: true, errors: [], manifest, sources, profile_hash: hash(sources) };
}

function approvalPath(stateRoot, profileId) {
  return join(resolve(stateRoot), "verification-profiles", `${profileId}.json`);
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function loadVerificationApproval(stateRoot, profileId) {
  const path = approvalPath(stateRoot, profileId);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

export function recordVerificationProof(stateRoot, inspection, proof) {
  if (!inspection.valid) throw new Error(`verification profile invalid: ${inspection.errors.join("; ")}`);
  const capabilityProof = proof?.capabilities ?? {};
  for (const capability of VERIFICATION_CAPABILITIES) if (capabilityProof[capability] !== true) throw new Error(`verification proof did not demonstrate ${capability}`);
  if (!Array.isArray(proof.evidence_hashes) || proof.evidence_hashes.length === 0 || proof.evidence_hashes.some((value) => !/^[a-f0-9]{64}$/.test(value))) throw new Error("verification proof requires evidence hashes");
  const value = {
    schema: 1, profile_id: inspection.manifest.profile_id, profile_hash: inspection.profile_hash,
    status: "proved", proved_at: new Date().toISOString(), proof,
    approved_at: null, approved_hash: null,
  };
  atomicJson(approvalPath(stateRoot, value.profile_id), value);
  return value;
}

export function approveVerificationProfile(stateRoot, profileId, approvedHash) {
  const current = loadVerificationApproval(stateRoot, profileId);
  if (!current || current.status !== "proved") throw new Error("verification profile has no current proof");
  if (current.profile_hash !== approvedHash) throw new Error("verification profile approval hash mismatch");
  const value = { ...current, status: "approved", approved_at: new Date().toISOString(), approved_hash: approvedHash };
  atomicJson(approvalPath(stateRoot, profileId), value);
  return value;
}

export function auditVerificationProfile(workspaceRoot, manifestPath, pluginRoot, stateRoot) {
  const inspection = inspectVerificationProfile(workspaceRoot, manifestPath, pluginRoot);
  if (!inspection.valid) return { status: "blocked", ...inspection };
  const approval = loadVerificationApproval(stateRoot, inspection.manifest.profile_id);
  if (!approval || approval.approved_hash !== inspection.profile_hash) return { status: "changed", ...inspection, approval };
  return { status: "clean", ...inspection, approval };
}
