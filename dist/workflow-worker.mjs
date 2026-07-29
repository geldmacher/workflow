#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);

// src/worker/cursor-worker.mjs
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Agent, Cursor, JsonlLocalAgentStore } from "@cursor/sdk";

// src/worker/planning-output.mjs
function collectCreatePlans(value, found = [], seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return found;
  seen.add(value);
  if (value.type === "createPlan" && typeof value.args?.plan === "string") found.push(value.args.plan);
  for (const child of Object.values(value)) collectCreatePlans(child, found, seen);
  return found;
}
function createPlanArguments(step) {
  return collectCreatePlans(step);
}
function validateIntentBlockerReport(value) {
  const questions = value?.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 3) throw new Error("intent blocker report requires one to three questions");
  const normalized = questions.map((question, index) => {
    if (typeof question !== "string" || question.trim().length < 8) throw new Error(`intent blocker question ${index + 1} is not concrete`);
    return question.trim();
  });
  return {
    questions: normalized,
    rationale: typeof value.rationale === "string" && value.rationale.trim() ? value.rationale.trim() : null
  };
}
function classifyPlanningOutput({ plans = [], blockerReports = [] }) {
  if (plans.length > 0 && blockerReports.length > 0) throw new Error("planner returned both CreatePlan and intent blockers");
  if (plans.length !== 1 && blockerReports.length === 0) throw new Error(`planner must return exactly one CreatePlan or one intent blocker report; observed ${plans.length} plans`);
  if (plans.length === 0 && blockerReports.length !== 1) throw new Error(`planner must return exactly one CreatePlan or one intent blocker report; observed ${blockerReports.length} blocker reports`);
  if (plans.length === 1) return { kind: "root", root_plan_text: plans[0] };
  return { kind: "manual-planning-required", ...validateIntentBlockerReport(blockerReports[0]) };
}

