import { createHash } from "node:crypto";
import { parse } from "yaml";
import { defaultRoot, preflightRootPlan } from "../../scripts/validate-artifact.source.mjs";
import { rootContentHash } from "./state-paths.mjs";

const ROOT_ID = /\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/;

export { rootContentHash };

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function firstStructured(response) {
  if (!response || typeof response !== "object") return null;
  if (asObject(response.structuredContent)) return response.structuredContent;
  if (Array.isArray(response.content)) {
    for (const entry of response.content) {
      if (asObject(entry?.structuredContent)) return entry.structuredContent;
      if (typeof entry?.text === "string") {
        try {
          const parsed = JSON.parse(entry.text);
          if (asObject(parsed?.structuredContent)) return parsed.structuredContent;
          if (asObject(parsed)) return parsed;
        } catch {
          /* keep scanning */
        }
      }
    }
  }
  return asObject(response);
}

/**
 * Semantic normalization for preflight/presentation sameness checks only.
 * Never use the normalized form or its fingerprint as closeout Root authority.
 */
export function normalizeRootPlanText(rootPlanText) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) {
    throw new Error("root plan text requires exact non-empty Root text");
  }
  return `${String(rootPlanText).replace(/\r\n/g, "\n").trim()}\n`;
}

/** Semantic fingerprint after normalizeRootPlanText. Not closeout authority. */
export function rootPlanFingerprint(rootPlanText) {
  return createHash("sha256").update(normalizeRootPlanText(rootPlanText)).digest("hex");
}

function unwrapProposedPlanInterior(interior) {
  let body = String(interior ?? "");
  // Remove one conventional wrapper newline only; preserve exact Root authority bytes.
  if (body.startsWith("\r\n")) body = body.slice(2);
  else if (body.startsWith("\n")) body = body.slice(1);
  if (body.endsWith("\r\n")) body = body.slice(0, -2);
  else if (body.endsWith("\n")) body = body.slice(0, -1);
  return body;
}

export function extractRootPlanText(source) {
  const text = String(source ?? "");
  const proposedMatch = text.match(/<proposed_plan>([\s\S]*?)<\/proposed_plan>/i);
  const proposed = proposedMatch ? unwrapProposedPlanInterior(proposedMatch[1]) : text.trim();
  const fenced = proposed.match(/```yaml artifact-envelope\s*([\s\S]*?)```([\s\S]*)$/i);
  if (fenced?.[1]) {
    return `---\n${fenced[1].trim()}\n---\n${String(fenced[2] ?? "").trimStart()}`;
  }
  const bare = proposed.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n[\s\S]*)?)$/);
  if (bare?.[1] && /\bartifact:\s*work-plan\b/.test(bare[1]) && /\bschema:\s*5\b/.test(bare[1])) {
    return bare[1];
  }
  return null;
}

export function parseRootPlanFields(rootPlanText) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) {
    return { ok: false, reason: "missing-root-text", fields: null, fingerprint: null, content_hash: null };
  }
  const match = rootPlanText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!match) return { ok: false, reason: "missing-frontmatter", fields: null, fingerprint: null, content_hash: null };
  let fields;
  try {
    fields = parse(match[1]);
  } catch {
    return { ok: false, reason: "invalid-frontmatter", fields: null, fingerprint: null, content_hash: null };
  }
  if (!asObject(fields)) return { ok: false, reason: "invalid-frontmatter", fields: null, fingerprint: null, content_hash: null };
  if (fields.artifact !== "work-plan" || fields.schema !== 5) {
    return { ok: false, reason: "not-schema5-work-plan", fields, fingerprint: null, content_hash: null };
  }
  if (typeof fields.id !== "string" || !ROOT_ID.test(fields.id)) {
    return { ok: false, reason: "invalid-root-id", fields, fingerprint: null, content_hash: null };
  }
  if (!["low", "medium", "high"].includes(fields.risk)) {
    return { ok: false, reason: "invalid-risk", fields, fingerprint: null, content_hash: null };
  }
  if (!Array.isArray(fields.hard_triggers)) {
    return { ok: false, reason: "invalid-hard-triggers", fields, fingerprint: null, content_hash: null };
  }
  return {
    ok: true,
    reason: null,
    fields: Object.freeze({
      id: fields.id,
      risk: fields.risk,
      hard_triggers: Object.freeze([...fields.hard_triggers]),
      profile_max: fields.profile_max ?? null,
      contract_level: fields.contract_level ?? null,
    }),
    fingerprint: rootPlanFingerprint(rootPlanText),
    content_hash: rootContentHash(rootPlanText),
  };
}

export function preflightRequiredForRoot(fields) {
  if (!fields) return true;
  if (fields.risk === "high") return true;
  if ((fields.hard_triggers ?? []).length > 0) return true;
  if (fields.profile_max && fields.profile_max !== "manual") return true;
  if (fields.contract_level && fields.contract_level !== "lean") return true;
  return false;
}

export function readPreflightAttestation(response) {
  const structured = firstStructured(response);
  if (!structured) {
    return { feasible: false, blockers: ["missing-preflight-structured-content"], root_plan_id: null };
  }
  const rootPlanId = typeof structured.root_plan_id === "string" ? structured.root_plan_id : null;
  if (!Array.isArray(structured.blocking_issues)) {
    return { feasible: false, blockers: ["invalid-blocking-issues"], root_plan_id: rootPlanId };
  }
  const blockers = structured.blocking_issues;
  return {
    feasible: structured.feasible === true && blockers.length === 0,
    blockers,
    root_plan_id: rootPlanId,
  };
}

export function inspectPresentedRootPlan(rootPlanText, options = {}) {
  const parsed = parseRootPlanFields(rootPlanText);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.reason ?? "invalid-root-text",
      fields: null,
      fingerprint: null,
      content_hash: null,
      blockers: [parsed.reason ?? "invalid-root-text"],
    };
  }
  const preflight = (options.preflightRootPlan ?? preflightRootPlan)(
    rootPlanText,
    options.pluginRoot ?? defaultRoot,
  );
  if (!preflight?.feasible) {
    const blockers = Array.isArray(preflight?.blocking_issues)
      ? preflight.blocking_issues
      : ["native-preflight-unavailable"];
    return {
      ok: false,
      reason: "native-preflight-failed",
      fields: parsed.fields,
      fingerprint: parsed.fingerprint,
      content_hash: parsed.content_hash,
      blockers,
    };
  }
  return {
    ok: true,
    reason: null,
    fields: parsed.fields,
    fingerprint: parsed.fingerprint,
    content_hash: parsed.content_hash,
    blockers: [],
  };
}
