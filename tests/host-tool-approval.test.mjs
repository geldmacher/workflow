import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  defaultHostPreferencesPath,
  resolveHostToolApproval,
  sharedWorkflowHome,
  validateHostPreferences,
} from "../src/core/host-preferences.mjs";
import { resolveManualSubagentPolicy } from "../src/core/manual-subagent-policy.mjs";
import { sharedArtifactStateRoot } from "../src/core/state-paths.mjs";

test("missing preferences resolve to fail-safe strict", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-prefs-missing-"));
  try {
    const resolved = resolveHostToolApproval({ homeRoot: home });
    assert.equal(resolved.tool_approval, "strict");
    assert.equal(resolved.source, "default");
    assert.equal(resolved.authoritative, false);
    assert.equal(resolved.grants_host_approval, false);
    assert.equal(resolved.host_allowlist_required, false);
    assert.equal(resolved.path, join(home, "preferences.yaml"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("allowlisted preferences parse without granting host approval", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-prefs-allowlisted-"));
  try {
    writeFileSync(join(home, "preferences.yaml"), "schema: 1\ntool_approval: allowlisted\n");
    const resolved = resolveHostToolApproval({ homeRoot: home });
    assert.equal(resolved.tool_approval, "allowlisted");
    assert.equal(resolved.source, "file");
    assert.equal(resolved.grants_host_approval, false);
    assert.equal(resolved.host_allowlist_required, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("host approval and Manual subagent policy share standards-compliant YAML parsing", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-prefs-flow-yaml-"));
  try {
    writeFileSync(join(home, "preferences.yaml"), [
      "schema: 1",
      "tool_approval: allowlisted",
      "manual_subagent_policy: { schema: 1, mode: parent-only }",
      "",
    ].join("\n"));
    const approval = resolveHostToolApproval({ homeRoot: home });
    assert.equal(approval.tool_approval, "allowlisted");
    assert.equal(approval.source, "file");
    const policy = resolveManualSubagentPolicy({ homeRoot: home });
    assert.equal(policy.mode, "parent-only");
    assert.equal(policy.source, "file");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("invalid preferences fall back to strict", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-prefs-invalid-"));
  try {
    writeFileSync(join(home, "preferences.yaml"), "schema: 1\ntool_approval: yolo\n");
    const resolved = resolveHostToolApproval({ homeRoot: home });
    assert.equal(resolved.tool_approval, "strict");
    assert.equal(resolved.source, "invalid-fallback");
    assert.ok(resolved.issues.some((issue) => /tool_approval/.test(issue)));
    assert.deepEqual(validateHostPreferences({ schema: 1, tool_approval: "strict" }), []);
    assert.deepEqual(validateHostPreferences({
      schema: 1,
      tool_approval: "strict",
      manual_subagent_policy: { schema: 1, mode: "parent-only" },
    }), []);
    assert.match(validateHostPreferences({ schema: 2, tool_approval: "strict" }).join("\n"), /schema must be 1/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("shared workflow home defaults beside handoff state", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-prefs-home-"));
  try {
    assert.equal(sharedWorkflowHome({ homeRoot: home }), home);
    assert.equal(defaultHostPreferencesPath({ homeRoot: home }), join(home, "preferences.yaml"));
    const workspace = join(home, "repo");
    mkdirSync(workspace);
    assert.equal(sharedArtifactStateRoot(workspace, { homeRoot: home }), join(home, "state", sharedArtifactStateRoot(workspace, { homeRoot: home }).split("/").pop()));
    assert.ok(sharedArtifactStateRoot(workspace, { homeRoot: home }).startsWith(join(home, "state")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
