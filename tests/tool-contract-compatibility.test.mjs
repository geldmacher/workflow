import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { MANUAL_WORKFLOW_TOOL_NAMES } from "../src/mcp/manual-tool-annotations.mjs";
import { manualToolContract } from "../src/mcp/manual-tool-contracts.mjs";
import { toolContract } from "../src/mcp/tool-contracts.mjs";
import { WORKFLOW_TOOL_NAMES } from "../src/mcp/tool-registry.mjs";

const baseline = JSON.parse(readFileSync(
  join(defaultRoot, "tests", "fixtures", "tool-contracts-5.5.0.json"),
  "utf8",
));

function canonical(value, parentKey = "") {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonical(item));
    return ["enum", "required"].includes(parentKey)
      ? items.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
      : items;
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value)
    .filter((key) => !["$id", "$schema", "description", "examples", "title"].includes(key))
    .sort()
    .map((key) => [key, canonical(value[key], key)]));
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

async function currentHostSnapshot(names, contract) {
  const server = new McpServer({ name: "workflow-contract-snapshot", version: "1.0.0" });
  for (const name of names) {
    server.registerTool(name, contract(name), async () => ({
      content: [{ type: "text", text: "not called" }],
    }));
  }
  const client = new Client({ name: "workflow-contract-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    return Object.fromEntries(listed.tools
      .map((tool) => [tool.name, {
        response_keys: Object.keys(tool).sort(),
        required: [...(tool.inputSchema?.required ?? [])].sort(),
        properties: Object.fromEntries(Object.entries(tool.inputSchema?.properties ?? {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, schema]) => [name, fingerprint(schema)])),
        annotations: canonical(tool.annotations ?? {}),
      }])
      .sort(([left], [right]) => left.localeCompare(right)));
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

function expectedHost(host) {
  const value = baseline.hosts[host];
  return typeof value?.same_as === "string" ? baseline.hosts[value.same_as] : value;
}

function assertCompatibleHost(host, expected, current) {
  assert.deepEqual(Object.keys(current), Object.keys(expected), `${host}: tool names changed`);
  for (const [toolName, prior] of Object.entries(expected)) {
    const next = current[toolName];
    for (const key of baseline.list_tools_response_keys) {
      assert.ok(next.response_keys.includes(key), `${host}:${toolName}: listTools response key ${key} was removed`);
    }
    assert.deepEqual(next.annotations, baseline.annotations[toolName], `${host}:${toolName}: safety annotations changed`);

    const newlyRequired = next.required.filter((name) => !prior.required.includes(name));
    assert.deepEqual(newlyRequired, [], `${host}:${toolName}: optional input became required`);
    for (const [property, propertyHash] of Object.entries(prior.properties)) {
      assert.ok(property in next.properties, `${host}:${toolName}: input ${property} was removed`);
      assert.equal(
        next.properties[property],
        propertyHash,
        `${host}:${toolName}: input ${property} changed incompatibly (including enum narrowing)`,
      );
    }
  }
}

test("Workflow 5.5.1 preserves the minimized 5.5.0 listTools contracts", async () => {
  assert.equal(baseline.schema, 1);
  assert.equal(baseline.baseline_version, "5.5.0");
  const cursor = await currentHostSnapshot(WORKFLOW_TOOL_NAMES, toolContract);
  const codex = await currentHostSnapshot(MANUAL_WORKFLOW_TOOL_NAMES, manualToolContract);
  const portable = await currentHostSnapshot(MANUAL_WORKFLOW_TOOL_NAMES, manualToolContract);

  assertCompatibleHost("cursor", expectedHost("cursor"), cursor);
  assertCompatibleHost("codex", expectedHost("codex"), codex);
  assertCompatibleHost("portable", expectedHost("portable"), portable);
  assert.equal(codex.workflow_closeout.properties.native_review_receipt, undefined);
  assert.equal(portable.workflow_closeout.properties.native_review_receipt, undefined);
});
