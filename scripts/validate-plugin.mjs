#!/usr/bin/env node
import { existsSync, globSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = dirname(scriptDirectory);
const manifestSchemaPath = join(defaultRoot, "schemas", "plugin.schema.json");
const marketplaceSchemaPath = join(defaultRoot, "schemas", "marketplace.schema.json");
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const globPattern = /[*?[{]/;
const expected = Object.freeze({
  commands: ["accept-work", "auto-work", "close-work", "correct-work", "explain-work", "learn-from-work", "plan-work", "review-work", "work-control", "work-models", "work-status", "work-verification", "work-watch"],
  agents: ["delivery-auditor", "risk-auditor", "work-design-auditor", "work-explainer", "work-plan-auditor"],
  skills: ["work-automation", "work-closeout", "work-execution", "work-explanation", "work-learning", "work-planning", "work-review"],
  rules: [],
  artifacts: ["delivery-evidence", "work-plan", "work-review"],
  references: ["artifact-protocol", "automation-contract", "automation-preparation-contract", "closeout-contract", "correction-contract", "delivery-evidence-contract", "delivery-evidence-output-contract", "design-contract", "executable-contract", "explanation-contract", "learning-contract", "model-routing-contract", "plan-container-contract", "review-contract", "state-contract", "verification-profile-contract"],
});

const readText = (path) => readFileSync(path, "utf8");

function listFiles(directory, predicate) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, predicate));
    else if (entry.isFile() && predicate(path)) files.push(path);
  }
  return files.sort();
}

