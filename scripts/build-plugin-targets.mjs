#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { enumerateReleaseSurface, loadReleaseSurface } from "../src/controller/release-surface.mjs";

const defaultRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cursorExcludedPaths = new Set([
  ".cursor-plugin/marketplace.json",
  "schemas/agent-plugins/1.0.0/mcp.schema.json",
  "schemas/agent-plugins/1.0.0/plugin.schema.json",
]);
const expectedCodexSkills = ["correct-work", "engineering-work", "explain-work", "learn-from-work", "plan-work", "review-work", "verification-work", "work-status", "workflow-doctor"];
const expectedAgentPluginSkills = ["correct-work", "engineering-work", "explain-work", "implement-work", "learn-from-work", "plan-work", "review-work", "verification-work", "work-status", "workflow-doctor"];
const manualTools = ["workflow_artifact_context", "workflow_artifact_record", "workflow_closeout", "workflow_plan_preflight", "workflow_status"];
const forbiddenCodexText = [
  "@cursor/sdk",
  "CURSOR_API_KEY",
  "CURSOR_PLUGIN_ROOT",
  "workflow_answer",
  "workflow_control",
  "workflow_prepare",
  "workflow_start",
  "workflow_validate_models",
  "workflow_verification_profile",
  "workflow_watch",
];
const sharedReferences = [
  "artifact-protocol.md",
  "closeout-contract.md",
  "correction-contract.md",
  "delivery-evidence-contract.md",
  "delivery-evidence-output-contract.md",
  "design-contract.md",
  "executable-contract.md",
  "explanation-contract.md",
  "engineering-continuity-playbooks.md",
  "engineering-delivery-playbooks.md",
  "engineering-diagnostic-playbooks.md",
  "engineering-playbooks.md",
  "learning-contract.md",
  "host-approval-contract.md",
  "manual-workflow-contract.md",
  "manual-builder-contract.md",
  "manual-mcp-output-contract.md",
  "plan-container-contract.md",
  "project-verifier-template.md",
  "review-contract.md",
  "work-review-input-contract.md",
  "verification-work-contract.md",
  "state-contract.md",
];
const portableSkillReferences = Object.freeze({
  "correct-work": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "correction-contract.md", "artifact-protocol.md"],
  "engineering-work": ["portable-manual.md", "manual-workflow-contract.md", "engineering-playbooks.md", "engineering-diagnostic-playbooks.md", "engineering-delivery-playbooks.md", "engineering-continuity-playbooks.md"],
  "explain-work": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "state-contract.md", "explanation-contract.md"],
  "implement-work": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "artifact-protocol.md", "executable-contract.md"],
  "learn-from-work": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "artifact-protocol.md", "learning-contract.md"],
  "plan-work": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "artifact-protocol.md", "executable-contract.md", "design-contract.md", "engineering-playbooks.md", "engineering-diagnostic-playbooks.md", "engineering-delivery-playbooks.md", "engineering-continuity-playbooks.md", "plan-container-contract.md"],
  "review-work": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "artifact-protocol.md", "delivery-evidence-contract.md", "review-contract.md", "work-review-input-contract.md", "explanation-contract.md"],
  "verification-work": ["portable-manual.md", "verification-work-contract.md", "project-verifier-template.md"],
  "work-status": ["portable-manual.md", "manual-workflow-contract.md", "manual-builder-contract.md", "artifact-protocol.md", "state-contract.md"],
  "workflow-doctor": ["portable-manual.md", "verification-work-contract.md"],
});

function inside(base, path) {
  const item = relative(base, path);
  return item === "" || (item !== ".." && !item.startsWith(`..${sep}`));
}

function copyRegular(source, destination, projectRoot) {
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`target source may not be a symlink: ${relative(projectRoot, source)}`);
  if (stat.isDirectory()) {
    mkdirSync(destination, { recursive: true, mode: stat.mode & 0o777 });
    for (const entry of readdirSync(source).sort()) copyRegular(join(source, entry), join(destination, entry), projectRoot);
    return;
  }
  if (!stat.isFile()) throw new Error(`target source must be a regular file: ${relative(projectRoot, source)}`);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, readFileSync(source), { mode: stat.mode & 0o777 });
  chmodSync(destination, stat.mode & 0o777);
}

function copyRelative(projectRoot, sourceBase, destinationBase, item, destinationItem = item) {
  const source = resolve(sourceBase, item);
  const destination = resolve(destinationBase, destinationItem);
  if (!inside(sourceBase, source) || !inside(destinationBase, destination)) throw new Error(`target path escapes its root: ${item}`);
  if (!existsSync(source)) throw new Error(`target source is missing: ${relative(projectRoot, source)}`);
  copyRegular(source, destination, projectRoot);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}

function assertNoSymlinks(directory) {
  for (const path of files(directory)) if (lstatSync(path).isSymbolicLink()) throw new Error(`built target contains a symlink: ${relative(directory, path)}`);
}

