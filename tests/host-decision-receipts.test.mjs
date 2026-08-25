import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeProtectedRecord } from "../src/core/protected-record-store.mjs";
import { createHostDecisionReceiptAdapter } from "../src/harness/host-decision-receipts.mjs";

const context = {
  run_id: `run-${"a".repeat(24)}`,
  revision: 0,
  evidence_hash: null,
  review_hash: null,
};
const firstTransition = `tr-${"1".repeat(32)}`;
const secondTransition = `tr-${"2".repeat(32)}`;

test("human Decision Receipt stages recover and commit exactly once per transition", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-decision-receipts-"));
  try {
    const adapter = createHostDecisionReceiptAdapter({ stateRoot });
    assert.equal(adapter.recover({ transitionId: firstTransition }), null);
    const receipt = adapter.issue({ decision: "stop", context });
    assert.equal(adapter.verify({ receipt: receipt.receipt, decision: "stop", context }).receipt_hash, receipt.receipt_hash);
    assert.throws(() => adapter.verify({ receipt: receipt.receipt, decision: "accept-delivery", context }), /payload mismatch/);
    assert.throws(() => adapter.stage({ receipt: receipt.receipt, decision: "stop", context, transitionId: "invalid" }), /transition_id/);

    const staged = adapter.stage({ receipt: receipt.receipt, decision: "stop", context, transitionId: firstTransition });
    assert.equal(staged.status, "staged");
    assert.deepEqual(adapter.stage({ receipt: receipt.receipt, decision: "stop", context, transitionId: firstTransition }), staged);
    assert.equal(adapter.recover({ transitionId: firstTransition }).receipt_hash, receipt.receipt_hash);

    const foreign = adapter.issue({ decision: "accept-delivery", context });
    assert.throws(() => adapter.stage({ receipt: foreign.receipt, decision: "accept-delivery", context, transitionId: firstTransition }), /stage conflict/);
    const committed = adapter.commit({ transitionId: firstTransition, consumeKey: "run:0:stop" });
    assert.equal(committed.receipt_hash, receipt.receipt_hash);
    assert.equal(adapter.commit({ transitionId: firstTransition, consumeKey: "run:0:stop" }).receipt_hash, receipt.receipt_hash);
    assert.throws(() => adapter.commit({ transitionId: firstTransition, consumeKey: "other" }), /another action/);
    assert.throws(() => adapter.commit({ transitionId: secondTransition, consumeKey: "missing" }), /no staged receipt/);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("human Decision Receipt recovery rejects corrupt host stage records and revoked receipts", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-decision-corrupt-"));
  try {
    const adapter = createHostDecisionReceiptAdapter({ stateRoot });
    const root = join(stateRoot, "human-decision-stages");
    writeProtectedRecord(join(root, `${secondTransition}.json`), {
      schema: 1,
      kind: "not-a-decision-stage",
      transition_id: secondTransition,
    }, root);
    assert.throws(() => adapter.recover({ transitionId: secondTransition }), /stage is invalid/);
    const receipt = adapter.issue({ decision: "stop", context });
    adapter.revoke({ receipt: receipt.receipt, decision: "stop", context });
    assert.throws(() => adapter.verify({ receipt: receipt.receipt, decision: "stop", context }), /revoked/);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});