function isWithin(root, target) {
  const path = relative(root, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function staticPath(path) {
  const match = path.match(globPattern);
  if (!match) return path;
  const prefix = path.slice(0, match.index);
  return prefix.endsWith("/") ? prefix.slice(0, -1) : dirname(prefix);
}

function expandDeclaredPath(root, value, predicate) {
  const candidate = resolve(root, staticPath(value));
  if (!globPattern.test(value)) {
    if (!existsSync(candidate)) return [];
    if (statSync(candidate).isDirectory()) return listFiles(candidate, predicate);
    return predicate(candidate) ? [candidate] : [];
  }
  if (!existsSync(candidate)) return [];
  return globSync(value, { cwd: root }).map((file) => resolve(root, file))
    .filter((file) => existsSync(file) && statSync(file).isFile() && predicate(file));
}

function validateExplicitCoverage(root, manifest, recordsByType, failures) {
  for (const [type, records] of Object.entries(recordsByType)) {
    if (!manifest[type]) continue;
    const declared = new Set();
    const predicate = type === "commands"
      ? (file) => [".md", ".txt"].includes(extname(file))
      : type === "agents"
        ? (file) => extname(file) === ".md"
        : type === "skills"
          ? (file) => basename(file) === "SKILL.md"
          : (file) => [".md", ".mdc"].includes(extname(file));
    for (const value of Array.isArray(manifest[type]) ? manifest[type] : [manifest[type]]) {
      const matches = expandDeclaredPath(root, value, predicate);
      if (matches.length === 0) failures.push(`plugin.json ${type}: declared path has no component matches: ${value}`);
      for (const file of matches) declared.add(realpathSync(file));
    }
    const actual = new Set(records.map((record) => realpathSync(record.file)));
    const missing = [...actual].filter((file) => !declared.has(file)).map((file) => relative(root, file));
    const extra = [...declared].filter((file) => !actual.has(file)).map((file) => relative(root, file));
    if (missing.length > 0 || extra.length > 0) failures.push(`plugin.json ${type}: explicit paths do not cover the public surface; missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }
}

function formatAjvError(error) {
  const location = error.instancePath || "/";
  return error.keyword === "additionalProperties"
    ? `plugin.json ${location}: ${error.message}: ${error.params.additionalProperty}`
    : `plugin.json ${location}: ${error.message}`;
}

export function parseFrontmatter(file, failures = []) {
  const match = readText(file).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    failures.push(`${file}: missing or malformed frontmatter`);
    return {};
  }
  const document = parseDocument(match[1], { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    for (const error of document.errors) failures.push(`${file}: invalid YAML: ${error.message}`);
    return {};
  }
  const fields = document.toJS();
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    failures.push(`${file}: frontmatter must be a YAML object`);
    return {};
  }
  return fields;
}

function requireString(fields, field, label, failures) {
  if (typeof fields[field] !== "string" || fields[field].trim() === "") {
    failures.push(`${label}: missing non-empty string field ${field}`);
  }
}

function validateDeclaredPath(root, rootReal, value, label, failures) {
  if (typeof value !== "string" || value.trim() === "") return failures.push(`${label}: path must be a non-empty string`);
  if (isAbsolute(value)) return failures.push(`${label}: absolute paths are not allowed: ${value}`);
  const candidate = resolve(root, staticPath(value));
  if (!isWithin(root, candidate)) return failures.push(`${label}: path escapes plugin root: ${value}`);
  if (!existsSync(candidate)) return failures.push(`${label}: target does not exist: ${value}`);
  if (!isWithin(rootReal, realpathSync(candidate))) failures.push(`${label}: target resolves outside plugin root: ${value}`);
}

function validateNames(records, type, expectedNames, failures) {
  const names = records.map((record) => record.fields.name).filter(Boolean).sort();
  if (names.join("\n") !== expectedNames.join("\n")) {
    failures.push(`${type}: expected [${expectedNames.join(", ")}], received [${names.join(", ")}]`);
  }
  if (new Set(names).size !== names.length) failures.push(`${type}: duplicate component name`);
}

function validateRelease(root, manifest, failures) {
  for (const field of ["displayName", "description", "version", "author", "publisher", "license", "logo", "homepage", "repository", "category", "keywords", "tags"]) {
    if (!manifest[field] || (Array.isArray(manifest[field]) && manifest[field].length === 0)) failures.push(`release metadata is missing ${field}`);
  }
  const packageJson = JSON.parse(readText(join(root, "package.json")));
  if (packageJson.version !== manifest.version) failures.push("package.json version differs from plugin.json");
  if (!readText(join(root, "CHANGELOG.md")).includes(`## ${manifest.version}`)) failures.push(`CHANGELOG.md has no ${manifest.version} heading`);
  const readme = readText(join(root, "README.md"));
  for (const heading of ["## Intent and expectations", "## Installation", "## Usage", "## Artifact protocol", "## Components", "## Development"]) {
    if (!readme.includes(heading)) failures.push(`README.md is missing ${heading}`);
  }
  if (!existsSync(join(root, "docs", "release-checklist.md"))) failures.push("docs/release-checklist.md is missing");
  if (!existsSync(join(root, "docs", "release-validation.md"))) failures.push("docs/release-validation.md is missing");
  if (!existsSync(join(root, "THIRD_PARTY_NOTICES.md"))) failures.push("THIRD_PARTY_NOTICES.md is missing");
  if (!existsSync(join(root, "CONTROLLER_THIRD_PARTY_NOTICES.md"))) failures.push("CONTROLLER_THIRD_PARTY_NOTICES.md is missing");
}

function validateHookSurface(root, manifest, failures) {
  const expectedPath = "./hooks/hooks.json";
  const expectedCommand = "node \"${CURSOR_PLUGIN_ROOT}/hooks/subagent-guard.mjs\"";
  if (manifest.hooks !== expectedPath) failures.push(`plugin.json hooks must reference ${expectedPath}`);
  const directory = join(root, "hooks");
  const configPath = join(directory, "hooks.json");
  const scriptPath = join(directory, "subagent-guard.mjs");
  if (!existsSync(configPath)) failures.push("hooks/hooks.json is missing");
  if (!existsSync(scriptPath)) failures.push("hooks/subagent-guard.mjs is missing");
  const files = listFiles(directory, () => true).map((file) => relative(root, file));
  const expectedFiles = ["hooks/hooks.json", "hooks/subagent-guard.mjs"];
  if (files.join("\n") !== expectedFiles.join("\n")) failures.push(`hooks: expected [${expectedFiles.join(", ")}], received [${files.join(", ")}]`);
  if (!existsSync(configPath)) return;
  try {
    const config = JSON.parse(readText(configPath));
    const topLevelKeys = Object.keys(config).sort();
    if (topLevelKeys.join("\n") !== ["hooks", "version"].join("\n")) failures.push("hooks/hooks.json must contain only version and hooks");
    if (config.version !== 1) failures.push("hooks/hooks.json version must equal 1");
    const eventNames = Object.keys(config.hooks ?? {});
    if (eventNames.join("\n") !== "subagentStart") failures.push("hooks/hooks.json must declare only subagentStart");
    const entries = config.hooks?.subagentStart;
    if (!Array.isArray(entries) || entries.length !== 1) failures.push("hooks/hooks.json must declare exactly one subagentStart command");
    else {
      const [entry] = entries;
      if (entry?.type !== "command") failures.push("subagentStart hook type must be command");
      if (entry?.command !== expectedCommand) failures.push("subagentStart hook must use the bundled Node guard through CURSOR_PLUGIN_ROOT");
      if (entry?.failClosed !== true) failures.push("subagentStart hook must set failClosed true");
      if (Object.keys(entry ?? {}).sort().join("\n") !== ["command", "failClosed", "type"].join("\n")) failures.push("subagentStart hook contains unsupported fields");
    }
    if (/\bnpx\b|\blatest\b/i.test(JSON.stringify(config))) failures.push("hooks must not install or resolve runtime dependencies");
  } catch (error) {
    failures.push(`hooks/hooks.json is invalid JSON: ${error.message}`);
  }
}

export function validatePlugin(root = defaultRoot, options = {}) {
  const failures = [];
  const rootPath = resolve(root);
  const rootReal = realpathSync(rootPath);
  const manifestPath = join(rootPath, ".cursor-plugin", "plugin.json");
  if (!existsSync(manifestPath)) return [".cursor-plugin/plugin.json is missing"];

  let manifest;
  try { manifest = JSON.parse(readText(manifestPath)); }
  catch (error) { return [`plugin.json is invalid JSON: ${error.message}`]; }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateManifest = ajv.compile(JSON.parse(readText(manifestSchemaPath)));
  if (!validateManifest(manifest)) failures.push(...validateManifest.errors.map(formatAjvError));
  if (manifest.version && !semverPattern.test(manifest.version)) failures.push(`plugin.json version is not semantic: ${manifest.version}`);

  const marketplacePath = join(rootPath, ".cursor-plugin", "marketplace.json");
  if (existsSync(marketplacePath)) {
    try {
      const marketplace = JSON.parse(readText(marketplacePath));
      const validateMarketplace = ajv.compile(JSON.parse(readText(marketplaceSchemaPath)));
      if (!validateMarketplace(marketplace)) failures.push(...validateMarketplace.errors.map((error) => `marketplace.json ${error.instancePath || "/"}: ${error.message}`));
      if (marketplace.plugins?.length !== 1 || marketplace.plugins[0]?.name !== manifest.name || marketplace.plugins[0]?.source !== ".") failures.push("marketplace.json must expose exactly the current plugin with source .");
    } catch (error) { failures.push(`marketplace.json is invalid: ${error.message}`); }
  } else if (options.release) failures.push(".cursor-plugin/marketplace.json is missing");

  for (const field of ["commands", "agents", "skills", "rules"]) {
    if (!manifest[field]) continue;
    for (const value of Array.isArray(manifest[field]) ? manifest[field] : [manifest[field]]) {
      validateDeclaredPath(rootPath, rootReal, value, `plugin.json ${field}`, failures);
    }
  }
  if (manifest.logo && !/^https?:\/\//.test(manifest.logo)) validateDeclaredPath(rootPath, rootReal, manifest.logo, "plugin.json logo", failures);

  const commands = listFiles(join(rootPath, "commands"), (file) => [".md", ".txt"].includes(extname(file)))
    .map((file) => ({ file, label: relative(rootPath, file), fields: parseFrontmatter(file, failures) }));
  const agents = listFiles(join(rootPath, "agents"), (file) => extname(file) === ".md")
    .map((file) => ({ file, label: relative(rootPath, file), fields: parseFrontmatter(file, failures) }));
  const skills = listFiles(join(rootPath, "skills"), (file) => basename(file) === "SKILL.md")
    .map((file) => ({ file, label: relative(rootPath, file), fields: parseFrontmatter(file, failures) }));
  const rules = listFiles(join(rootPath, "rules"), (file) => [".md", ".mdc"].includes(extname(file)))
    .map((file) => ({ file, label: relative(rootPath, file), fields: parseFrontmatter(file, failures) }));
  validateExplicitCoverage(rootPath, manifest, { commands, agents, skills, rules }, failures);

  for (const record of commands) {
    requireString(record.fields, "name", record.label, failures);
    requireString(record.fields, "description", record.label, failures);
    if (record.fields.name !== basename(record.file, extname(record.file))) failures.push(`${record.label}: name must match filename`);
    if (record.fields.name && !namePattern.test(record.fields.name)) failures.push(`${record.label}: invalid name`);
  }
  for (const record of skills) {
    requireString(record.fields, "name", record.label, failures);
    requireString(record.fields, "description", record.label, failures);
    if (record.fields.name !== basename(dirname(record.file))) failures.push(`${record.label}: name must match parent folder`);
    if (record.fields.name && !namePattern.test(record.fields.name)) failures.push(`${record.label}: invalid name`);
  }
  for (const record of agents) {
    requireString(record.fields, "name", record.label, failures);
    requireString(record.fields, "description", record.label, failures);
    if (record.fields.name !== basename(record.file, ".md")) failures.push(`${record.label}: name must match filename`);
    if (record.fields.model !== "inherit") failures.push(`${record.label}: model must be inherit`);
    if (record.fields.readonly !== true) failures.push(`${record.label}: readonly must be true`);
  }
  validateNames(commands, "commands", expected.commands, failures);
  validateNames(agents, "agents", expected.agents, failures);
  validateNames(skills, "skills", expected.skills, failures);
  validateNames(rules, "rules", expected.rules, failures);

  const artifactFiles = listFiles(join(rootPath, "schemas", "artifacts"), (file) => extname(file) === ".json");
  const artifactNames = artifactFiles.map((file) => basename(file, ".schema.json")).sort();
  if (artifactNames.join("\n") !== expected.artifacts.join("\n")) failures.push(`artifact schemas differ: [${artifactNames.join(", ")}]`);
  for (const file of artifactFiles) {
    const schema = JSON.parse(readText(file));
    const artifactName = basename(file, ".schema.json");
    const expectedId = `urn:geldmacher:cursor-artifact:${artifactName}:5`;
    if (schema.additionalProperties !== false) failures.push(`${relative(rootPath, file)}: additionalProperties must be false for Schema-5 artifacts`);
    if (schema.properties?.schema?.const !== 5) failures.push(`${relative(rootPath, file)}: artifact schema must require 5`);
    if (schema.properties?.extensions?.type !== "object" || schema.properties.extensions.additionalProperties !== true) failures.push(`${relative(rootPath, file)}: extensions must be the only open metadata object`);
    if (schema.$schema !== "http://json-schema.org/draft-07/schema#") failures.push(`${relative(rootPath, file)}: $schema must be JSON Schema draft-07`);
    if (schema.$id !== expectedId) failures.push(`${relative(rootPath, file)}: schema id must equal ${expectedId}`);
    const sections = schema["x-required-sections"] ?? schema["x-markdown-sections"];
    if (!Array.isArray(sections) || sections.length === 0) failures.push(`${relative(rootPath, file)}: missing markdown sections`);
  }
  const wrapperSchemaPath = join(rootPath, "schemas", "cursor-plan-wrapper.schema.json");
  if (!existsSync(wrapperSchemaPath)) failures.push("schemas/cursor-plan-wrapper.schema.json is missing");
  else {
    const wrapperSchema = JSON.parse(readText(wrapperSchemaPath));
    if (wrapperSchema.additionalProperties !== true) failures.push("schemas/cursor-plan-wrapper.schema.json: additionalProperties must be true");
    if (wrapperSchema.$id !== "urn:geldmacher:cursor-plan-wrapper:1") failures.push("schemas/cursor-plan-wrapper.schema.json: invalid schema id");
    for (const field of ["todos", "isProject"]) if (!wrapperSchema.required?.includes(field)) failures.push(`schemas/cursor-plan-wrapper.schema.json: missing required ${field}`);
  }

  const references = listFiles(join(rootPath, "references"), (file) => extname(file) === ".md")
    .map((file) => ({ file, label: relative(rootPath, file), fields: {} }));
  const runtime = [...commands, ...agents, ...skills, ...rules, ...references].map((record) => readText(record.file)).join("\n");
  const capabilityRules = [
    /MODE (?:GATE|PREREQUISITE)/i,
    /MODE REQUIRED:/i,
    /use only Read\/Search/i,
    /edit\+terminal/i,
    /native Plan creation exists/i,
  ];
  if (capabilityRules.some((pattern) => pattern.test(runtime))) failures.push("runtime guidance contains a Cursor capability gate or tool allowlist");
  const vendorNamespace = `${manifest.publisher ?? ""}-${manifest.name ?? ""}`.toLowerCase();
  const foreignProducts = [...runtime.matchAll(/\bgeldmacher-[a-z0-9-]+\b/gi)]
    .map((match) => match[0])
    .filter((name) => ![manifest.name.toLowerCase(), vendorNamespace].includes(name.toLowerCase()));
  if (foreignProducts.length > 0) failures.push("runtime guidance contains a foreign product name");
  const foreignCommands = ["setup-rtk", "create-rtk-filter", "budget-efficiency", "compact-context", "optimize-context", "review-efficiency"];
  if (foreignCommands.some((name) => new RegExp(`/${name}\\b`, "i").test(runtime))) failures.push("runtime guidance contains a foreign command");
  const foreignComponents = [...foreignCommands, "rtk-setup", "rtk-filter-design", "efficiency-budget", "context-compaction", "context-optimization", "efficiency-review", "efficiency-auditor", "rtk-filter-auditor", "context-change-auditor"];
  const foreignPathPattern = new RegExp(`(?:commands|skills|agents|rules)/(?:${foreignComponents.join("|")})(?:/|\\.md|\\.txt|\\.mdc|\\b)`, "i");
  if (foreignPathPattern.test(runtime)) failures.push("runtime guidance contains a foreign component path");
  validateHookSurface(rootPath, manifest, failures);
  if (manifest.mcpServers !== undefined) {
    if (manifest.mcpServers !== "mcp.json") failures.push("plugin.json mcpServers must reference mcp.json");
    const mcpPath = join(rootPath, "mcp.json");
    if (!existsSync(mcpPath)) failures.push("mcp.json is missing");
    else {
      try {
        const mcp = JSON.parse(readText(mcpPath));
        const servers = Object.entries(mcp.mcpServers ?? {});
        if (servers.length !== 1 || servers[0][0] !== "workflow") failures.push("mcp.json must declare exactly workflow");
        const definition = servers[0]?.[1];
        if (definition?.command !== "node") failures.push("Workflow MCP must use the bundled Node entrypoint");
        if (JSON.stringify(definition?.args) !== JSON.stringify(["${CURSOR_PLUGIN_ROOT}/dist/workflow-mcp.mjs"])) failures.push("Workflow MCP must use the CURSOR_PLUGIN_ROOT bundle path");
        if (JSON.stringify(mcp).includes("npx") || JSON.stringify(mcp).includes("latest")) failures.push("mcp.json must not install or resolve latest packages at runtime");
      } catch (error) { failures.push(`mcp.json is invalid JSON: ${error.message}`); }
    }
    for (const name of ["workflow-mcp.mjs", "workflow-runner.mjs", "workflow-worker.mjs"]) if (!existsSync(join(rootPath, "dist", name))) failures.push(`dist/${name} is missing`);
    if (existsSync(join(rootPath, "dist", "node_modules"))) failures.push("dist/node_modules must not vendor the external Cursor SDK runtime");
  }
  for (const name of expected.references) {
    if (!existsSync(join(rootPath, "references", `${name}.md`))) failures.push(`references/${name}.md is missing`);
  }
  for (const record of [...commands, ...agents, ...skills]) {
    for (const match of readText(record.file).matchAll(/`((?:\.\.\/)+references\/[^`]+\.md)`/g)) {
      const target = resolve(dirname(record.file), match[1]);
      if (!isWithin(rootPath, target) || !existsSync(target)) failures.push(`${record.label}: missing runtime reference ${match[1]}`);
    }
  }
  if (options.release) validateRelease(rootPath, manifest, failures);
  return [...new Set(failures.map((failure) => failure.replace(`${rootPath}${sep}`, "")))];
}

function runCli() {
  const rootArgument = process.argv.find((argument, index) => index > 1 && !argument.startsWith("--"));
  const failures = validatePlugin(rootArgument ? resolve(rootArgument) : defaultRoot, { release: process.argv.includes("--release") });
  if (failures.length > 0) {
    console.error("Plugin validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(process.argv.includes("--release") ? "Plugin release validation passed." : "Plugin validation passed.");
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