function releaseSurface(runtimePaths, packageExtras) {
  return {
    schema: 1,
    runtime_paths: [...runtimePaths].sort(),
    package_extras: [...packageExtras].sort(),
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertCanonicalManifest(path, expectedVersion, label) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.version !== expectedVersion) throw new Error(`${label} source manifest version must be ${expectedVersion}, received ${manifest.version ?? "missing"}`);
  if (!/Workflow 6|Schema-6/.test(JSON.stringify(manifest))) throw new Error(`${label} source manifest must describe Workflow 6`);
  if (/Schema[- ]?[345]|Workflow [345]/i.test(JSON.stringify(manifest))) throw new Error(`${label} source manifest contains a pre-Workflow-6 description`);
  return manifest;
}

function buildCursor(projectRoot, destination) {
  for (const entry of enumerateReleaseSurface(projectRoot, "package_paths")) {
    if (!cursorExcludedPaths.has(entry.relative_path)) copyRelative(projectRoot, projectRoot, destination, entry.relative_path);
  }
  const surface = loadReleaseSurface(projectRoot);
  writeJson(join(destination, "release-surface.json"), releaseSurface(
    surface.runtime_paths.filter((path) => !cursorExcludedPaths.has(path)),
    surface.package_extras.filter((path) => !cursorExcludedPaths.has(path)),
  ));
  assertNoSymlinks(destination);
}

