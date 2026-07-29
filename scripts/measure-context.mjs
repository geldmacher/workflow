#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./validate-plugin.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = dirname(scriptDirectory);
export const measurementVersion = 2;
export const baselinePath = "scripts/context-baseline.json";
export const limits = Object.freeze({
  alwaysOnTokens: 0,
  discoverabilityTokens: 500,
  phaseFlows: Object.freeze({
    plan_intake: 2000,
    plan_oneshot: 2000,
    plan_compact_full: 2400,
    review_base: 2000,
    review_correction: 2500,
    correction: 2000,
    learning: 2000,
    explanation: 1200,
  }),
  automationFlows: Object.freeze({
    prepare_or_approve: 1500,
    status: 1500,
    watch: 1500,
    control: 1500,
    models: 1500,
  }),
  reviewerTokens: 650,
});
export const economicTargets = Object.freeze({ plan: 2000, correction: 2000, review: 2000, learning: 2000, explanation: 1200, automation: 1500 });

export const flowMatrix = Object.freeze({
  phase_flows: Object.freeze({
    plan_intake: Object.freeze(["commands/plan-work.md", "skills/work-planning/SKILL.md"]),
    plan_oneshot: Object.freeze(["commands/plan-work.md", "skills/work-planning/SKILL.md", "references/executable-contract.md", "references/plan-container-contract.md"]),
    plan_compact_full: Object.freeze(["commands/plan-work.md", "skills/work-planning/SKILL.md", "references/executable-contract.md", "references/plan-container-contract.md", "references/design-contract.md"]),
    review_base: Object.freeze(["commands/review-work.md", "skills/work-review/SKILL.md", "references/artifact-protocol.md", "references/delivery-evidence-contract.md", "references/review-contract.md"]),
    review_correction: Object.freeze(["commands/review-work.md", "skills/work-review/SKILL.md", "references/artifact-protocol.md", "references/delivery-evidence-contract.md", "references/review-contract.md", "references/correction-contract.md"]),
    correction: Object.freeze(["commands/correct-work.md", "skills/work-execution/SKILL.md", "references/artifact-protocol.md", "references/correction-contract.md", "references/delivery-evidence-contract.md", "references/delivery-evidence-output-contract.md"]),
    learning: Object.freeze(["commands/learn-from-work.md", "skills/work-learning/SKILL.md", "references/artifact-protocol.md", "references/learning-contract.md"]),
    explanation: Object.freeze(["commands/explain-work.md", "skills/work-explanation/SKILL.md", "references/state-contract.md", "references/explanation-contract.md"]),
  }),
  automation_flows: Object.freeze({
    prepare_or_approve: Object.freeze(["commands/auto-work.md", "skills/work-automation/SKILL.md", "references/automation-preparation-contract.md"]),
    status: Object.freeze(["commands/work-status.md", "skills/work-automation/SKILL.md", "references/state-contract.md"]),
    watch: Object.freeze(["commands/work-watch.md", "skills/work-automation/SKILL.md", "references/state-contract.md"]),
    control: Object.freeze(["commands/work-control.md", "skills/work-automation/SKILL.md", "references/state-contract.md", "references/automation-contract.md"]),
    models: Object.freeze(["commands/work-models.md", "skills/work-automation/SKILL.md", "references/model-routing-contract.md"]),
  }),
});

const estimate = (characters) => Math.ceil(characters / 4);
const read = (root, file) => readFileSync(join(root, file), "utf8");
const flowMatrixHash = createHash("sha256").update(JSON.stringify(flowMatrix)).digest("hex");

function localMarkdownLinks(root, file) {
  const links = [];
  for (const match of read(root, file).matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "").split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:|data:)/i.test(target)) continue;
    const resolved = resolve(root, dirname(file), decodeURIComponent(target));
    const path = relative(root, resolved);
    if (path === ".." || path.startsWith(`..${sep}`)) continue;
    links.push(path.split(sep).join("/"));
  }
  return [...new Set(links)];
}

