#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRoot, parseFrontmatter } from "./validate-plugin.mjs";
import { hostSkills, hostInstruction, publicSkills } from "./build-plugin-targets.mjs";

const estimate = (text) => Math.ceil(text.length / 4);
export const limits = { discoverability: 428, plan: 2000, review: 2150, correction: 2000, learning: 2000, explanation: 1200, status: 1500 };
const flows = { plan: "plan-work", review: "review-work", correction: "correct-work", learning: "learn-from-work", explanation: "explain-work", status: "work-status" };
const agreement = "references/workflow.md";
const verification = "references/verification-work.md";
const verificationSkill = "skills/verification-work/SKILL.md";
const creation = "skills/verification-work/references/create.md";
const maintenance = "skills/verification-work/references/maintain.md";
const playbookDirectory = "skills/engineering-work/references";
const catalogPath = `${playbookDirectory}/catalog.md`;

export function measureContext(root = defaultRoot) {
  const baseline = JSON.parse(readFileSync(join(root, "scripts/context-baseline.json"), "utf8"));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const targets = {};
  for (const host of ["cursor", "codex", "agent-plugins"]) {
    const measure = (paths) => {
      const documents = [...new Set(paths)];
      const hostInstructionTokens = documents.reduce((total, path) => {
        const skill = /^skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1];
        return total + (skill ? estimate(hostInstruction(host, skill)) : 0);
      }, 0);
      return { documents, hostInstructionTokens, tokens: documents.reduce((total, path) => total + estimate(read(path)), 0) + hostInstructionTokens };
    };
    const entry = (skill, references = []) => measure([
      agreement, `skills/${skill}/SKILL.md`, ...references,
      ...(host === "cursor" ? [`commands/${skill}.md`] : []),
    ]);
    const discoveryFiles = hostSkills(host).map((skill) => `skills/${skill}/SKILL.md`);
    if (host === "cursor") discoveryFiles.push(...publicSkills.map((skill) => `commands/${skill}.md`));
    const discovery = discoveryFiles.reduce((total, path) => {
      const data = parseFrontmatter(join(root, path));
      return total + estimate(`${data.name}: ${data.description}`);
    }, 0);
    const flowSources = Object.fromEntries(Object.entries(flows).map(([name, skill]) => [name, entry(skill)]));
    const measured = Object.fromEntries(Object.entries(flowSources).map(([name, value]) => [name, value.tokens]));
    const supportingFlows = {
      doctor: entry("workflow-doctor", [verification]),
      verificationInspect: entry("verification-work", [verification]),
      methodSuggestion: entry("engineering-work", [catalogPath]),
    };
    if (host === "agent-plugins") supportingFlows.implementation = entry("implement-work");
    const extend = (base, paths) => {
      const additional = measure(paths.filter((path) => !base.documents.includes(path)));
      return { ...additional, totalTokens: base.tokens + additional.tokens };
    };
    const conditionalFlows = {
      planVerifierInspection: extend(flowSources.plan, [verification]),
      planVerifierCreation: extend(flowSources.plan, [verification, verificationSkill, creation]),
      planVerifierMaintenance: extend(flowSources.plan, [verification, verificationSkill, maintenance]),
      reviewVerifier: extend(flowSources.review, [verification]),
      correctionVerifierCreation: extend(flowSources.correction, [verification, verificationSkill, creation]),
      correctionVerifierMaintenance: extend(flowSources.correction, [verification, verificationSkill, maintenance]),
      planMethodSuggestion: extend(flowSources.plan, [catalogPath]),
      verificationCreation: extend(supportingFlows.verificationInspect, [verification, creation]),
      verificationMaintenance: extend(supportingFlows.verificationInspect, [verification, maintenance]),
    };
    if (supportingFlows.implementation) {
      conditionalFlows.implementationVerifierCreation = extend(supportingFlows.implementation, [verification, verificationSkill, creation]);
      conditionalFlows.implementationVerifierMaintenance = extend(supportingFlows.implementation, [verification, verificationSkill, maintenance]);
    }
    targets[host] = { discovery, flows: measured, flowSources, total: Object.values(measured).reduce((a, b) => a + b, 0), supportingFlows, conditionalFlows };
  }
  const previous = {
    plan: baseline.phase_flows.plan_oneshot, review: baseline.phase_flows.review_base,
    correction: baseline.phase_flows.correction, learning: baseline.phase_flows.learning,
    explanation: baseline.phase_flows.explanation, status: baseline.automation_flows.status,
  };
  const previousTotal = Object.values(previous).reduce((a, b) => a + b, 0);
  const failures = [];
  for (const [host, target] of Object.entries(targets)) {
    if (target.discovery > limits.discoverability) failures.push(`${host} discoverability exceeds ${limits.discoverability}`);
    for (const [flow, value] of Object.entries(target.flows)) if (value > limits[flow]) failures.push(`${host} ${flow} exceeds ${limits[flow]}`);
    if (target.total >= previousTotal) failures.push(`${host} total phase context did not decrease against ${previousTotal}`);
  }
  const catalog = estimate(read(catalogPath));
  const playbooks = Object.fromEntries(readdirSync(join(root, playbookDirectory)).filter((name) => name.endsWith(".md") && name !== "catalog.md").sort().map((name) => [name.slice(0, -3), estimate(read(`${playbookDirectory}/${name}`))]));
  const optionalMethods = { catalog, playbooks, documents: { catalog: catalogPath, playbooks: Object.fromEntries(Object.keys(playbooks).map((name) => [name, `${playbookDirectory}/${name}.md`])) }, selectedMethodRange: { min: catalog + Math.min(...Object.values(playbooks)), max: catalog + Math.max(...Object.values(playbooks)) } };
  return { method: "Estimated tokens: characters / 4 rounded per document and host suffix, counted once per path. Inventories describe the required instructions for each illustrated case, not all Markdown links. Existing limits and the historical aggregate cover only the six base flows; supporting and conditional flows have no gate here. Conditional documents/tokens are additional to their base; totalTokens includes that base. Optional methods add the catalog plus one selected playbook to planning, or just the playbook after methodSuggestion already loaded the catalog. Task context, tool output, reasoning, and provider latency are excluded. This is not a runtime measurement or evidence of speed improvement.", previous, previousTotal, targets, optionalMethods, limits, failures };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = measureContext();
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes("--check") && result.failures.length) process.exitCode = 1;
}
