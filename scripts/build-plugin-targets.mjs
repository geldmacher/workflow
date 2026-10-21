#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

export const defaultRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const publicSkills = ["auto-work", "correct-work", "engineering-work", "explain-work", "implement-work", "install-release", "learn-from-work", "maintain-workflow", "plan-work", "review-work", "setup-workflow", "verification-work", "work-status", "workflow-doctor"];
export const hostSkills = () => publicSkills;
// OpenCode 2.1.2 (npm @opencode/cli). opencode-ai latest remains the 1.x line and is not a target.
export const OPENCODE_COMPATIBILITY = "2.1.2";
export const manifestPaths = { cursor: ".cursor-plugin/plugin.json", codex: ".codex-plugin/plugin.json", "agent-plugins": "plugin.json", opencode: ".opencode-plugin/plugin.json" };
export function openCodeCommand(name, description) {
  return `---\ndescription: ${JSON.stringify(description)}\n---\n\nLoad the \`${name}\` skill and apply it to the current request.\n\n$ARGUMENTS\n`;
}
const packageDocs = ["docs/auto-work.md", "docs/project-improvement.md", "docs/behavior-validation.md", "docs/installation.md", "docs/manual-workflow.md", "docs/release-checklist.md"];
function inside(base, path) {
  const item = relative(base, path);
  return item === "" || (item !== ".." && !item.startsWith(`..${sep}`));
}

export function files(directory) {
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`package source may not be a symlink: ${directory}`);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`package source may not be a symlink: ${path}`);
    if (entry.isDirectory()) return files(path);
    if (!entry.isFile()) throw new Error(`package source must be a regular file: ${path}`);
    return [path];
  }).sort();
}

export function contentDigest(directory) {
  const digest = createHash("sha256");
  for (const path of files(directory)) digest.update(`${relative(directory, path)}\0${lstatSync(path).mode & 0o777}\0`).update(readFileSync(path));
  return digest.digest("hex");
}

export function hostInstruction(host, skill) {
  const invoke = (name) => host === "cursor" ? `/${name}` : host === "codex" ? `$${name}` : host === "opencode" ? `@${name}` : name;
  if (skill === "auto-work") return `${host === "cursor" ? "Read [Cursor delegation](references/cursor.md). Use Agent Mode; standalone Ask Mode does not govern delegated Review." : host === "codex" ? "Read [Codex delegation](references/codex.md). If read-only Plan mode prevents implementation, hand off the authorized sequence to native implementation." : host === "opencode" ? "Read [OpenCode delegation](references/opencode.md). Keep phase delegation on the primary session unless subagent depth allows nesting." : "Use only the client's actual delegation schema and supported settings."} Do not require manual mode switches for internal phases.`;
  if (skill === "plan-work") {
    if (host === "codex") return "For standalone planning, stay read-only. When Codex Plan mode is active or the host requires it, return the complete plan inside one native <proposed_plan> block. Do not request a mode switch only to satisfy that format. Never bypass an actual host read-only mode. Direct the human to check the plan and use Implement Plan, then commission $review-work. When Plan mode is not used, $implement-work applies a supplied plan artefact. Within expressly commissioned Auto-Work, apply its Light or Dark plan approval rules.";
    if (host === "cursor") return "For standalone planning, stay read-only and use the native Cursor plan when Plan Mode is active or the host requires it. Do not request a mode switch only to satisfy formatting. Never bypass an actual host read-only mode. Direct the human to check it and use Implement Plan, then commission /review-work in Ask Mode. When Plan mode is not used, /implement-work applies a supplied plan artefact. Within expressly commissioned Auto-Work, use its plan approval rules and native execution without requesting a manual phase-mode switch.";
    if (host === "opencode") return "For standalone planning, stay read-only. When the OpenCode plan agent is active, return the complete plan in the task. Do not request a mode switch only to satisfy formatting. Never bypass an actual host read-only mode. Direct the human to check the plan, then continue in the build agent with @implement-work and that plan artefact, and commission @review-work. /implement-work sends the same request. Within expressly commissioned Auto-Work, apply its Light or Dark plan approval rules.";
    return "Return the complete human plan in the task. In standalone work, direct the human to check it and instruct implement-work, then commission review-work. Within expressly commissioned Auto-Work, apply its Light or Dark plan approval rules.";
  }
  const instructions = [];
  if (host === "cursor" && ["review-work", "explain-work", "work-status", "workflow-doctor"].includes(skill)) instructions.push("Stay read-only. Use Cursor Ask Mode when active or required; do not switch only for format. Delegated Auto-Work review needs no mode switch.");
  if (host === "opencode" && ["review-work", "explain-work", "work-status", "workflow-doctor"].includes(skill)) instructions.push("Stay read-only. Use the OpenCode plan agent when it is active or required; do not switch only for format. Delegated Auto-Work review needs no mode switch.");
  if (skill === "implement-work" && (host === "cursor" || host === "codex")) instructions.push("Do not load this skill because Implement Plan is available or was used. Use it for an explicit invocation or a plan artefact handed off without that action.");
  if (skill === "implement-work" && host === "opencode") instructions.push("Apply the supplied plan artefact in the build agent. Planning stays with the plan agent or plan-work.");
  if (["correct-work", "implement-work", "verification-work", "setup-workflow", "maintain-workflow"].includes(skill)) instructions.push(`After standalone commissioned changes, recommend ${invoke("review-work")}${host === "cursor" ? " in Ask Mode" : ""} for the human to start a separate review. Within Auto-Work, return the report to its independent review step.`);
  if (skill === "review-work") instructions.push(`For standalone actionable corrections, recommend ${invoke("correct-work")}${host === "cursor" ? " in Agent Mode" : ""} for the human to commission them. A delegated Auto-Work review returns findings to the existing assignment.`);
  if (skill === "review-work") instructions.push(`For eligible lessons, offer ${invoke("learn-from-work")}${host === "cursor" ? " in Agent Mode" : ""} as optional learning.`);
  if (skill === "work-status") instructions.push(host === "agent-plugins"
    ? "Name the skill matching the documented next action; implementation uses implement-work."
    : host === "opencode"
      ? "For Auto-Work, name its mode, remaining acceptance and next actor. Otherwise name the matching @skill-id skill for the documented next action; implementation uses @implement-work in the build agent."
      : `For Auto-Work, name its mode, remaining acceptance and next actor. Otherwise name the matching ${host === "cursor" ? "/skill-name command" : "$skill-name skill"} for the documented next action; implementation uses Implement Plan, or ${invoke("implement-work")} when Plan mode is not used.`);
  return instructions.join(" ");
}

