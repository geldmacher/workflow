import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  validateHarnessCapabilityReceipt,
  validateHarnessPhaseResult,
} from "../core/harness-attestations.mjs";

export const HOST_ADAPTER_ENV = "GELDMACHER_WORKFLOW_HOST_ADAPTER_MODULE";
export const PROJECT_HARNESS_ENV = "GELDMACHER_WORKFLOW_HARNESS_MODULE";

const hashPattern = /^[a-f0-9]{64}$/;

function inside(parent, child) {
  const item = relative(parent, child);
  return item === "" || (item !== ".." && !item.startsWith(`..${sep}`));
}

function canonicalHostAdapterPath(specifier, workspaceRoot) {
  if (typeof specifier !== "string" || !specifier.trim()) return null;
  const raw = specifier.trim();
  const path = raw.startsWith("file:") ? fileURLToPath(raw) : raw;
  if (!isAbsolute(path)) throw new Error(`${HOST_ADAPTER_ENV} must be an absolute file path`);
  const resolved = resolve(path);
  const stat = lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Workflow host adapter must be a regular non-symlink file");
  const canonical = realpathSync(resolved);
  if (canonical !== resolved) throw new Error("Workflow host adapter path may not be redirected");
  if (workspaceRoot && inside(realpathSync(workspaceRoot), canonical)) throw new Error("Workflow host adapter must be outside the project workspace");
  return canonical;
}

function validateBinding(binding) {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) throw new Error("Workflow host adapter returned no Harness binding");
  if (typeof binding.harnessId !== "string" || !binding.harnessId.trim()) throw new Error("Workflow host adapter binding requires harnessId");
  if (!hashPattern.test(String(binding.deploymentBindingHash ?? ""))) throw new Error("Workflow host adapter binding requires deploymentBindingHash");
  for (const method of ["protectedCapability", "stagePhase", "recoverPhase", "commitPhase"]) {
    if (typeof binding[method] !== "function") throw new Error(`Workflow host adapter binding requires ${method}`);
  }
  return Object.freeze(binding);
}

/** Host-side helper for adapters and tests. Workflow production code never
 * resolves a project Harness through this helper; the external adapter owns
 * module resolution and supplies the protected deployment identity. */
export function createProtectedHarnessBinding({ harness, harnessId, deploymentBindingHash, trustAdapter }) {
  if (!harness || typeof harness.capabilityReceipt !== "function" || typeof harness.executePhase !== "function") throw new Error("protected Harness binding requires a Harness implementation");
  if (!trustAdapter || typeof trustAdapter.issue !== "function" || typeof trustAdapter.stage !== "function" || typeof trustAdapter.commit !== "function") throw new Error("protected Harness binding requires a host Trust Adapter");
  if (!hashPattern.test(String(deploymentBindingHash ?? ""))) throw new Error("protected Harness binding requires deploymentBindingHash");

  const capabilityBindings = (workspaceBinding) => ({
    harness_id: harnessId,
    deployment_binding_hash: deploymentBindingHash,
    workspace_binding: workspaceBinding,
  });

  return validateBinding({
    harnessId,
    deploymentBindingHash,
    // Capability protection is deliberately atomic and reusable. Only
    // transition-bound PhaseResults use the stage/recover/commit journal.
    async protectedCapability({ request }) {
      const payload = validateHarnessCapabilityReceipt(await harness.capabilityReceipt({ request }));
      if (payload.harness_id !== harnessId || payload.deployment_binding_hash !== deploymentBindingHash) throw new Error("Harness capability differs from the host deployment binding");
      const bindings = capabilityBindings(request.workspace_binding);
      const protectedValue = trustAdapter.issue({ kind: "harness-capability", payload, bindings, reusable: true });
      trustAdapter.verify({ receipt: protectedValue.receipt, kind: "harness-capability", payload, bindings });
      return Object.freeze({ payload, receipt_hash: protectedValue.receipt_hash });
    },
    async stagePhase({ request, capability, capabilityReceiptHash, effectiveProfile }) {
      const recovered = trustAdapter.recover({ transitionId: request.transition_id });
      if (recovered) return recovered;
      const payload = validateHarnessPhaseResult(await harness.executePhase(request, {
        capability_receipt: capability,
        capability_protection_hash: capabilityReceiptHash,
        effective_profile: effectiveProfile,
      }), request, {
        harness_id: harnessId,
        deployment_binding_hash: deploymentBindingHash,
        capability_receipt_hash: capabilityReceiptHash,
      });
      const bindings = {
        harness_id: harnessId,
        deployment_binding_hash: deploymentBindingHash,
        transition_id: request.transition_id,
        phase_request_hash: payload.phase_request_hash,
        capability_receipt_hash: capabilityReceiptHash,
        root_hash: payload.root_hash,
        workspace_binding: payload.workspace_binding,
        workspace_snapshot_before: payload.workspace_snapshot_before,
        workspace_snapshot_after: payload.workspace_snapshot_after,
      };
      return trustAdapter.stage({ transitionId: request.transition_id, kind: "harness-phase-result", payload, bindings });
    },
    recoverPhase({ transitionId }) {
      return trustAdapter.recover({ transitionId });
    },
    commitPhase({ transitionId, consumeKey }) {
      return trustAdapter.commit({ transitionId, consumeKey });
    },
  });
}

export async function loadProtectedProjectHarness({
  adapterSpecifier = process.env[HOST_ADAPTER_ENV],
  harnessLocator = process.env[PROJECT_HARNESS_ENV],
  pluginRoot,
  stateRoot,
  workspaceRoot,
  workspaceBinding,
} = {}) {
  if (typeof adapterSpecifier !== "string" || !adapterSpecifier.trim()) return null;
  const adapterPath = canonicalHostAdapterPath(adapterSpecifier, workspaceRoot);
  const loaded = await import(pathToFileURL(adapterPath).href);
  const factory = loaded.createWorkflowHostAdapter ?? loaded.default?.createWorkflowHostAdapter;
  if (typeof factory !== "function") throw new Error("Workflow host adapter module must export createWorkflowHostAdapter");
  const adapter = await factory({ pluginRoot, stateRoot, workspaceRoot, workspaceBinding });
  if (!adapter || typeof adapter.bindProjectHarness !== "function") throw new Error("Workflow host adapter must implement bindProjectHarness");
  const binding = await adapter.bindProjectHarness({
    harness_locator: harnessLocator ?? null,
    plugin_root: pluginRoot,
    state_root: stateRoot,
    workspace_root: workspaceRoot,
    workspace_binding: workspaceBinding,
  });
  return validateBinding(binding);
}
