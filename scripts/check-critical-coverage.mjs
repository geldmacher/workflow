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
    lines: 90,
    branches: 80,
  },
  {
    name: "native Cursor authority",
    include: ["hooks/native-review-receipt.mjs", "hooks/native-task-review-context.mjs", "src/core/native-task-review-state.mjs"],
    tests: [
      "tests/native-task-review-context.test.mjs",
      "tests/cursor-native-review-regression.test.mjs",
      "tests/cursor-closeout-hook.test.mjs",
      "tests/mcp-closeout.test.mjs",
    ],
    lines: 90,
    branches: 85,
  },
  {
    name: "Schema-5 CreatePlan guard",
    include: ["hooks/plan-integrity-guard.mjs"],
    tests: ["tests/plan-integrity-guard.test.mjs"],
  },
  {
    name: "manual attestation kernel",
    include: ["src/core/manual-attestation.mjs", "src/core/closeout-retention.mjs"],
    tests: [
      "tests/closeout-attestation.test.mjs",
      "tests/codex-hook-policy.test.mjs",
      "tests/cursor-closeout-hook.test.mjs",
    ],
  },
  {
    name: "Root content identity",
    include: ["src/core/state-paths.mjs"],
    tests: [
      "tests/state-paths.test.mjs",
      "tests/content-addressed-handoff.test.mjs",
      "tests/closeout-attestation.test.mjs",
    ],
  },
  {
    name: "Codex hook policy",
    include: ["src/core/codex-hook-policy.mjs"],
    tests: ["tests/codex-hook-policy.test.mjs"],
    // Large host adapter; keep the shared critical minimum even while shell/routing branches stay cold.
    branches: 70,
  },
  {
    name: "Cursor Review guard",
    include: ["hooks/closeout-guard.mjs"],
    tests: ["tests/cursor-closeout-hook.test.mjs", "tests/cursor-native-review-regression.test.mjs"],
    lines: 90,
    branches: 80,
  },
  {
    name: "repository baseline and Manual Review lifecycle",
    include: ["src/core/manual-repository-snapshot.mjs", "src/core/native-task-review-state.mjs", "src/controller/manual-review-lifecycle.mjs"],
    tests: [
      "tests/manual-review-lifecycle.test.mjs",
      "tests/manual-repository-snapshot.test.mjs",
      "tests/mcp-closeout.test.mjs",
      "tests/cursor-native-review-regression.test.mjs",
      "tests/native-task-review-context.test.mjs",
    ],
    lines: 90,
    branches: 80,
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
      "tests/content-addressed-handoff.test.mjs",
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
  {
    name: "human projection and actions",
    include: ["src/mcp/manual-presentation.mjs", "src/core/manual-journey.mjs"],
    tests: [
      "tests/mcp-manual-presentation.test.mjs",
      "tests/manual-guidance.test.mjs",
      "tests/manual-status.test.mjs",
      "tests/mcp-closeout.test.mjs",
    ],
    lines: 90,
    branches: 80,
  },
  {
    name: "controller learning lineage",
    include: ["src/controller/learning-context.mjs"],
    tests: ["tests/learning-context.test.mjs", "tests/engine.test.mjs"],
  },
];

for (const group of groups) {
  const lineFloor = Number.isInteger(group.lines) ? group.lines : 80;
  const branchFloor = Number.isInteger(group.branches) ? group.branches : 70;
  const args = [
    "--test",
    "--test-reporter=dot",
    "--experimental-test-coverage",
    `--test-coverage-lines=${lineFloor}`,
    `--test-coverage-branches=${branchFloor}`,
    ...group.include.map((path) => `--test-coverage-include=${path}`),
    ...group.tests,
  ];
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`critical coverage failed: ${group.name}`);
  console.log(`Critical coverage passed: ${group.name}.`);
}
