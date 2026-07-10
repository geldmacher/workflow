import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packetSections = [
  "Handoff metadata",
  "Intent and acceptance criteria",
  "Scope boundaries and non-goals",
  "Repository evidence",
  "Target files and symbols",
  "Reference patterns",
  "Executable agent plan",
  "Verification matrix",
  "Risk and deviation policy",
  "Escalate instead of guessing when",
  "Delivery evidence requirements",
  "Open questions",
];

const packetSources = [
  "rules/handoff-quality.mdc",
  "skills/handoff-plan-compiler/SKILL.md",
  "skills/delivery-review/SKILL.md",
  "agents/delivery-reviewer.md",
  "README.md",
];

const expectedFiles = [
  ".cursor-plugin/plugin.json",
  "assets/logo.svg",
  "commands/compile-handoff.md",
  "commands/execute-handoff.md",
  "commands/review-delivery.md",
  "rules/handoff-quality.mdc",
  "skills/handoff-plan-compiler/SKILL.md",
  "skills/handoff-executor/SKILL.md",
  "skills/delivery-review/SKILL.md",
  "agents/handoff-readiness-reviewer.md",
  "agents/delivery-reviewer.md",
  "README.md",
];

const errors = [];
const absolute = (file) => resolve(root, file);
const read = (file) => readFileSync(absolute(file), "utf8");
const report = (message) => errors.push(message);

for (const file of expectedFiles) {
  if (!existsSync(absolute(file))) report(`Missing required file: ${file}`);
}

if (errors.length === 0) {
  let manifest;
  try {
    manifest = JSON.parse(read(".cursor-plugin/plugin.json"));
  } catch (error) {
    report(`Invalid plugin manifest JSON: ${error.message}`);
  }

  if (manifest) {
    for (const key of ["name", "displayName", "description", "version", "author", "license", "logo"]) {
      if (!(key in manifest)) report(`Plugin manifest is missing '${key}'.`);
    }
    if (typeof manifest.logo === "string" && !existsSync(absolute(manifest.logo))) {
      report(`Plugin logo does not exist: ${manifest.logo}`);
    }
  }
}

function frontmatter(file) {
  const content = read(file);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    report(`Missing frontmatter: ${file}`);
    return "";
  }
  return match[1];
}

for (const file of [
  "commands/compile-handoff.md",
  "commands/execute-handoff.md",
  "commands/review-delivery.md",
  "skills/handoff-plan-compiler/SKILL.md",
  "skills/handoff-executor/SKILL.md",
  "skills/delivery-review/SKILL.md",
]) {
  const header = frontmatter(file);
  for (const key of ["name:", "description:"]) {
    if (!header.includes(key)) report(`Frontmatter in ${file} is missing '${key}'.`);
  }
}

for (const file of ["agents/handoff-readiness-reviewer.md", "agents/delivery-reviewer.md"]) {
  const header = frontmatter(file);
  for (const key of ["name:", "description:", "model: inherit", "readonly: true"]) {
    if (!header.includes(key)) report(`Frontmatter in ${file} is missing '${key}'.`);
  }
}

const ruleHeader = frontmatter("rules/handoff-quality.mdc");
for (const key of ["description:", "alwaysApply:"]) {
  if (!ruleHeader.includes(key)) report(`Frontmatter in rules/handoff-quality.mdc is missing '${key}'.`);
}

function extractPacketSections(file) {
  const content = read(file);
  const start = content.indexOf("1. `Handoff metadata`");
  if (start === -1) {
    report(`Canonical packet is missing from ${file}.`);
    return [];
  }
  const entries = [...content.slice(start).matchAll(/^\d+\. `([^`]+)`$/gm)]
    .slice(0, packetSections.length)
    .map((match) => match[1]);
  if (entries.length !== packetSections.length) {
    report(`Canonical packet in ${file} has ${entries.length} sections; expected ${packetSections.length}.`);
  }
  return entries;
}

for (const file of packetSources) {
  const actual = extractPacketSections(file);
  if (actual.join("\n") !== packetSections.join("\n")) {
    report(`Canonical packet section order differs in ${file}.`);
  }
}

for (const file of expectedFiles.filter((file) => file.endsWith(".md") || file.endsWith(".mdc"))) {
  if (read(file).includes("when possible")) {
    report(`Replace non-deterministic verification wording in ${file}.`);
  }
}

if (errors.length > 0) {
  console.error("Plugin validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Plugin validation passed.");
}
