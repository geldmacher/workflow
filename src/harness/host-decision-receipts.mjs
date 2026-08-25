import { existsSync } from "node:fs";
import { join } from "node:path";
import { protectedRecordHash, readProtectedRecord, stableProtectedRecordJson, writeProtectedRecord } from "../core/protected-record-store.mjs";
import { createHostHarnessTrustAdapter } from "./host-trust-adapter.mjs";

const HOST_DECISION_ID = "host-human-decision";

function stageRoot(stateRoot) {
  return join(stateRoot, "human-decision-stages");
}

function stagePath(stateRoot, transitionId) {
  if (!/^tr-[a-f0-9]{32}$/.test(String(transitionId ?? ""))) throw new Error("human decision stage requires transition_id");
  return join(stageRoot(stateRoot), `${transitionId}.json`);
}

export function createHostDecisionReceiptAdapter({ stateRoot, ...options } = {}) {
  const trust = createHostHarnessTrustAdapter({ stateRoot, harnessId: HOST_DECISION_ID, ...options });
  const bindings = (value) => ({ harness_id: HOST_DECISION_ID, ...value });
  const payload = (decision) => ({ schema: 1, kind: "workflow-human-decision", decision });
  return Object.freeze({
    issue({ decision, context }) {
      return trust.issue({ kind: "workflow-human-decision", payload: payload(decision), bindings: bindings(context), reusable: false });
    },
    verify({ receipt, decision, context }) {
      return trust.verify({ receipt, kind: "workflow-human-decision", payload: payload(decision), bindings: bindings(context) });
    },
    stage({ receipt, decision, context, transitionId }) {
      const protection = trust.verify({ receipt, kind: "workflow-human-decision", payload: payload(decision), bindings: bindings(context) });
      const root = stageRoot(stateRoot);
      const path = stagePath(stateRoot, transitionId);
      const candidateHash = protectedRecordHash(stableProtectedRecordJson({ decision, context, receipt_hash: protection.receipt_hash }));
      if (existsSync(path)) {
        const current = readProtectedRecord(path, root);
        if (current?.candidate_hash !== candidateHash) throw new Error("human decision transition stage conflict");
        return Object.freeze({ receipt_hash: current.receipt_hash, status: current.status });
      }
      writeProtectedRecord(path, {
        schema: 1,
        kind: "workflow-human-decision-stage",
        transition_id: transitionId,
        decision,
        context: structuredClone(context),
        receipt,
        receipt_hash: protection.receipt_hash,
        candidate_hash: candidateHash,
        status: "staged",
        consume_key: null,
      }, root);
      return Object.freeze({ receipt_hash: protection.receipt_hash, status: "staged" });
    },
    recover({ transitionId }) {
      const root = stageRoot(stateRoot);
      const path = stagePath(stateRoot, transitionId);
      if (!existsSync(path)) return null;
      const current = readProtectedRecord(path, root);
      if (current?.kind !== "workflow-human-decision-stage") throw new Error("human decision stage is invalid");
      return Object.freeze({ receipt_hash: current.receipt_hash, status: current.status });
    },
    commit({ transitionId, consumeKey }) {
      const root = stageRoot(stateRoot);
      const path = stagePath(stateRoot, transitionId);
      if (!existsSync(path)) throw new Error("human decision transition has no staged receipt");
      const current = readProtectedRecord(path, root);
      if (!current || current.kind !== "workflow-human-decision-stage") throw new Error("human decision transition has no staged receipt");
      if (current.status === "committed") {
        if (current.consume_key !== consumeKey) throw new Error("human decision transition was committed for another action");
        return Object.freeze({ receipt_hash: current.receipt_hash, consumed_by: consumeKey });
      }
      const protection = trust.verify({
        receipt: current.receipt,
        kind: "workflow-human-decision",
        payload: payload(current.decision),
        bindings: bindings(current.context),
        consumeKey,
      });
      writeProtectedRecord(path, { ...current, status: "committed", consume_key: consumeKey }, root);
      return protection;
    },
    revoke({ receipt, decision, context }) {
      return trust.revoke({ receipt, kind: "workflow-human-decision", payload: payload(decision), bindings: bindings(context) });
    },
  });
}
