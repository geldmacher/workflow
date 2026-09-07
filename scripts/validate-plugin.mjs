#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, lstatSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";
import { checkMarkdownLinks } from "./check-markdown-links.mjs";
import { publicSkills, hostSkills, manifestPaths, files } from "./build-plugin-targets.mjs";
import { validateReleaseSurfaceClosure } from "./release-surface.mjs";

export const defaultRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseFrontmatter(path, failures = []) {
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) { failures.push(`${path}: missing skill/command frontmatter`); return {}; }
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) { failures.push(`${path}: invalid frontmatter: ${doc.errors[0].message}`); return {}; }
  const data = doc.toJS();
  if (!data || typeof data !== "object" || Array.isArray(data)) { failures.push(`${path}: frontmatter must be a mapping`); return {}; }
  if (!namePattern.test(data.name ?? "")) failures.push(`${path}: invalid discovery name`);
  if (typeof data.description !== "string" || !data.description.trim()) failures.push(`${path}: missing discovery description`);
  return data;
}

function metadataSchema(path, schemaName, failures) {
  const schema = readJson(join(defaultRoot, "schemas", schemaName));
  const ajv = schemaName.startsWith("agent-plugins/") ? new Ajv2020({ allErrors: true, strict: false }) : new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(readJson(path))) failures.push(`${path}: ${ajv.errorsText(validate.errors)}`);
}

function skillsAt(root, expected, failures) {
  const directory = join(root, "skills");
  const actual = readdirSync(directory, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (actual.join() !== [...expected].sort().join()) failures.push(`${root}: unexpected skill inventory: ${actual.join(", ")}`);
  for (const name of actual) {
    const path = join(directory, name, "SKILL.md");
    if (!existsSync(path)) { failures.push(`${path}: missing entrypoint`); continue; }
    const data = parseFrontmatter(path, failures);
    if (data.name !== name) failures.push(`${path}: skill name differs from directory`);
  }
}

function manifestAt(path, host, version, failures) {
  const manifest = readJson(path);
  if (manifest.name !== "geldmacher-workflow" || manifest.version !== version) failures.push(`${host}: product identity or version mismatch`);
  if (manifest.hooks || manifest.mcpServers) failures.push(`${host}: runtime registration is not permitted`);
  if (host === "cursor") metadataSchema(path, "plugin.schema.json", failures);
  if (host === "agent-plugins") metadataSchema(path, "agent-plugins/1.0.0/plugin.schema.json", failures);
  if (host === "codex" && manifest.skills !== "./skills/") failures.push("Codex must discover the packaged skills directory");
  return manifest;
}

export function validateTarget(root, host, version) {
  const failures = [];
  try {
    const manifest = manifestAt(join(root, manifestPaths[host]), host, version, failures);
    skillsAt(root, hostSkills(host), failures);
    if (host === "cursor") {
      const expected = publicSkills.map((name) => `./skills/${name}/`).sort();
      if (!Array.isArray(manifest.skills) || [...manifest.skills].sort().join() !== expected.join()) failures.push("Cursor skill discovery differs from the public surface");
      const commands = readdirSync(join(root, "commands")).sort();
      if (commands.join() !== publicSkills.map((name) => `${name}.md`).sort().join()) failures.push("Cursor command inventory differs");
      for (const command of commands) parseFrontmatter(join(root, "commands", command), failures);
    }
    for (const path of files(root)) {
      const item = relative(root, path).split(sep).join("/");
      if (/\.(?:[cm]?js|py|sh)$/.test(item) || /^(?:dist|hooks|src|schemas|node_modules|scripts)\//.test(item) || /(?:^|\/)\.?mcp\.json$/.test(item)) failures.push(`unexpected runtime content: ${item}`);
      if (/\.md$/.test(item) && /yaml workflow-authority|Schema[- ]6|seal_artifacts|workflow_prepare|validate-artifact/.test(readFileSync(path, "utf8"))) failures.push(`obsolete Workflow instructions: ${item}`);
    }
    const inventory = validateReleaseSurfaceClosure(root).map((entry) => entry.relative_path).sort();
    const actual = files(root).map((path) => relative(root, path)).sort();
    if (inventory.join() !== actual.join()) failures.push("target inventory does not cover exact package contents");
    failures.push(...checkMarkdownLinks(root));
  } catch (error) { failures.push(error.message); }
  return failures;
}

export function validatePlugin(root = defaultRoot) {
  const failures = [];
  try {
    const version = readJson(join(root, "package.json")).version;
    for (const host of Object.keys(manifestPaths)) {
      const path = host === "cursor" ? join(root, manifestPaths[host]) : join(root, "targets", host, manifestPaths[host]);
      manifestAt(path, host, version, failures);
    }
    metadataSchema(join(root, ".cursor-plugin", "marketplace.json"), "marketplace.schema.json", failures);
    skillsAt(root, [...publicSkills, "implement-work"], failures);
    for (const name of publicSkills) parseFrontmatter(join(root, "commands", `${name}.md`), failures);
    validateReleaseSurfaceClosure(root);
    for (const name of ["src", "dist", "hooks", "mcp.json", "schemas/artifacts", "schemas/manual-workflow"]) if (existsSync(join(root, name))) failures.push(`obsolete source surface: ${name}`);
    for (const dir of ["skills", "references", "commands", "docs", "targets"]) {
      for (const path of files(join(root, dir))) {
        if (lstatSync(path).isSymbolicLink()) failures.push(`source symlink: ${path}`);
        if (/\.md$/.test(path) && /yaml workflow-authority|Schema[- ]6|seal_artifacts|workflow_prepare|validate-artifact/.test(readFileSync(path, "utf8"))) failures.push(`obsolete Workflow instructions: ${path}`);
      }
    }
  } catch (error) { failures.push(error.message); }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = validatePlugin();
  if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
  else console.log("Plugin source validation passed.");
}
