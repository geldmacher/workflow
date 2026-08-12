#!/usr/bin/env node
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { isMap, isScalar, parseDocument } from "yaml";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaRoot = join(repositoryRoot, "schemas", "agent-plugins", "1.0.0");
const pluginSchemaId = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const mcpSchemaId = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const expectedSkills = [
  "accept-work",
  "close-work",
  "correct-work",
  "explain-work",
  "implement-work",
  "learn-from-work",
  "plan-work",
  "review-work",
  "work-status",
];
const expectedTools = [
  "workflow_artifact_context",
  "workflow_artifact_record",
  "workflow_closeout",
  "workflow_plan_preflight",
  "workflow_status",
];
const allowedTopLevel = new Set([
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "dist",
  "mcp.json",
  "plugin.json",
  "schemas",
  "scripts",
  "skills",
]);
const forbiddenTopLevel = new Set([
  ".agents",
  ".build",
  ".codex",
  ".codex-plugin",
  ".cursor",
  ".cursor-plugin",
  ".git",
  ".mcp.json",
  "agents",
  "commands",
  "hooks",
  "node_modules",
  "src",
  "targets",
  "tests",
]);
const forbiddenText = [
  "@cursor/sdk",
  "CURSOR_API_KEY",
  "CURSOR_PLUGIN_ROOT",
  "${workspaceFolder}",
  "\"env_vars\"",
  "\"tool_timeout_sec\"",
  "workflow_answer",
  "workflow_control",
  "workflow_prepare",
  "workflow_start",
  "workflow_validate_models",
  "workflow_verification_profile",
  "workflow_watch",
];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
];

function inside(base, item) {
  const path = relative(base, item);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function json(path, label, failures) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
}

function schemaValidator(name) {
  const schema = JSON.parse(readFileSync(join(schemaRoot, name), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

function ajvFailures(label, validator) {
  return (validator.errors ?? []).map((error) => `${label}${error.instancePath || "/"} ${error.message}`);
}

function packageEntries(pluginRoot, failures) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      const item = relative(pluginRoot, path);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        failures.push(`${item}: symlinks are not permitted in the portable target`);
      } else if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile()) {
        files.push(path);
      } else {
        failures.push(`${item}: package entries must be regular files or directories`);
      }
    }
  }
  visit(pluginRoot);
  return files.sort();
}

function validatePackageSurface(pluginRoot, files, failures) {
  for (const entry of readdirSync(pluginRoot, { withFileTypes: true })) {
    if (!allowedTopLevel.has(entry.name)) failures.push(`${entry.name}: top-level package entry is not allowlisted`);
    if (forbiddenTopLevel.has(entry.name)) failures.push(`${entry.name}: native or development surface leaked into portable target`);
  }
  for (const required of ["LICENSE", "README.md", "THIRD_PARTY_NOTICES.md", "dist/workflow-mcp.mjs", "mcp.json", "plugin.json", "scripts/validate-artifact.mjs", "skills"]) {
    if (!existsSync(join(pluginRoot, required))) failures.push(`${required}: required portable package entry is missing`);
  }
  for (const path of files) {
    const item = relative(pluginRoot, path);
    if (item.split(sep).includes("marketplace.json")) failures.push(`${item}: marketplace metadata is host-specific`);
    if (!/\.(?:json|md|mjs|js)$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    for (const token of forbiddenText) if (source.includes(token)) failures.push(`${item}: host-specific token leaked: ${token}`);
    if (source.includes(repositoryRoot) || source.includes("/Users/") || source.includes("\\Users\\")) {
      failures.push(`${item}: absolute development path leaked into package`);
    }
    if (!["LICENSE", "THIRD_PARTY_NOTICES.md"].includes(item)) {
      for (const pattern of secretPatterns) if (pattern.test(source)) failures.push(`${item}: recognizable secret material is embedded`);
    }
  }
}

function validateManifest(pluginRoot, expectedVersion, failures) {
  const manifest = json(join(pluginRoot, "plugin.json"), "plugin.json", failures);
  if (!manifest) return null;
  const validate = schemaValidator("plugin.schema.json");
  if (!validate(manifest)) failures.push(...ajvFailures("plugin.json", validate));
  if (manifest.$schema !== pluginSchemaId) failures.push("plugin.json: schema must be pinned to Agent Plugins 1.0.0");
  if (manifest.name !== "geldmacher-workflow") failures.push("plugin.json: product name drifted");
  if (expectedVersion && manifest.version !== expectedVersion) {
    failures.push(`plugin.json: version ${manifest.version ?? "missing"} differs from package version ${expectedVersion}`);
  }
  for (const forbidden of ["displayName", "publisher", "hooks", "skills", "mcpServers"]) {
    if (Object.hasOwn(manifest, forbidden)) failures.push(`plugin.json: ${forbidden} is not a portable v1 manifest field`);
  }
  return manifest;
}

function placeholders(value, label, failures) {
  for (const match of String(value).matchAll(/\$\{([^}]+)\}/g)) {
    if (!["PLUGIN_ROOT", "PLUGIN_DATA"].includes(match[1])) failures.push(`${label}: unsupported placeholder ${match[0]}`);
  }
}

