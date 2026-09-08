#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const publicSkills = ["correct-work", "engineering-work", "explain-work", "learn-from-work", "plan-work", "review-work", "verification-work", "work-status", "workflow-doctor"];
export const hostSkills = (host) => host === "agent-plugins" ? [...publicSkills, "implement-work"].sort() : publicSkills;
export const manifestPaths = { cursor: ".cursor-plugin/plugin.json", codex: ".codex-plugin/plugin.json", "agent-plugins": "plugin.json" };
const packageDocs = ["docs/behavior-validation.md", "docs/installation.md", "docs/manual-workflow.md", "docs/release-checklist.md"];
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

export function files(directory) {
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`package source may not be a symlink: ${directory}`);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`package source may not be a symlink: ${path}`);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}

export function contentDigest(directory) {
  const digest = createHash("sha256");
  for (const path of files(directory)) digest.update(`${relative(directory, path)}\0${lstatSync(path).mode & 0o777}\0`).update(readFileSync(path));
  return digest.digest("hex");
}

export function hostInstruction(host, skill) {
  const invoke = (name) => host === "cursor" ? `/${name}` : host === "codex" ? `$${name}` : name;
  if (skill === "plan-work") {
    if (host === "codex") return "Use Codex Plan mode. Return the complete human plan inside one native <proposed_plan> block. Direct the human to check the plan and use Implement Plan. Include the closing recommendation to commission $review-work in the implementation handoff.";
    if (host === "cursor") return "Use Cursor Plan Mode and its native plan. Direct the human to check the plan and use Implement Plan. Include the closing recommendation to commission /review-work in Ask Mode in the implementation handoff.";
    return "Return the complete human plan in the task. Direct the human to check it and instruct implement-work to implement it; the implementation handoff recommends a separate review-work afterward.";
  }
  const instructions = [];
  if (host === "cursor" && ["review-work", "explain-work", "work-status", "workflow-doctor"].includes(skill)) instructions.push("Use Cursor Ask Mode for this read-only task.");
  if (["correct-work", "implement-work", "verification-work"].includes(skill)) instructions.push(`After commissioned changes, recommend ${invoke("review-work")}${host === "cursor" ? " in Ask Mode" : ""} for the human to start a separate review.`);
  if (skill === "review-work") instructions.push(`For actionable corrections, recommend ${invoke("correct-work")}${host === "cursor" ? " in Agent Mode" : ""} for the human to commission them.`);
  if (skill === "work-status") instructions.push(host === "agent-plugins"
    ? "Name the skill matching the documented next action; implementation uses implement-work."
    : `Name the matching ${host === "cursor" ? "/skill-name command" : "$skill-name skill"} for the documented next action; implementation uses Implement Plan.`);
  return instructions.join(" ");
}

function sourceManifest(root, host) {
  return host === "cursor" ? join(root, manifestPaths[host]) : join(root, "targets", host, manifestPaths[host]);
}

function buildHost(root, destination, host, version) {
  const manifest = JSON.parse(readFileSync(sourceManifest(root, host), "utf8"));
  if (manifest.name !== "geldmacher-workflow" || manifest.version !== version) throw new Error(`${host} source manifest identity/version mismatch`);
  if (manifest.hooks || manifest.mcpServers) throw new Error(`${host} manifest registers a removed runtime`);
  copyRegular(sourceManifest(root, host), join(destination, manifestPaths[host]), root);
  for (const name of ["assets", "references", ...packageDocs, "LICENSE", "THIRD_PARTY_NOTICES.md"]) copyRegular(join(root, name), join(destination, name), root);
  const readme = host === "cursor" ? join(root, "README.md") : join(root, "targets", host, "README.md");
  copyRegular(readme, join(destination, "README.md"), root);
  const readmePath = join(destination, "README.md");
  writeFileSync(readmePath, readFileSync(readmePath, "utf8").replaceAll("../../docs/", "docs/"));
  for (const skill of hostSkills(host)) {
    const source = readFileSync(join(root, "skills", skill, "SKILL.md"), "utf8");
    const instruction = hostInstruction(host, skill);
    const output = instruction ? `${source.trimEnd()}\n\n${instruction}\n` : source;
    const path = join(destination, "skills", skill, "SKILL.md");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, output);
    const references = join(root, "skills", skill, "references");
    if (existsSync(references)) copyRegular(references, join(destination, "skills", skill, "references"), root);
  }
  if (host === "cursor") copyRegular(join(root, "commands"), join(destination, "commands"), root);
  const surface = {
    schema: 1,
    runtime_paths: [manifestPaths[host], "assets", ...(host === "cursor" ? ["commands"] : []), "references", "release-surface.json", "skills"].sort(),
    package_extras: ["LICENSE", "README.md", "THIRD_PARTY_NOTICES.md", ...packageDocs].sort(),
  };
  writeFileSync(join(destination, "release-surface.json"), `${JSON.stringify(surface, null, 2)}\n`);
  files(destination);
}

export function buildPluginTargets(outputRoot = join(defaultRoot, ".build", "plugins"), root = defaultRoot) {
  const projectRoot = resolve(root);
  const destination = resolve(outputRoot);
  if (destination === projectRoot || destination === resolve(tmpdir()) || inside(destination, projectRoot)) throw new Error("target output must not replace a source directory");
  if (inside(projectRoot, destination) && !inside(join(projectRoot, ".build"), destination)) throw new Error("repository output must be under .build");
  if (!inside(projectRoot, destination) && !inside(tmpdir(), destination)) throw new Error("target output must be under the repository or temporary directory");
  const boundary = inside(projectRoot, destination) ? projectRoot : resolve(tmpdir());
  for (let path = destination; path !== boundary && path !== dirname(path); path = dirname(path)) {
    try { if (lstatSync(path).isSymbolicLink()) throw new Error(`target output may not traverse a symlink: ${path}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (existsSync(destination) && readdirSync(destination).some((name) => !Object.keys(manifestPaths).includes(name))) throw new Error("target output contains unrelated files");
  for (const directory of ["skills", "commands", "references", "docs", "assets", "targets"]) files(join(projectRoot, directory));
  const version = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")).version;
  for (const host of Object.keys(manifestPaths)) {
    const manifest = JSON.parse(readFileSync(sourceManifest(projectRoot, host), "utf8"));
    if (manifest.name !== "geldmacher-workflow" || manifest.version !== version || manifest.hooks || manifest.mcpServers) throw new Error(`${host} source manifest identity/version or registration mismatch`);
  }
  if (existsSync(destination)) rmSync(destination, { recursive: true });
  const result = { version };
  for (const host of Object.keys(manifestPaths)) {
    const path = join(destination, host, "geldmacher-workflow");
    buildHost(projectRoot, path, host, version);
    result[host] = { path, hash: contentDigest(path), files: files(path).length };
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const output = check ? mkdtempSync(join(tmpdir(), "workflow-target-check-")) : join(defaultRoot, ".build", "plugins");
  try { console.log(JSON.stringify(buildPluginTargets(output), null, 2)); }
  finally { if (check) rmSync(output, { recursive: true, force: true }); }
}
