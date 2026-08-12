import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const receiptSchema = 1;
const defaultTtlMs = 6 * 60 * 60 * 1_000;

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signature(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createLearningSourceReceiptAuthority({ secret = randomBytes(32), now = () => Date.now(), ttlMs = defaultTtlMs } = {}) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw new Error("learning source receipt secret must contain at least 32 bytes");
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("learning source receipt TTL must be positive");

  return Object.freeze({
    issue(run) {
      if (typeof run?.run_id !== "string" || run.run_id === "") throw new Error("learning source receipt requires a Run ID");
      const rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
      if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("learning source receipt requires a Root ID");
      const issuedAt = now();
      const payload = encode({
        schema: receiptSchema,
        source_kind: "controller-run",
        run_id: run.run_id,
        root_plan_id: rootPlanId,
        issued_at: new Date(issuedAt).toISOString(),
        expires_at: new Date(issuedAt + ttlMs).toISOString(),
        nonce: randomBytes(16).toString("base64url"),
      });
      return `${payload}.${signature(secret, payload)}`;
    },

    verify(receipt, run) {
      if (typeof receipt !== "string" || receipt === "") return { confirmed: false, kind: null, blocker: "controller-learning-source-not-current-task-bound" };
      const [payload, suppliedSignature, extra] = receipt.split(".");
      if (!payload || !suppliedSignature || extra !== undefined || !safeEqual(signature(secret, payload), suppliedSignature)) {
        return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      }
      let value;
      try { value = decode(payload); }
      catch { return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" }; }
      const rootPlanId = run?.plan?.fields?.id ?? run?.root_plan_id;
      if (value?.schema !== receiptSchema
        || value?.source_kind !== "controller-run"
        || value?.run_id !== run?.run_id
        || value?.root_plan_id !== rootPlanId
        || !Number.isFinite(Date.parse(value?.issued_at))
        || !Number.isFinite(Date.parse(value?.expires_at))) {
        return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      }
      if (Date.parse(value.expires_at) < now()) return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-expired" };
      return { confirmed: true, kind: "ephemeral-receipt", blocker: null };
    },
  });
}
