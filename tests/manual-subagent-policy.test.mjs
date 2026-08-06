import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  MANUAL_SUBAGENT_PRESETS,
  childAllowedByPolicy,
  expandPreset,
  resolveManualSubagentPolicy,
  selectCodexCandidate,
  validateManualSubagentPolicy,
} from "../src/core/manual-subagent-policy.mjs";

test("missing preferences resolve to parent-only", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-subagent-policy-missing-"));
  try {
    const resolved = resolveManualSubagentPolicy({ homeRoot: home });
    assert.equal(resolved.mode, "parent-only");
    assert.equal(resolved.source, "default");
    assert.deepEqual(resolved.hosts.cursor.candidates, []);
    assert.deepEqual(resolved.hosts.codex.candidates, []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("invalid policy falls back to parent-only", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-subagent-policy-invalid-"));
  try {
    writeFileSync(join(home, "preferences.yaml"), [
      "schema: 1",
      "tool_approval: strict",
      "manual_subagent_policy:",
      "  schema: 1",
      "  mode: parent-or-approved",
      "  hosts:",
      "    cursor:",
      "      preset: unknown-preset",
      "",
    ].join("\n"));
    const resolved = resolveManualSubagentPolicy({ homeRoot: home });
    assert.equal(resolved.mode, "parent-only");
    assert.equal(resolved.source, "invalid-fallback");
    assert.ok(resolved.issues.some((issue) => /unknown-preset/.test(issue)));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cursor composer-grok preset expands concrete IDs without GPT Sol", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-subagent-policy-cursor-"));
  try {
    writeFileSync(join(home, "preferences.yaml"), [
      "schema: 1",
      "tool_approval: strict",
      "manual_subagent_policy:",
      "  schema: 1",
      "  mode: parent-or-approved",
      "  hosts:",
      "    cursor:",
      "      preset: cursor-composer-grok-v1",
      "",
    ].join("\n"));
    const resolved = resolveManualSubagentPolicy({ homeRoot: home });
    assert.equal(resolved.mode, "parent-or-approved");
    assert.deepEqual(resolved.hosts.cursor.candidates.map((entry) => entry.model_id), [
      "composer-2.5-fast",
      "cursor-grok-4.5-high-fast",
    ]);
    assert.equal(resolved.hosts.cursor.candidates.some((entry) => /sol/i.test(entry.model_id)), false);
    const parent = childAllowedByPolicy({
      parentModel: "cursor-grok-4.5-high-fast",
      observedChild: "cursor-grok-4.5-high-fast",
      hostPolicy: resolved.hosts.cursor,
      mode: resolved.mode,
    });
    assert.deepEqual(parent, { allowed: true, match_mode: "exact-parent" });
    const approved = childAllowedByPolicy({
      parentModel: "cursor-grok-4.5-high-fast",
      observedChild: "composer-2.5-fast",
      hostPolicy: resolved.hosts.cursor,
      mode: resolved.mode,
    });
    assert.deepEqual(approved, { allowed: true, match_mode: "approved-candidate" });
    const denied = childAllowedByPolicy({
      parentModel: "cursor-grok-4.5-high-fast",
      observedChild: "gpt-5.6-sol-xhigh",
      hostPolicy: resolved.hosts.cursor,
      mode: resolved.mode,
    });
    assert.deepEqual(denied, { allowed: false, match_mode: null });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("codex efficient GPT preset selects ordered candidates then parent fallback", () => {
  const preset = expandPreset("codex-efficient-gpt-v1");
  assert.equal(preset.host, "codex");
  assert.equal(MANUAL_SUBAGENT_PRESETS["codex-efficient-gpt-v1"].candidates.some((entry) => /sol/i.test(entry.model_id)), false);
  const first = selectCodexCandidate({
    hostPolicy: preset,
    mode: "parent-or-approved",
    parentModel: "gpt-parent",
  });
  assert.deepEqual(first, {
    kind: "candidate",
    model_id: "gpt-5.6-luna-max",
    reasoning_effort: "low",
    index: 0,
  });
  const second = selectCodexCandidate({
    hostPolicy: preset,
    mode: "parent-or-approved",
    unavailable: ["gpt-5.6-luna-max"],
    parentModel: "gpt-parent",
  });
  assert.equal(second.model_id, "gpt-5.6-terra-xhigh");
  const parent = selectCodexCandidate({
    hostPolicy: preset,
    mode: "parent-or-approved",
    unavailable: ["gpt-5.6-luna-max", "gpt-5.6-terra-xhigh"],
    parentModel: "gpt-parent",
  });
  assert.deepEqual(parent, { kind: "parent", model_id: "gpt-parent", reasoning_effort: null, index: -1 });
});

test("custom concrete candidates validate and reject unknown fields", () => {
  assert.deepEqual(validateManualSubagentPolicy({
    schema: 1,
    mode: "parent-or-approved",
    hosts: {
      cursor: { candidates: [{ model_id: "composer-2.5-fast" }] },
      codex: { candidates: [{ model_id: "gpt-5.6-luna-max", reasoning_effort: "low" }], parent_fallback: true },
    },
  }), []);
  assert.match(validateManualSubagentPolicy({
    schema: 1,
    mode: "parent-or-approved",
    hosts: { cursor: { candidates: [{ model_id: "composer-2.5-fast", family: "composer" }] } },
  }).join("\n"), /unknown field family/);
});

test("preference YAML supports nested host candidates with reasoning effort", () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-subagent-policy-custom-"));
  try {
    writeFileSync(join(home, "preferences.yaml"), [
      "schema: 1",
      "tool_approval: strict",
      "manual_subagent_policy:",
      "  schema: 1",
      "  mode: parent-or-approved",
      "  hosts:",
      "    codex:",
      "      parent_fallback: true",
      "      candidates:",
      "        - model_id: gpt-5.6-luna-max",
      "          reasoning_effort: low",
      "        - model_id: gpt-5.6-terra-xhigh",
      "          reasoning_effort: medium",
      "",
    ].join("\n"));
    const resolved = resolveManualSubagentPolicy({ homeRoot: home });
    assert.equal(resolved.mode, "parent-or-approved");
    assert.deepEqual(resolved.hosts.codex.candidates, [
      { model_id: "gpt-5.6-luna-max", reasoning_effort: "low" },
      { model_id: "gpt-5.6-terra-xhigh", reasoning_effort: "medium" },
    ]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
