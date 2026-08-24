import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyCodexWorkflowPrompt,
  evaluateCodexHook,
} from "../../core/codex-hook-policy.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");

export function resolveCodexPluginRoot(here = dirname(fileURLToPath(import.meta.url))) {
  let current = resolve(here);
  for (let i = 0; i < 8; i += 1) {
    if (
      existsSync(join(current, "references", "artifact-protocol.md"))
      || existsSync(join(current, "scripts", "validate-artifact.mjs"))
      || existsSync(join(current, "scripts", "validate-artifact.source.mjs"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(here, "../..");
}

function statePath(input, root = null) {
  const base = resolve(root ?? process.env.PLUGIN_DATA ?? join(homedir(), ".codex", "geldmacher-workflow"));
  const repository = digest(resolve(input.cwd ?? process.cwd())).slice(0, 20);
  const session = digest(input.session_id ?? "missing-session").slice(0, 32);
  return join(base, "hooks", repository, "sessions", `${session}.json`);
}

function readState(path) {
  if (!existsSync(path)) return {};
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid Workflow Codex hook state");
  // Manual lifecycle schema 2 is intentionally a clean break. Pre-5.5 active
  // Roots, chains, closeout turns, and handoff tips are inert and never regain
  // authority in a new native-plan task.
  return value.schema === 2 && value.kind === "manual-native-plan-review" ? value : {};
}

function writeState(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function unavailableOutput(input, error) {
  const reason = `Workflow hook unavailable: ${String(error?.message ?? error).slice(0, 400)}. Host-native tools remain available; do not claim verified Workflow evidence from this turn.`;
  if (input?.hook_event_name === "UserPromptSubmit") return {
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: reason },
  };
  return { systemMessage: reason };
}

function inactivePrompt(classification) {
  return ["ordinary", "hook-continuation"].includes(classification.kind);
}

function deactivateBestEffort(input, options) {
  try {
    const path = statePath(input, options.stateRoot);
    if (!existsSync(path)) return;
    const state = readState(path);
    state.turn = null;
    writeState(path, state);
  } catch { /* Inactive Workflow must never block the host. */ }
}

function readStateOrEmpty(path) {
  try { return readState(path); } catch { return {}; }
}

function sameTurn(state, input) {
  return Boolean(state?.turn?.turn_id && input.turn_id && state.turn.turn_id === input.turn_id);
}

function markedWorkflowAgent(input) {
  if (input.hook_event_name !== "PreToolUse" || !/^(?:Agent|spawn_agent)$/i.test(String(input.tool_name ?? ""))) return false;
  const source = input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {};
  return String(source.prompt ?? source.task ?? "").includes("[workflow-model-inherit-v1]");
}

export function runCodexHook(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const event = input.hook_event_name;
  if (event === "SessionStart") return {};

  if (event === "UserPromptSubmit") {
    const classification = classifyCodexWorkflowPrompt(input.prompt);
    if (inactivePrompt(classification)) {
      deactivateBestEffort(input, options);
      return {};
    }
  }

  let path;
  let state;
  try {
    path = statePath(input, options.stateRoot);
    state = readStateOrEmpty(path);
  } catch (error) {
    return event === "UserPromptSubmit" ? unavailableOutput(input, error) : {};
  }
  if (event !== "UserPromptSubmit" && !sameTurn(state, input) && !markedWorkflowAgent(input)) return {};

  try {
    const pluginRoot = options.pluginRoot ?? resolveCodexPluginRoot();
    const evaluated = evaluateCodexHook(input, state, { ...options, pluginRoot });
    writeState(path, evaluated.state);
    return evaluated.output;
  } catch (error) {
    return unavailableOutput(input, error);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  let source = "";
  let oversized = false;
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source) > MAX_INPUT_BYTES) {
      oversized = true;
      break;
    }
  }
  let output = {};
  if (!oversized) {
    try { output = runCodexHook(JSON.parse(source || "{}")); }
    catch { output = {}; }
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
