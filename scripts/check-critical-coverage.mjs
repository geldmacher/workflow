#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const groups = [
  {
    name: "workspace roots",
    include: ["src/mcp/workspace-roots.mjs"],
    tests: ["tests/workspace-roots.test.mjs"],
  },
  {
    name: "capability receipt",
    include: ["src/controller/capabilities.mjs"],
    tests: ["tests/capabilities.test.mjs"],
  },
  {
    name: "release surface",
    include: ["src/controller/release-surface.mjs"],
    tests: ["tests/release-surface.test.mjs"],
  },
  {
    name: "worker adapter",
    include: ["src/controller/worker-adapter.mjs"],
    tests: ["tests/worker-adapter.test.mjs"],
  },
  {
    name: "state and handoff indexes",
    include: ["src/controller/store.mjs", "src/controller/artifact-handoff.mjs"],
    tests: [
      "tests/artifact.test.mjs",
      "tests/controller.test.mjs",
      "tests/delivery-closeout.test.mjs",
      "tests/handoff-index.test.mjs",
      "tests/manual-status.test.mjs",
      "tests/mcp-closeout.test.mjs",
      "tests/planning.test.mjs",
      "tests/state-maintenance.test.mjs",
      "tests/store-index.test.mjs",
    ],
  },
];

for (const group of groups) {
  const args = [
    "--test",
    "--test-reporter=dot",
    "--experimental-test-coverage",
    "--test-coverage-lines=80",
    "--test-coverage-branches=70",
    ...group.include.map((path) => `--test-coverage-include=${path}`),
    ...group.tests,
  ];
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`critical coverage failed: ${group.name}`);
  console.log(`Critical coverage passed: ${group.name}.`);
}
