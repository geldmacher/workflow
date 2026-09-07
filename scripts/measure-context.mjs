#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRoot, parseFrontmatter } from "./validate-plugin.mjs";
import { hostSkills, hostInstruction, publicSkills } from "./build-plugin-targets.mjs";

const estimate = (text) => Math.ceil(text.length / 4);
export const limits = { discoverability: 428, plan: 2000, review: 2150, correction: 2000, learning: 2000, explanation: 1200, status: 1500 };
const flows = { plan: "plan-work", review: "review-work", correction: "correct-work", learning: "learn-from-work", explanation: "explain-work", status: "work-status" };
export function measureContext(root = defaultRoot) {
  const baseline = JSON.parse(readFileSync(join(root, "scripts/context-baseline.json"), "utf8"));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const common = estimate(read("references/workflow.md"));
  const targets = {};
  for (const host of ["cursor", "codex", "agent-plugins"]) {
    const discoveryFiles = hostSkills(host).map((skill) => `skills/${skill}/SKILL.md`);
    if (host === "cursor") discoveryFiles.push(...publicSkills.map((skill) => `commands/${skill}.md`));
    const discovery = discoveryFiles.reduce((total, path) => {
      const data = parseFrontmatter(join(root, path));
      return total + estimate(`${data.name}: ${data.description}`);
    }, 0);
    const measured = Object.fromEntries(Object.entries(flows).map(([name, skill]) => [name,
      common + estimate(read(`skills/${skill}/SKILL.md`)) + estimate(hostInstruction(host, skill)) + (host === "cursor" ? estimate(read(`commands/${skill}.md`)) : 0),
    ]));
    targets[host] = { discovery, flows: measured, total: Object.values(measured).reduce((a, b) => a + b, 0) };
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
  return { method: "Estimated tokens: characters / 4 rounded per document; required base context only, optional method and verifier references load on demand.", previous, previousTotal, targets, limits, failures };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = measureContext();
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes("--check") && result.failures.length) process.exitCode = 1;
}
