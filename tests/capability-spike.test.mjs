import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = resolve(new URL("..", import.meta.url).pathname);

test("static capability spike proves packaging but refuses to activate unverified automation", () => {
  const result = spawnSync(process.execPath, [resolve(root, "scripts", "capability-spike.mjs")], { cwd: root, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.artifact_schema, 5);
  assert.equal(report.controller_protocol, 5);
  assert.equal(report.local_mcp.verified, true);
  assert.equal(report.state_worktree_restart.verified, true);
  assert.equal(report.local_worker_runtime.verified, true);
  assert.equal(report.isolated_worker_runtime.verified, false);
  assert.equal(report.isolated_worker_runtime.reason, "pinned-sdk-runtime-missing");
  assert.equal(report.marketplace_worker_runtime.skipped, true);
  assert.equal(report.worker_network_isolated, false);
  assert.equal(report.sdk_secret_isolated, false);
  assert.equal(report.sdk_budget_cancel_verified, false);
  assert.equal(report.planner_submission_verified, false);
  assert.equal(report.verification_profile.status, "blocked");
  assert.equal(report.automation_safe, false);
});

test("live probes require host-observed product-tool canaries and same-Agent crash resume", () => {
  const spike = readFileSync(resolve(root, "scripts", "capability-spike.mjs"), "utf8");
  const crash = readFileSync(resolve(root, "scripts", "sdk-crash-probe.mjs"), "utf8");
  assert.match(spike, /capability_network_attempt_observed/);
  assert.match(spike, /networkHitsAfter === networkHitsBefore/);
  assert.match(spike, /capability_write_attempt_observed/);
  assert.match(spike, /capability_secret_attempt_observed/);
  assert.match(crash, /pause_after_create_ms/);
  assert.match(crash, /initial_agent_id === item\.resumed_agent_id/);
  assert.match(crash, /crash_state === "interrupted"/);
});