export function validateFlowMatrix(root = defaultRoot, matrix = flowMatrix) {
  const rootPath = resolve(root);
  const failures = [];
  const commandSkillPairs = new Set();
  const skillReferencePairs = new Set();
  const commands = new Set();
  const skills = new Set();

  for (const [familyName, family] of Object.entries(matrix)) {
    for (const [flowName, files] of Object.entries(family)) {
      const label = `${familyName}.${flowName}`;
      const uniqueFiles = new Set(files);
      if (uniqueFiles.size !== files.length) failures.push(`${label}: duplicate file entry`);
      for (const file of uniqueFiles) if (!existsSync(join(rootPath, file))) failures.push(`${label}: missing file ${file}`);

      const flowCommands = [...uniqueFiles].filter((file) => file.startsWith("commands/"));
      const flowSkills = [...uniqueFiles].filter((file) => file.startsWith("skills/"));
      if (flowCommands.length !== 1) failures.push(`${label}: expected exactly one Command, found ${flowCommands.length}`);
      if (flowSkills.length !== 1) failures.push(`${label}: expected exactly one Skill, found ${flowSkills.length}`);
      if (flowCommands.length !== 1 || flowSkills.length !== 1) continue;

      const [command] = flowCommands;
      const [skill] = flowSkills;
      commands.add(command);
      skills.add(skill);
      commandSkillPairs.add(`${command}\0${skill}`);
      if (existsSync(join(rootPath, command))) {
        const linkedSkills = localMarkdownLinks(rootPath, command).filter((file) => file.startsWith("skills/"));
        if (!linkedSkills.includes(skill)) failures.push(`${label}: ${command} does not link ${skill}`);
      }

      const measuredReferences = [...uniqueFiles].filter((file) => file.startsWith("references/"));
      if (existsSync(join(rootPath, skill))) {
        const linkedReferences = localMarkdownLinks(rootPath, skill).filter((file) => file.startsWith("references/"));
        for (const reference of measuredReferences) {
          skillReferencePairs.add(`${skill}\0${reference}`);
          if (!linkedReferences.includes(reference)) failures.push(`${label}: ${reference} is not linked from ${skill}`);
        }
      }
    }
  }

  for (const command of commands) {
    if (!existsSync(join(rootPath, command))) continue;
    for (const skill of localMarkdownLinks(rootPath, command).filter((file) => file.startsWith("skills/"))) {
      if (!commandSkillPairs.has(`${command}\0${skill}`)) failures.push(`${command}: linked Skill ${skill} is not measured in a flow containing the Command`);
    }
  }
  for (const skill of skills) {
    if (!existsSync(join(rootPath, skill))) continue;
    for (const reference of localMarkdownLinks(rootPath, skill).filter((file) => file.startsWith("references/"))) {
      if (!skillReferencePairs.has(`${skill}\0${reference}`)) failures.push(`${skill}: linked contract ${reference} is not measured in a flow containing the Skill`);
    }
  }
  return failures;
}

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

function measureFlow(root, files) {
  const breakdown = {};
  for (const file of new Set(files)) breakdown[file] = estimate(read(root, file).length);
  return { tokens: Object.values(breakdown).reduce((sum, tokens) => sum + tokens, 0), breakdown };
}

function compareMap(current, baseline, label) {
  const regressions = [];
  for (const [name, value] of Object.entries(current)) {
    if (!Object.hasOwn(baseline ?? {}, name)) regressions.push(`${label}.${name}: missing baseline`);
    else if (value > baseline[name]) regressions.push(`${label}.${name}: ${value} > baseline ${baseline[name]}`);
  }
  return regressions;
}

export function baselineFromMeasurement(measurement) {
  return {
    measurement_version: measurement.measurement_version,
    flow_matrix_hash: measurement.flow_matrix_hash,
    always_on_tokens: measurement.alwaysOnTokens,
    discoverability_tokens: measurement.discoverabilityTokens,
    phase_flows: measurement.phase_flows,
    automation_flows: measurement.automationFlows,
    reviewer_tokens: measurement.reviewerTokens,
  };
}

export function evaluateRatchet(measurement, baseline) {
  if (!baseline) return { status: "missing", baseline_path: baselinePath, regressions: [`${baselinePath}: missing baseline`] };
  const regressions = [];
  if (baseline.measurement_version !== measurement.measurement_version) regressions.push(`measurement_version: ${measurement.measurement_version} != baseline ${baseline.measurement_version}`);
  if (baseline.flow_matrix_hash !== measurement.flow_matrix_hash) regressions.push("flow_matrix_hash: measurement and baseline differ");
  if (measurement.alwaysOnTokens > baseline.always_on_tokens) regressions.push(`alwaysOnTokens: ${measurement.alwaysOnTokens} > baseline ${baseline.always_on_tokens}`);
  if (measurement.discoverabilityTokens > baseline.discoverability_tokens) regressions.push(`discoverabilityTokens: ${measurement.discoverabilityTokens} > baseline ${baseline.discoverability_tokens}`);
  regressions.push(...compareMap(measurement.phase_flows, baseline.phase_flows, "phase_flows"));
  regressions.push(...compareMap(measurement.automationFlows, baseline.automation_flows, "automation_flows"));
  regressions.push(...compareMap(measurement.reviewerTokens, baseline.reviewer_tokens, "reviewer_tokens"));
  return { status: regressions.length === 0 ? "passed" : "regressed", baseline_path: baselinePath, regressions };
}