// src/worker/cursor-worker.mjs
function emit(value) {
  process.stdout.write(`WORKFLOW_RESULT=${JSON.stringify(value)}
`);
}
function errorValue(error) {
  return { name: error?.name ?? "Error", message: error?.message ?? String(error), code: error?.code ?? null };
}
function requestedCancellation(job) {
  if (job.control_path && existsSync(job.control_path)) {
    try {
      const control = JSON.parse(readFileSync(job.control_path, "utf8"));
      if (["pause", "stop", "budget"].includes(control.action)) return { reason: control.action, requested_at: control.requested_at ?? (/* @__PURE__ */ new Date()).toISOString() };
    } catch {
      return { reason: "invalid-control-sentinel", requested_at: (/* @__PURE__ */ new Date()).toISOString() };
    }
  }
  if (job.deadline_at && Date.now() >= Date.parse(job.deadline_at)) return { reason: "deadline", requested_at: (/* @__PURE__ */ new Date()).toISOString() };
  return null;
}
function containsProductToolAttempt(value, tokens, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const type = String(value.type ?? value.name ?? value.toolName ?? "");
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = "";
  }
  if (/(tool|shell|command|terminal|browser|network|edit|write)/i.test(type) && tokens.every((token) => serialized.includes(token))) return true;
  return Object.values(value).some((child) => containsProductToolAttempt(child, tokens, seen));
}
async function main() {
  const job = JSON.parse(readFileSync(0, "utf8"));
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY is required for Cursor SDK operations");
  delete process.env.CURSOR_API_KEY;
  if (job.operation === "list-models") {
    const models = await Cursor.models.list({ apiKey });
    emit({ ok: true, operation: job.operation, models, sdk_version: job.sdk_version });
    return;
  }
  if (!["run-phase", "run-planning", "run-capability-probe"].includes(job.operation)) throw new Error(`unsupported worker operation: ${job.operation}`);
  const store = new JsonlLocalAgentStore(job.store_path);
  const blockerReports = [];
  let capabilityNetworkAttemptObserved = false;
  let capabilitySecretAttemptObserved = false;
  let capabilityWriteAttemptObserved = false;
  const options = {
    apiKey,
    model: job.model,
    name: `Geldmacher Workflow: ${job.role}`,
    mode: job.mode,
    local: {
      cwd: job.cwd,
      autoReview: true,
      sandboxOptions: { enabled: true },
      settingSources: [],
      store,
      enableAgentRetries: true,
      customTools: job.operation === "run-planning" ? {
        report_intent_blockers: {
          description: "Stop automated planning when material product intent requires human decisions. Supply one to three concrete questions and no plan.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["questions"],
            properties: {
              questions: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 8 } },
              rationale: { type: "string" }
            }
          },
          execute(args) {
            blockerReports.push(validateIntentBlockerReport(args));
            return { accepted: true, instruction: "End this turn without calling CreatePlan." };
          }
        }
      } : job.operation === "run-capability-probe" ? {
        execute_capability_probe: {
          description: "Execute the controller-provided capability canaries exactly once and return the measured host results.",
          inputSchema: { type: "object", additionalProperties: false, properties: {} },
          async execute() {
            const environmentSecretPresent = Object.values(process.env).some((value) => createHash("sha256").update(String(value)).digest("hex") === job.probe.secret_hash);
            const report = { environment_secret_present: environmentSecretPresent };
            blockerReports.push(report);
            return report;
          }
        }
      } : void 0
    }
  };
  const agent = job.agent_id ? await Agent.resume(job.agent_id, options) : await Agent.create(options);
  try {
    process.stdout.write(`WORKFLOW_PROGRESS=${JSON.stringify({ operation: job.operation, agent_id: agent.agentId, resumed: Boolean(job.agent_id) })}
`);
    if (Number.isInteger(job.pause_after_create_ms) && job.pause_after_create_ms > 0) await new Promise((resolveWait) => setTimeout(resolveWait, job.pause_after_create_ms));
    const plans = [];
    const run = await agent.send(job.prompt, {
      mode: job.mode,
      onStep: job.operation === "run-planning" ? ({ step }) => {
        plans.push(...createPlanArguments(step));
      } : job.operation === "run-capability-probe" ? ({ step }) => {
        capabilityNetworkAttemptObserved ||= containsProductToolAttempt(step, [job.probe.network_canary_url]);
        capabilitySecretAttemptObserved ||= containsProductToolAttempt(step, [job.probe.secret_hash]);
        capabilityWriteAttemptObserved ||= containsProductToolAttempt(step, [job.probe.allowed_write_path, job.probe.protected_write_path, job.probe.foreign_write_path]);
      } : void 0,
      local: { force: job.force === true }
    });
    let cancel = null;
    let cancelInFlight = false;
    const monitor = setInterval(async () => {
      if (cancel || cancelInFlight) return;
      const request = requestedCancellation(job);
      if (!request) return;
      cancelInFlight = true;
      const calledAt = Date.now();
      try {
        await run.cancel();
        cancel = { ...request, sdk_cancel_called: true, sdk_cancel_error: null, called_at: new Date(calledAt).toISOString() };
      } catch (error) {
        cancel = { ...request, sdk_cancel_called: false, sdk_cancel_error: errorValue(error), called_at: new Date(calledAt).toISOString() };
      } finally {
        cancelInFlight = false;
      }
    }, 100);
    monitor.unref?.();
    let result;
    try {
      result = await run.wait();
    } finally {
      clearInterval(monitor);
    }
    if (cancel) {
      const requestedAt = Date.parse(cancel.requested_at);
      const latency = Number.isFinite(requestedAt) ? Math.max(0, Date.now() - requestedAt) : null;
      cancel = {
        ...cancel,
        terminal_status: result.status,
        latency_ms: latency,
        within_grace_period: result.status === "cancelled" && latency !== null && latency <= (job.cancel_grace_ms ?? 5e3)
      };
    }
    let planningOutput = null;
    let planningError = null;
    if (job.operation === "run-planning" && result.status === "finished") {
      try {
        planningOutput = classifyPlanningOutput({ plans, blockerReports });
      } catch (error) {
        planningError = errorValue(error);
      }
    }
    emit({
      ok: result.status === "finished" && !planningError,
      operation: job.operation,
      role: job.role,
      agent_id: agent.agentId,
      run_id: result.id,
      request_id: result.requestId ?? run.requestId ?? null,
      status: result.status,
      result: result.result ?? null,
      error: planningError ?? result.error ?? null,
      planning_output: planningOutput,
      capability_probe: job.operation === "run-capability-probe" ? blockerReports[0] ?? null : null,
      capability_network_attempt_observed: job.operation === "run-capability-probe" ? capabilityNetworkAttemptObserved : null,
      capability_secret_attempt_observed: job.operation === "run-capability-probe" ? capabilitySecretAttemptObserved : null,
      capability_write_attempt_observed: job.operation === "run-capability-probe" ? capabilityWriteAttemptObserved : null,
      observed_model: result.model ?? run.model ?? null,
      duration_ms: result.durationMs ?? run.durationMs ?? null,
      usage: result.usage ?? run.usage ?? null,
      cancel,
      sdk_version: job.sdk_version
    });
  } finally {
    agent.close();
  }
}
main().catch((error) => {
  emit({ ok: false, fatal: true, error: errorValue(error) });
  process.exitCode = 1;
});