function sourceManifest(root, host) {
  return host === "cursor" ? join(root, manifestPaths[host]) : join(root, "targets", host, manifestPaths[host]);
}

// One source-to-target inventory drives copying and exact target validation.
export function packageEntries(root, host) {
  if (!Object.hasOwn(manifestPaths, host)) throw new Error(`unsupported host: ${host}`);
  const entries = [];
  const add = (source, target = source, kind = "copy", include = () => true) => {
    const absolute = join(root, source);
    if (lstatSync(absolute).isDirectory()) {
      for (const path of files(absolute)) {
        if (!include(path)) continue;
        entries.push({ source: path, target: join(target, relative(absolute, path)), kind });
      }
    } else if (include(absolute)) entries.push({ source: absolute, target, kind });
  };
  add(relative(root, sourceManifest(root, host)), manifestPaths[host]);
  for (const name of ["assets/logo.svg", "references", ...packageDocs, "LICENSE", "THIRD_PARTY_NOTICES.md"]) add(name);
  add(host === "cursor" ? "README.md" : `targets/${host}/README.md`, "README.md", "readme");
  for (const name of hostSkills(host)) {
    add(`skills/${name}/SKILL.md`, `skills/${name}/SKILL.md`, "skill");
    const references = `skills/${name}/references`;
    if (existsSync(join(root, references))) add(references, references, "copy", (path) => host === "opencode" || relative(join(root, references), path) !== "opencode.md");
    if (host === "cursor") add(`commands/${name}.md`, `commands/${name}.md`, "command");
    if (host === "opencode") entries.push({ source: join(root, "skills", name, "SKILL.md"), target: `commands/${name}.md`, kind: "opencode-command" });
  }
  return entries.sort((a, b) => a.target.localeCompare(b.target));
}

function prepareHost(root, host) {
  return packageEntries(root, host).map(entry => {
    const stat = lstatSync(entry.source);
    if (stat.isSymbolicLink()) throw new Error(`target source may not be a symlink: ${relative(root, entry.source)}`);
    if (!stat.isFile()) throw new Error(`target source must be a regular file: ${relative(root, entry.source)}`);
    let content = readFileSync(entry.source, entry.kind === "copy" ? null : "utf8");
    if (entry.kind === "readme") content = content.replaceAll("../../docs/", "docs/").replaceAll("../../skills/", "skills/");
    if (entry.kind === "skill") {
      const instruction = hostInstruction(host, entry.target.split(sep)[1]);
      if (instruction) content = `${content.trimEnd()}\n\n${instruction}\n`;
    }
    if (entry.kind === "command" || entry.kind === "opencode-command") {
      const name = entry.target.split(sep).at(-1).slice(0, -3);
      const source = readFileSync(join(root, "skills", name, "SKILL.md"), "utf8");
      const document = parseDocument(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "");
      const description = document.toJS()?.description;
      if (document.errors.length || typeof description !== "string") throw new Error(`invalid skill metadata: ${name}`);
      content = entry.kind === "opencode-command"
        ? openCodeCommand(name, description)
        : content.replace(/^description:.*$/m, () => `description: ${JSON.stringify(description)}`);
    }
    return { target: entry.target, content, mode: stat.mode & 0o777 };
  });
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
  // Finish source reads and transformations for every host before replacing prior output.
  const prepared = Object.fromEntries(Object.keys(manifestPaths).map(host => [host, prepareHost(projectRoot, host)]));
  if (existsSync(destination)) rmSync(destination, { recursive: true });
  const result = { version };
  for (const host of Object.keys(manifestPaths)) {
    const path = join(destination, host, "geldmacher-workflow");
    for (const entry of prepared[host]) {
      const target = join(path, entry.target);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.content, { mode: entry.mode });
      chmodSync(target, entry.mode);
    }
    result[host] = { path, hash: contentDigest(path), files: files(path).length };
  }
  return result;
}

async function runCli() {
  const check = process.argv.includes("--check");
  const output = check ? mkdtempSync(join(tmpdir(), "workflow-target-check-")) : join(defaultRoot, ".build", "plugins");
  try {
    const built = buildPluginTargets(output);
    const { validateTarget } = await import("./validate-plugin.mjs");
    const failures = Object.keys(manifestPaths).flatMap(host => validateTarget(built[host].path, host, built.version));
    if (failures.length) throw new Error(failures.join("\n"));
    console.log(JSON.stringify(built, null, 2));
  }
  finally { if (check) rmSync(output, { recursive: true, force: true }); }
}

if (process.argv[1] && process.argv[1] !== "-" && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) runCli().catch(error => { console.error(error.message); process.exitCode = 1; });