function containedConfiguredPath(pluginRoot, value, label, failures) {
  const dataRoot = resolve(pluginRoot, "..", ".plugin-data-validation-root");
  let base;
  let suffix;
  if (value === "${PLUGIN_ROOT}" || value.startsWith("${PLUGIN_ROOT}/")) {
    base = pluginRoot;
    suffix = value.slice("${PLUGIN_ROOT}".length).replace(/^\//, "");
  } else if (value === "${PLUGIN_DATA}" || value.startsWith("${PLUGIN_DATA}/")) {
    base = dataRoot;
    suffix = value.slice("${PLUGIN_DATA}".length).replace(/^\//, "");
  } else if (value.startsWith("./")) {
    base = pluginRoot;
    suffix = value.slice(2);
  } else {
    failures.push(`${label}: path must be ./, PLUGIN_ROOT, or PLUGIN_DATA rooted`);
    return null;
  }
  const path = resolve(base, suffix);
  if (!inside(base, path)) failures.push(`${label}: configured path escapes its declared root`);
  return path;
}

function validateMcp(pluginRoot, manifest, failures) {
  const mcp = json(join(pluginRoot, "mcp.json"), "mcp.json", failures);
  if (!mcp) return [];
  const validate = schemaValidator("mcp.schema.json");
  if (!validate(mcp)) failures.push(...ajvFailures("mcp.json", validate));
  if (mcp.$schema !== mcpSchemaId) failures.push("mcp.json: schema must be pinned to Agent Plugins 1.0.0");
  if (manifest?.$schema?.replace("plugin.schema.json", "") !== mcp.$schema?.replace("mcp.schema.json", "")) {
    failures.push("mcp.json: Agent Plugins version differs from plugin.json");
  }
  const servers = Object.keys(mcp.mcpServers ?? {}).sort();
  if (servers.join("\n") !== "geldmacher-workflow") failures.push(`mcp.json: expected only geldmacher-workflow server, found ${servers.join(", ") || "none"}`);
  const server = mcp.mcpServers?.["geldmacher-workflow"];
  if (!server) return servers;
  if (server.type !== "stdio") failures.push("mcp.json: Workflow portable server must use stdio");
  if (server.command !== "node") failures.push("mcp.json: Workflow portable server command must be the bare node token");
  if (/\s|[;&|]/.test(String(server.command ?? "")) || String(server.command ?? "").includes("${")) {
    failures.push("mcp.json: command must be one executable token without placeholders or shell syntax");
  }
  const expectedArgs = ["${PLUGIN_ROOT}/dist/workflow-mcp.mjs"];
  if (JSON.stringify(server.args) !== JSON.stringify(expectedArgs)) failures.push("mcp.json: args must target the bundled MCP through PLUGIN_ROOT");
  if (server.cwd !== "${PLUGIN_ROOT}") failures.push("mcp.json: cwd must be PLUGIN_ROOT");
  if (JSON.stringify(server.env) !== JSON.stringify({ GELDMACHER_WORKFLOW_SHARED_ROOT: "${PLUGIN_DATA}/shared" })) {
    failures.push("mcp.json: persistent Workflow state must be rooted at PLUGIN_DATA/shared");
  }
  for (const [index, arg] of (server.args ?? []).entries()) placeholders(arg, `mcp.json args[${index}]`, failures);
  for (const [key, value] of Object.entries(server.env ?? {})) {
    if (["PLUGIN_ROOT", "PLUGIN_DATA"].includes(key)) failures.push(`mcp.json: client-owned environment key ${key} may not be overridden`);
    placeholders(value, `mcp.json env.${key}`, failures);
  }
  placeholders(server.cwd ?? "", "mcp.json cwd", failures);
  containedConfiguredPath(pluginRoot, server.cwd ?? "", "mcp.json cwd", failures);
  const bundle = resolve(pluginRoot, "dist", "workflow-mcp.mjs");
  if (!inside(pluginRoot, bundle) || !existsSync(bundle) || !lstatSync(bundle).isFile()) failures.push("mcp.json: bundled MCP entrypoint is missing");
  return servers;
}

function skillFrontmatter(path, label, failures) {
  const source = readFileSync(path, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    failures.push(`${label}: missing or malformed YAML frontmatter`);
    return { source, document: null, fields: null };
  }
  const document = parseDocument(match[1], { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    failures.push(`${label}: invalid YAML frontmatter: ${document.errors.map((error) => error.message).join("; ")}`);
    return { source, document: null, fields: null };
  }
  const fields = document.toJS();
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    failures.push(`${label}: frontmatter must be an object`);
    return { source, document: null, fields: null };
  }
  return { source, document, fields };
}

function validMetadataNode(document) {
  const metadata = document.get("metadata", true);
  return isMap(metadata) && metadata.items.every((pair) => (
    isScalar(pair.key)
    && typeof pair.key.value === "string"
    && isScalar(pair.value)
    && typeof pair.value.value === "string"
  ));
}

function unicodeCodePointLength(value) {
  return [...value].length;
}

function validateMarkdownReferences(path, label, skillDir, failures) {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|#)/.test(reference)) continue;
    if (isAbsolute(reference)) {
      failures.push(`${label}: absolute skill reference is not portable: ${reference}`);
      continue;
    }
    const clean = reference.split(/[?#]/, 1)[0];
    const target = resolve(dirname(path), clean);
    if (!inside(skillDir, target)) {
      failures.push(`${label}: skill reference escapes its skill directory: ${reference}`);
    } else if (!existsSync(target) || !lstatSync(target).isFile()) {
      failures.push(`${label}: missing local skill reference: ${reference}`);
    }
  }
}

function validateSkills(pluginRoot, files, failures) {
  const skillsRoot = join(pluginRoot, "skills");
  if (!existsSync(skillsRoot) || !lstatSync(skillsRoot).isDirectory()) {
    failures.push("skills: fixed component location must be a directory");
    return [];
  }
  const discovered = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  if (discovered.join("\n") !== expectedSkills.join("\n")) {
    failures.push(`skills: expected ${expectedSkills.join(", ")}, found ${discovered.join(", ") || "none"}`);
  }
  const nested = files.filter((path) => path.endsWith(`${sep}SKILL.md`) && relative(skillsRoot, path).split(sep).length !== 2);
  for (const path of nested) failures.push(`${relative(pluginRoot, path)}: skills are discovered only as immediate children`);
  const allowedFields = new Set(["allowed-tools", "compatibility", "description", "license", "metadata", "name"]);
  for (const name of discovered) {
    const skillDir = join(skillsRoot, name);
    const skillPath = join(skillDir, "SKILL.md");
    const item = relative(pluginRoot, skillPath);
    const { document, fields } = skillFrontmatter(skillPath, item, failures);
    if (!fields) continue;
    for (const key of Object.keys(fields)) if (!allowedFields.has(key)) failures.push(`${item}: unsupported Agent Skills frontmatter field ${key}`);
    if (fields.name !== name) failures.push(`${item}: skill name must match directory ${name}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(fields.name ?? "")) || String(fields.name ?? "").length > 64) {
      failures.push(`${item}: invalid Agent Skills name`);
    }
    if (typeof fields.description !== "string" || fields.description.trim().length === 0 || unicodeCodePointLength(fields.description) > 1024) {
      failures.push(`${item}: description must be a non-empty string of at most 1024 characters`);
    }
    if (Object.hasOwn(fields, "license") && typeof fields.license !== "string") {
      failures.push(`${item}: license must be a string`);
    }
    if (Object.hasOwn(fields, "compatibility") && (
      typeof fields.compatibility !== "string"
      || fields.compatibility.trim().length === 0
      || unicodeCodePointLength(fields.compatibility) > 500
    )) {
      failures.push(`${item}: compatibility must be a non-empty string of at most 500 characters`);
    }
    if (Object.hasOwn(fields, "metadata") && !validMetadataNode(document)) {
      failures.push(`${item}: metadata must be a string-to-string mapping`);
    }
    if (Object.hasOwn(fields, "allowed-tools") && (
      typeof fields["allowed-tools"] !== "string"
      || fields["allowed-tools"].trim().length === 0
    )) {
      failures.push(`${item}: allowed-tools must be a non-empty string`);
    }
    for (const path of files.filter((path) => inside(skillDir, path) && path.endsWith(".md"))) {
      validateMarkdownReferences(path, relative(pluginRoot, path), skillDir, failures);
    }
  }
  return discovered;
}

export function validateAgentPlugin(pluginPath, options = {}) {
  const pluginRoot = resolve(pluginPath);
  const failures = [];
  if (!existsSync(pluginRoot) || !lstatSync(pluginRoot).isDirectory()) {
    throw new Error(`Agent Plugins target is not a directory: ${pluginRoot}`);
  }
  const files = packageEntries(pluginRoot, failures);
  validatePackageSurface(pluginRoot, files, failures);
  const manifest = validateManifest(pluginRoot, options.expectedVersion, failures);
  const servers = validateMcp(pluginRoot, manifest, failures);
  const skills = validateSkills(pluginRoot, files, failures);
  const bundlePath = join(pluginRoot, "dist", "workflow-mcp.mjs");
  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath, "utf8");
    for (const tool of expectedTools) if (!bundle.includes(tool)) failures.push(`dist/workflow-mcp.mjs: missing Manual tool ${tool}`);
  }
  if (failures.length > 0) throw new Error(`Agent Plugins v1 validation failed:\n- ${[...new Set(failures)].join("\n- ")}`);
  return {
    path: pluginRoot,
    version: manifest?.version ?? null,
    skills,
    servers,
    files: files.length,
  };
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  if (process.argv.includes("--build")) {
    const output = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-validation-"));
    try {
      const { buildPluginTargets } = await import("./build-plugin-targets.mjs");
      const result = buildPluginTargets(output);
      process.stdout.write(`${JSON.stringify(validateAgentPlugin(result.agentPlugins.path, { expectedVersion: result.version }), null, 2)}\n`);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  } else {
    const target = process.argv.find((argument, index) => index > 1 && !argument.startsWith("--"))
      ?? join(repositoryRoot, ".build", "plugins", "agent-plugins", "geldmacher-workflow");
    const version = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")).version;
    process.stdout.write(`${JSON.stringify(validateAgentPlugin(target, { expectedVersion: version }), null, 2)}\n`);
  }
}
