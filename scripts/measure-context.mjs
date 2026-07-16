#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./validate-plugin.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = dirname(scriptDirectory);
export const limits = Object.freeze({
  alwaysOnTokens: 0,
  discoverabilityTokens: 250,
  totalTokens: 300,
  flowTokens: 2200,
  reviewerTokens: 650,
});
export const economicTargets = Object.freeze({ plan: 2000, correction: 2000, review: 2000, learning: 2000 });
const estimate = (characters) => Math.ceil(characters / 4);
const read = (root, file) => readFileSync(join(root, file), "utf8");

function list(directory, predicate) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...list(path, predicate));
    else if (entry.isFile() && predicate(path)) files.push(path);
  }
  return files.sort();
}

export function measureContext(root = defaultRoot) {
  const rootPath = resolve(root);
  const failures = [];
  let alwaysOnCharacters = 0;
  const discoverabilityCharactersByType = {
    commands: 0,
    skills: 0,
    agents: 0,
  };
  for (const file of list(join(rootPath, "rules"), (path) => [".md", ".mdc"].includes(extname(path)))) {
    if (parseFrontmatter(file, failures).alwaysApply === true) alwaysOnCharacters += readFileSync(file, "utf8").length;
  }
  for (const file of list(join(rootPath, "skills"), (path) => basename(path) === "SKILL.md")) {
    const fields = parseFrontmatter(file, failures);
    discoverabilityCharactersByType.skills += `${fields.name ?? ""}\n${fields.description ?? ""}`.length;
  }
  for (const file of list(join(rootPath, "commands"), (path) => [".md", ".txt"].includes(extname(path)))) {
    const fields = parseFrontmatter(file, failures);
    const commandName = basename(file, extname(file));
    discoverabilityCharactersByType.commands += `/${commandName}\n${fields.description ?? ""}`.length;
  }
  const reviewerTokens = {};
  for (const file of list(join(rootPath, "agents"), (path) => extname(path) === ".md")) {
    const fields = parseFrontmatter(file, failures);
    discoverabilityCharactersByType.agents += `${fields.name ?? ""}\n${fields.description ?? ""}`.length;
    const name = basename(file, ".md");
    reviewerTokens[name] = estimate(readFileSync(file, "utf8").length);
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
  const references = {
    core: read(rootPath, "references/artifact-protocol.md"),
    container: read(rootPath, "references/plan-container-contract.md"),
    executable: read(rootPath, "references/executable-contract.md"),
    evidence: read(rootPath, "references/delivery-evidence-contract.md"),
    evidenceOutput: read(rootPath, "references/delivery-evidence-output-contract.md"),
    correction: read(rootPath, "references/correction-contract.md"),
    review: read(rootPath, "references/review-contract.md"),
    learning: read(rootPath, "references/learning-contract.md"),
  };
  const flow = (command, skill, activeReferences) => estimate(
    read(rootPath, `commands/${command}.md`).length
      + read(rootPath, `skills/${skill}/SKILL.md`).length
      + activeReferences.map((name) => references[name].length).reduce((sum, length) => sum + length, 0),
  );
  const alwaysOnTokens = estimate(alwaysOnCharacters);
  const discoverabilityCharacters = Object.values(discoverabilityCharactersByType).reduce((sum, value) => sum + value, 0);
  const discoverabilityTokens = estimate(discoverabilityCharacters);
  return {
    method: "estimated tokens: characters / 4, rounded up; model tokenizer may differ",
    alwaysOnTokens,
    discoverabilityTokens,
    discoverabilityTokensByType: Object.fromEntries(
      Object.entries(discoverabilityCharactersByType).map(([name, characters]) => [name, estimate(characters)]),
    ),
    totalTokens: alwaysOnTokens + discoverabilityTokens,
    flows: {
      plan: flow("plan-work", "work-planning", ["core", "container", "executable"]),
      correction: flow("correct-work", "work-execution", ["core", "correction", "evidence", "evidenceOutput"]),
      review: flow("review-work", "work-review", ["evidence", "review"]),
      learning: flow("learn-from-work", "work-learning", ["core", "learning"]),
    },
    reviewerTokens,
    limits,
    economicTargets,
  };
}

export function budgetFailures(measurement) {
  void measurement;
  return [];
}

export function budgetDiagnostics(measurement) {
  const diagnostics = Object.entries(economicTargets)
    .filter(([name, target]) => measurement.flows[name] > target)
    .map(([name, target]) => `${name} economic target: ${measurement.flows[name]} > ${target}`);
  if (measurement.alwaysOnTokens > limits.alwaysOnTokens) diagnostics.push(`alwaysOnTokens: ${measurement.alwaysOnTokens} > ${limits.alwaysOnTokens}`);
  if (measurement.discoverabilityTokens > limits.discoverabilityTokens) diagnostics.push(`discoverabilityTokens: ${measurement.discoverabilityTokens} > ${limits.discoverabilityTokens}`);
  if (measurement.totalTokens > limits.totalTokens) diagnostics.push(`totalTokens: ${measurement.totalTokens} > ${limits.totalTokens}`);
  for (const [name, value] of Object.entries(measurement.flows)) if (value > limits.flowTokens) diagnostics.push(`${name}: ${value} > ${limits.flowTokens}`);
  for (const [name, value] of Object.entries(measurement.reviewerTokens)) if (value > limits.reviewerTokens) diagnostics.push(`${name}: ${value} > ${limits.reviewerTokens}`);
  return [...new Set(diagnostics)];
}

function runCli() {
  const measurement = measureContext(defaultRoot);
  console.log(JSON.stringify(measurement, null, 2));
  if (process.argv.includes("--check")) {
    for (const failure of budgetFailures(measurement)) {
      console.error(`Context budget exceeded: ${failure}`);
      process.exitCode = 1;
    }
    for (const diagnostic of budgetDiagnostics(measurement)) console.error(`Context budget diagnostic: ${diagnostic}`);
  }
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
