#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { evaluateCodexHook } from "../../core/codex-hook-policy.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");

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
  return value;
}

function writeState(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function runCodexHook(input, options = {}) {
  const path = statePath(input, options.stateRoot);
  const evaluated = evaluateCodexHook(input, readState(path), options);
  writeState(path, evaluated.state);
  return evaluated.output;
}

function failureOutput(input, error) {
  const reason = `Workflow hook failed closed: ${String(error?.message ?? error).slice(0, 400)}`;
  if (input?.hook_event_name === "PreToolUse") return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  };
  if (["UserPromptSubmit", "Stop"].includes(input?.hook_event_name)) return { decision: "block", reason };
  return { systemMessage: reason };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source) > MAX_INPUT_BYTES) throw new Error("Workflow hook input exceeds 1 MiB");
  }
  let input = {};
  let output;
  try {
    input = JSON.parse(source || "{}");
    output = runCodexHook(input);
  } catch (error) { output = failureOutput(input, error); }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
