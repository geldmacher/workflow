#!/usr/bin/env node
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPluginTargets, defaultRoot, hostSkills } from "./build-plugin-targets.mjs";
import { parseFrontmatter } from "./validate-plugin.mjs";

const estimate = (text) => Math.ceil(text.length / 4);
const skill = (name) => `skills/${name}/SKILL.md`;
const agreement = "references/workflow.md";
const learning = "references/learning-work.md";
const verification = "references/verification-work.md";
const implementation = "references/implementation-work.md";
const catalog = "skills/engineering-work/references/catalog.md";
const creation = "skills/verification-work/references/create.md";
const maintenance = "skills/verification-work/references/maintain.md";
const auto = "skills/auto-work/references";

function scenarios(root, host) {
  const entry = (name, references = []) => [agreement, skill(name), ...references, ...(host === "cursor" ? [`commands/${name}.md`] : [])];
  const plan = entry("plan-work", [catalog, implementation]);
  const inspect = entry("verification-work", [verification]);
  const cases = {
    plan, review: entry("review-work"), correction: entry("correct-work"),
    learning: entry("learn-from-work", [learning]), explanation: entry("explain-work"), status: entry("work-status"),
    doctor: entry("workflow-doctor", [verification]),
    verificationInspect: inspect, methodSuggestion: entry("engineering-work", [catalog]),
    planVerifierInspection: [...plan, verification],
    planVerifierCreation: [...plan, verification, skill("verification-work"), creation],
    planVerifierMaintenance: [...plan, verification, skill("verification-work"), maintenance],
    reviewVerifier: [...entry("review-work"), verification],
    correctionVerifierCreation: [...entry("correct-work"), verification, skill("verification-work"), creation],
    correctionVerifierMaintenance: [...entry("correct-work"), verification, skill("verification-work"), maintenance],
    verificationCreation: [...inspect, creation], verificationMaintenance: [...inspect, maintenance],
  };
  if (host === "agent-plugins") {
    cases.implementation = entry("implement-work", [implementation]);
    cases.implementationVerifierCreation = [...cases.implementation, verification, skill("verification-work"), creation];
    cases.implementationVerifierMaintenance = [...cases.implementation, verification, skill("verification-work"), maintenance];
  }
  for (const name of ["plan", "review", "correction", "explanation", "status", "doctor", "verificationInspect", "methodSuggestion", ...(host === "agent-plugins" ? ["implementation"] : [])]) cases[`${name}WithLearning`] = [...cases[name], learning];
  cases.autoWorkEntry = entry("auto-work", [`${auto}/operation.md`]);
  cases.autoWork = [...cases.autoWorkEntry, skill("plan-work"), catalog, implementation, skill("review-work"), skill("correct-work"), `${auto}/reviewer.md`];
  cases.autoWorkDelivery = [...cases.autoWork, `${auto}/delivery.md`];
  cases.autoWorkWithLearning = [...cases.autoWork, learning];
  cases.autoWorkVerifierCreation = [...cases.autoWork, verification, skill("verification-work"), creation];
  cases.autoWorkVerifierMaintenance = [...cases.autoWork, verification, skill("verification-work"), maintenance];
  for (const name of readdirSync(join(root, "skills/engineering-work/references")).filter(name => name.endsWith(".md") && name !== "catalog.md").sort()) {
    cases[`planMethod:${name.slice(0, -3)}`] = [...plan, skill("engineering-work"), `skills/engineering-work/references/${name}`];
  }
  return cases;
}

export function measureContext(root = defaultRoot, budgets = JSON.parse(readFileSync(join(root, "scripts/context-limits.json"), "utf8")).limits) {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-context-"));
  try {
    const built = buildPluginTargets(temporary, root);
    const targets = {};
    const failures = [];
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      const packageRoot = built[host].path;
      const discoveryDocuments = hostSkills(host).flatMap(name => [skill(name), ...(host === "cursor" ? [`commands/${name}.md`] : [])]);
      const discovery = discoveryDocuments.reduce((total, path) => {
        const metadata = parseFrontmatter(join(packageRoot, path));
        return total + estimate(`${metadata.name}: ${metadata.description}`);
      }, 0);
      const measurements = { discovery: { documents: discoveryDocuments, tokens: discovery } };
      for (const [name, paths] of Object.entries(scenarios(packageRoot, host))) {
        const documents = [...new Set(paths)];
        measurements[name] = { documents, tokens: documents.reduce((total, path) => total + estimate(readFileSync(join(packageRoot, path), "utf8")), 0) };
      }
      for (const [name, measured] of Object.entries(measurements)) {
        const limit = budgets[name];
        measured.limit = limit ?? null;
        if (!Number.isSafeInteger(limit) || limit <= 0) failures.push(`${host} ${name}: missing positive context limit`);
        else if (measured.tokens > limit) failures.push(`${host} ${name}: ${measured.tokens} estimated tokens exceeds ${limit}`);
      }
      targets[host] = measurements;
    }
    for (const name of Object.keys(budgets)) if (!Object.values(targets).some(target => name in target)) failures.push(`unused context limit: ${name}`);
    return { method: "Estimated tokens: characters / 4 rounded per packaged document, counted once per scenario. Light and Dark use the same Auto-Work instructions. Scenario limits cover instruction size, not repeated agent contexts, task history, tool output, reasoning or latency.", targets, failures };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

export function formatContext(result) {
  const hosts = Object.keys(result.targets);
  const names = [...new Set(Object.values(result.targets).flatMap(target => Object.keys(target)))];
  return ["Estimated instruction tokens (not runtime usage)", `Scenario | ${hosts.join(" | ")} | Limit`, ...names.map(name => `${name} | ${hosts.map(host => result.targets[host][name]?.tokens ?? "-").join(" | ")} | ${hosts.map(host => result.targets[host][name]?.limit).find(limit => limit != null) ?? "missing"}`), ...result.failures, result.failures.length ? "Context budget failed." : "Context budget passed."].join("\n");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--check", "--json"].includes(arg))) throw new Error("Use --check and/or --json");
  const result = measureContext();
  console.log(args.includes("--json") ? JSON.stringify(result, null, 2) : formatContext(result));
  if (args.includes("--check") && result.failures.length) process.exitCode = 1;
}
