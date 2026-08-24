import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultRoot } from "../../scripts/validate-artifact.source.mjs";

export const SANITIZED_CURSOR_REPLAY_PATH = join(
  defaultRoot,
  "tests",
  "fixtures",
  "cursor-native-review-replay.sanitized.json",
);

const SECRET_PATTERNS = Object.freeze([
  ["absolute user path", /(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/],
  ["email address", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["UUID", /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i],
  ["credential prefix", /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/],
  ["unknown long token", /\b[A-Za-z0-9_-]{48,}\b/],
]);

export function sanitizedReplayPrivacyFindings(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

function materialize(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => materialize(item, replacements));
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return value;
    if (Object.prototype.hasOwnProperty.call(replacements, value)) {
      return structuredClone(replacements[value]);
    }
    return Object.entries(replacements).reduce(
      (text, [placeholder, replacement]) => (
        typeof replacement === "string" ? text.replaceAll(placeholder, replacement) : text
      ),
      value,
    );
  }
  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, materialize(item, replacements)]));
}

export function loadSanitizedCursorReplay({
  rootPlan,
  rootPlanId = null,
  workspaceRoot,
  transcriptPath,
  nativeReviewReceipt = "receipt-sanitized",
  mcpToolOutput = { structuredContent: { replay: "sanitized" } },
  hostImplementPlanAction = "Implement the plan as specified; it is attached for reference.",
} = {}) {
  if (typeof rootPlan !== "string" || rootPlan.length < 3681) {
    throw new Error("sanitized Cursor replay requires rootPlan longer than the 3680-character boundary");
  }
  for (const [name, value] of [["workspaceRoot", workspaceRoot], ["transcriptPath", transcriptPath]]) {
    if (typeof value !== "string" || !value.startsWith("/")) {
      throw new Error(`sanitized Cursor replay requires absolute ${name}`);
    }
  }
  const fixture = JSON.parse(readFileSync(SANITIZED_CURSOR_REPLAY_PATH, "utf8"));
  const privacyFindings = sanitizedReplayPrivacyFindings(fixture);
  if (privacyFindings.length > 0) {
    throw new Error(`sanitized Cursor replay fixture contains prohibited raw data classes: ${privacyFindings.join(", ")}`);
  }
  return materialize(fixture, {
    "{{HOST_IMPLEMENT_PLAN_ACTION}}": hostImplementPlanAction,
    "{{MCP_TOOL_OUTPUT}}": mcpToolOutput,
    "{{NATIVE_REVIEW_RECEIPT}}": nativeReviewReceipt,
    "{{ROOT_PLAN}}": rootPlan,
    "{{ROOT_PLAN_ID}}": rootPlanId
      ?? rootPlan.match(/^id:\s*(wp-[A-Za-z0-9][A-Za-z0-9-]*)\s*$/m)?.[1]
      ?? "wp-sanitized-replay",
    "{{ROOT_PLAN_SLICE_3680}}": rootPlan.slice(0, 3680),
    "{{TRANSCRIPT_PATH}}": transcriptPath,
    "{{WORKSPACE_ROOT}}": workspaceRoot,
  });
}