export function measureContext(root = defaultRoot) {
  const rootPath = resolve(root);
  const loadGraphFailures = validateFlowMatrix(rootPath);
  if (loadGraphFailures.length > 0) throw new Error(`Invalid context load graph:\n${loadGraphFailures.join("\n")}`);
  const failures = [];
  let alwaysOnCharacters = 0;
  const discoverabilityCharactersByType = { commands: 0, skills: 0, agents: 0 };
  for (const file of list(join(rootPath, "rules"), (path) => [".md", ".mdc"].includes(extname(path)))) {
    if (parseFrontmatter(file, failures).alwaysApply === true) alwaysOnCharacters += readFileSync(file, "utf8").length;
  }
  for (const file of list(join(rootPath, "skills"), (path) => basename(path) === "SKILL.md")) {
    const fields = parseFrontmatter(file, failures);
    discoverabilityCharactersByType.skills += `${fields.name ?? ""}\n${fields.description ?? ""}`.length;
  }
  for (const file of list(join(rootPath, "commands"), (path) => [".md", ".txt"].includes(extname(path)))) {
    const fields = parseFrontmatter(file, failures);
    discoverabilityCharactersByType.commands += `/${basename(file, extname(file))}\n${fields.description ?? ""}`.length;
  }
  const reviewerTokens = {};
  for (const file of list(join(rootPath, "agents"), (path) => extname(path) === ".md")) {
    const fields = parseFrontmatter(file, failures);
    discoverabilityCharactersByType.agents += `${fields.name ?? ""}\n${fields.description ?? ""}`.length;
    reviewerTokens[basename(file, ".md")] = estimate(readFileSync(file, "utf8").length);
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));

  const phase = Object.fromEntries(Object.entries(flowMatrix.phase_flows).map(([name, files]) => [name, measureFlow(rootPath, files)]));
  const automation = Object.fromEntries(Object.entries(flowMatrix.automation_flows).map(([name, files]) => [name, measureFlow(rootPath, files)]));
  const phaseFlows = Object.fromEntries(Object.entries(phase).map(([name, value]) => [name, value.tokens]));
  const automationFlows = Object.fromEntries(Object.entries(automation).map(([name, value]) => [name, value.tokens]));
  const flowBreakdown = Object.fromEntries([...Object.entries(phase), ...Object.entries(automation)].map(([name, value]) => [name, value.breakdown]));
  const alwaysOnTokens = estimate(alwaysOnCharacters);
  const discoverabilityCharacters = Object.values(discoverabilityCharactersByType).reduce((sum, value) => sum + value, 0);
  const discoverabilityTokens = estimate(discoverabilityCharacters);
  const measurement = {
    method: "estimated tokens: characters / 4 per file, rounded up; model tokenizer may differ",
    measurement_version: measurementVersion,
    flow_matrix_hash: flowMatrixHash,
    alwaysOnTokens,
    discoverabilityTokens,
    discoverabilityTokensByType: Object.fromEntries(Object.entries(discoverabilityCharactersByType).map(([name, characters]) => [name, estimate(characters)])),
    totalTokens: alwaysOnTokens + discoverabilityTokens,
    phase_flows: phaseFlows,
    flow_breakdown: flowBreakdown,
    flows: {
      plan: phaseFlows.plan_oneshot,
      correction: phaseFlows.correction,
      review: phaseFlows.review_base,
      learning: phaseFlows.learning,
      explanation: phaseFlows.explanation,
      automation: Math.max(...Object.values(automationFlows)),
    },
    expandedFlows: { plan_compact_full: phaseFlows.plan_compact_full, review_correction: phaseFlows.review_correction },
    automationFlows,
    reviewerTokens,
    limits,
    economicTargets,
  };
  let baseline = null;
  if (existsSync(join(rootPath, baselinePath))) baseline = JSON.parse(read(rootPath, baselinePath));
  return { ...measurement, ratchet_status: evaluateRatchet(measurement, baseline) };
}

export function targetFailures(measurement) {
  const failures = [];
  if (measurement.alwaysOnTokens > limits.alwaysOnTokens) failures.push(`alwaysOnTokens: ${measurement.alwaysOnTokens} > ${limits.alwaysOnTokens}`);
  if (measurement.discoverabilityTokens > limits.discoverabilityTokens) failures.push(`discoverabilityTokens: ${measurement.discoverabilityTokens} > ${limits.discoverabilityTokens}`);
  for (const [name, maximum] of Object.entries(limits.phaseFlows)) if (measurement.phase_flows[name] > maximum) failures.push(`phase_flows.${name}: ${measurement.phase_flows[name]} > ${maximum}`);
  for (const [name, maximum] of Object.entries(limits.automationFlows)) if (measurement.automationFlows[name] > maximum) failures.push(`automation_flows.${name}: ${measurement.automationFlows[name]} > ${maximum}`);
  for (const [name, value] of Object.entries(measurement.reviewerTokens)) if (value > limits.reviewerTokens) failures.push(`reviewer_tokens.${name}: ${value} > ${limits.reviewerTokens}`);
  return failures;
}

export function budgetFailures(measurement) {
  return [...targetFailures(measurement), ...measurement.ratchet_status.regressions];
}

export function budgetDiagnostics(measurement) {
  return Object.entries(economicTargets)
    .filter(([name, target]) => measurement.flows[name] > target)
    .map(([name, target]) => `${name} economic target: ${measurement.flows[name]} > ${target}`);
}

function runCli() {
  const measurement = measureContext(defaultRoot);
  if (process.argv.includes("--update-baseline")) {
    const failures = targetFailures(measurement);
    if (failures.length > 0) {
      for (const failure of failures) console.error(`Context target exceeded: ${failure}`);
      process.exitCode = 1;
      return;
    }
    writeFileSync(join(defaultRoot, baselinePath), `${JSON.stringify(baselineFromMeasurement(measurement), null, 2)}\n`);
    console.log(`Updated ${baselinePath}.`);
    return;
  }
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