function buildCodex(projectRoot, destination, version) {
  const codexTargetRoot = join(projectRoot, "targets", "codex");
  for (const item of [".codex-plugin", ".mcp.json", "hooks", "skills", "README.md"]) copyRelative(projectRoot, codexTargetRoot, destination, item);
  const codexReadmePath = join(destination, "README.md");
  writeFileSync(codexReadmePath, readFileSync(codexReadmePath, "utf8").replaceAll("../../docs/installation.md", "docs/installation.md"));
  copyRelative(projectRoot, projectRoot, destination, "assets");
  copyRelative(projectRoot, projectRoot, destination, "docs/installation.md");
  copyRelative(projectRoot, projectRoot, destination, "docs/manual-workflow.md");
  for (const name of sharedReferences) copyRelative(projectRoot, join(projectRoot, "references"), join(destination, "references"), name);
  copyRelative(projectRoot, codexTargetRoot, destination, "references/codex-manual.md", "references/codex-manual.md");
  copyRelative(projectRoot, projectRoot, destination, "schemas/artifacts");
  copyRelative(projectRoot, projectRoot, destination, "schemas/manual-workflow");
  copyRelative(projectRoot, projectRoot, destination, "schemas/cursor-plan-wrapper.schema.json");
  copyRelative(projectRoot, projectRoot, destination, "scripts/validate-artifact.mjs");
  copyRelative(projectRoot, projectRoot, destination, "dist/codex/manual-workflow.mjs", "dist/manual-workflow.mjs");
  copyRelative(projectRoot, projectRoot, destination, "dist/codex/workflow-mcp.mjs", "dist/workflow-mcp.mjs");
  copyRelative(projectRoot, projectRoot, destination, "dist/codex/workflow-hook.mjs", "dist/workflow-hook.mjs");
  for (const item of ["CODEX_THIRD_PARTY_NOTICES.md", "LICENSE", "THIRD_PARTY_NOTICES.md"]) copyRelative(projectRoot, projectRoot, destination, item);

  const manifestPath = join(destination, ".codex-plugin", "plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name !== "geldmacher-workflow" || manifest.interface?.displayName !== "Workflow" || manifest.author?.name !== "Geldmacher") {
    throw new Error("Codex manifest product identity drifted");
  }
  if (manifest.version !== version) throw new Error("Codex source manifest version drifted during target build");
  writeJson(manifestPath, manifest);

  writeJson(join(destination, "release-surface.json"), releaseSurface([
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "assets",
    "docs",
    "dist",
    "hooks",
    "references",
    "release-surface.json",
    "schemas",
    "scripts/validate-artifact.mjs",
    "skills",
  ], ["CODEX_THIRD_PARTY_NOTICES.md", "LICENSE", "README.md", "THIRD_PARTY_NOTICES.md"]));

  const skills = readdirSync(join(destination, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(destination, "skills", entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  if (skills.join("\n") !== expectedCodexSkills.join("\n")) throw new Error(`Codex target skills differ: ${skills.join(", ")}`);
  const mcpBundle = readFileSync(join(destination, "dist", "workflow-mcp.mjs"), "utf8");
  for (const tool of manualTools) if (!mcpBundle.includes(tool)) throw new Error(`Codex MCP bundle is missing ${tool}`);
  const textFiles = files(destination).filter((path) => /\.(?:json|md|mjs|js)$/.test(path));
  for (const path of textFiles) {
    const source = readFileSync(path, "utf8");
    for (const forbidden of forbiddenCodexText) if (source.includes(forbidden)) throw new Error(`Codex target leaked ${forbidden} in ${relative(destination, path)}`);
  }
  assertNoSymlinks(destination);
}

function buildAgentPlugins(projectRoot, destination, version) {
  const agentPluginsTargetRoot = join(projectRoot, "targets", "agent-plugins");
  for (const item of ["plugin.json", "mcp.json", "README.md"]) copyRelative(projectRoot, agentPluginsTargetRoot, destination, item);
  for (const skill of expectedAgentPluginSkills) {
    const references = portableSkillReferences[skill];
    if (!references) throw new Error(`portable reference map is missing ${skill}`);
    const skillPath = join(destination, "skills", skill, "SKILL.md");
    copyRelative(projectRoot, agentPluginsTargetRoot, destination, `skills/${skill}/SKILL.md`);
    const localized = readFileSync(skillPath, "utf8")
      .replaceAll("../../references/portable-manual.md", "references/portable-manual.md")
      .replaceAll("../../../../references/", "references/");
    if (/\]\(\.\.\//.test(localized)) throw new Error(`portable skill ${skill} retains an escaping package reference`);
    writeFileSync(skillPath, localized);
    for (const name of references) {
      const sourceBase = ["manual-workflow-contract.md", "portable-manual.md"].includes(name)
        ? join(agentPluginsTargetRoot, "references")
        : join(projectRoot, "references");
      copyRelative(projectRoot, sourceBase, join(destination, "skills", skill, "references"), name);
    }
  }
  copyRelative(projectRoot, projectRoot, destination, "schemas/artifacts");
  copyRelative(projectRoot, projectRoot, destination, "schemas/manual-workflow");
  copyRelative(projectRoot, projectRoot, destination, "scripts/validate-artifact.mjs");
  copyRelative(projectRoot, projectRoot, destination, "dist/portable/manual-workflow.mjs", "dist/manual-workflow.mjs");
  copyRelative(projectRoot, projectRoot, destination, "dist/portable/workflow-mcp.mjs", "dist/workflow-mcp.mjs");
  for (const item of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) copyRelative(projectRoot, projectRoot, destination, item);

  const manifestPath = join(destination, "plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name !== "geldmacher-workflow" || manifest.author?.name !== "Geldmacher") {
    throw new Error("Agent Plugins manifest product identity drifted");
  }
  if (manifest.version !== version) throw new Error("Agent Plugins source manifest version drifted during target build");
  writeJson(manifestPath, manifest);

  const skills = readdirSync(join(destination, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(destination, "skills", entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  if (skills.join("\n") !== expectedAgentPluginSkills.join("\n")) {
    throw new Error(`Agent Plugins target skills differ: ${skills.join(", ")}`);
  }
  const mcpBundle = readFileSync(join(destination, "dist", "workflow-mcp.mjs"), "utf8");
  for (const tool of manualTools) if (!mcpBundle.includes(tool)) throw new Error(`Agent Plugins MCP bundle is missing ${tool}`);
  assertNoSymlinks(destination);
}

function contentDigest(directory) {
  const digest = createHash("sha256");
  for (const path of files(directory)) digest.update(`${relative(directory, path)}\0${createHash("sha256").update(readFileSync(path)).digest("hex")}\n`);
  return digest.digest("hex");
}

export function buildPluginTargets(outputRoot, sourceRoot = defaultRoot) {
  const projectRoot = resolve(sourceRoot);
  const destination = resolve(outputRoot);
  if (!inside(projectRoot, destination) && !inside(tmpdir(), destination)) throw new Error("target output must be under the repository or temporary directory");
  rmSync(destination, { recursive: true, force: true });
  const codexTargetRoot = join(projectRoot, "targets", "codex");
  const agentPluginsTargetRoot = join(projectRoot, "targets", "agent-plugins");
  const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
  assertCanonicalManifest(join(projectRoot, ".cursor-plugin", "plugin.json"), packageJson.version, "Cursor");
  assertCanonicalManifest(join(codexTargetRoot, ".codex-plugin", "plugin.json"), packageJson.version, "Codex");
  assertCanonicalManifest(join(agentPluginsTargetRoot, "plugin.json"), packageJson.version, "Agent Plugins");
  const cursor = join(destination, "cursor", "geldmacher-workflow");
  const codex = join(destination, "codex", "geldmacher-workflow");
  const agentPlugins = join(destination, "agent-plugins", "geldmacher-workflow");
  buildCursor(projectRoot, cursor);
  buildCodex(projectRoot, codex, packageJson.version);
  buildAgentPlugins(projectRoot, agentPlugins, packageJson.version);
  return {
    version: packageJson.version,
    cursor: { path: cursor, hash: contentDigest(cursor), files: files(cursor).length },
    codex: { path: codex, hash: contentDigest(codex), files: files(codex).length },
    agentPlugins: { path: agentPlugins, hash: contentDigest(agentPlugins), files: files(agentPlugins).length },
  };
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const check = process.argv.includes("--check");
  const output = check ? mkdtempSync(join(tmpdir(), "workflow-target-check-")) : join(defaultRoot, ".build", "plugins");
  try { process.stdout.write(`${JSON.stringify(buildPluginTargets(output), null, 2)}\n`); }
  finally { if (check) rmSync(output, { recursive: true, force: true }); }
}
