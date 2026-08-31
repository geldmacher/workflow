import { createHash } from "node:crypto";
import { parseDocument, stringify } from "yaml";

const HOST_FIELDS = new Set(["name", "overview", "todos", "isProject"]);
const CORE_BLOCK = /(?:\r?\n)?<details>\r?\n<summary>Workflow authority<\/summary>\r?\n\r?\n```yaml workflow-authority\r?\n([\s\S]*?)\r?\n```\r?\n<\/details>[ \t]*(?:\r?\n)?$/;
const ANY_CORE_BLOCK = /```yaml workflow-authority\r?\n([\s\S]*?)\r?\n```/g;

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function authorityHash(value) {
  const { authority_hash: _ignored, ...bound } = value;
  return sha256(JSON.stringify(stable(bound)));
}

function yamlObject(source, label) {
  const document = parseDocument(source, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) throw new Error(`${label}: invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a YAML object`);
  return value;
}

function stripHostFrontmatter(source) {
  const match = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return String(source);
  try {
    const fields = yamlObject(match[1], "host frontmatter");
    if (!Object.keys(fields).some((field) => HOST_FIELDS.has(field))) return String(source);
  } catch {
    return String(source);
  }
  return String(source).slice(match[0].length);
}

export function normalizeHumanPlanMarkdown(source) {
  return `${stripHostFrontmatter(String(source).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"))
    .trim()}\n`;
}

export function humanPlanContentHash(source) {
  return sha256(normalizeHumanPlanMarkdown(source));
}

function requiredLine(value, label) {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function stringList(value, label, { required = false } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const result = [...new Set(value.map((entry) => requiredLine(entry, label)))];
  if (required && result.length === 0) throw new Error(`${label} must not be empty`);
  return result;
}

function validateVerification(value, acceptanceCount) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("workflow authority verification must not be empty");
  const checkIds = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`workflow authority verification[${index}] must be an object`);
    const allowed = ["check_id", "objectives", "verification_intent", "expected_evidence", "required", "evidence_class", "cost_class", "prerequisites"];
    const unknown = Object.keys(entry).filter((field) => !allowed.includes(field));
    if (unknown.length > 0) throw new Error(`workflow authority verification[${index}] contains unsupported field ${unknown[0]}`);
    const checkId = requiredLine(entry.check_id, `workflow authority verification[${index}].check_id`);
    if (!/^CHECK-[1-9][0-9]*$/.test(checkId) || checkIds.has(checkId)) throw new Error(`workflow authority verification contains invalid or duplicate ${checkId}`);
    checkIds.add(checkId);
    const objectives = stringList(entry.objectives, `workflow authority verification[${index}].objectives`, { required: true });
    for (const objective of objectives) {
      const match = objective.match(/^OBJ-([1-9][0-9]*)$/);
      if (!match || Number(match[1]) > acceptanceCount) throw new Error(`workflow authority verification ${checkId} references unknown ${objective}`);
    }
    if (typeof entry.required !== "boolean") throw new Error(`workflow authority verification ${checkId}.required must be a boolean`);
    if (!["harness-verifiable", "reviewer-observable", "human-decision-required"].includes(entry.evidence_class)) throw new Error(`workflow authority verification ${checkId} has invalid evidence_class`);
    if (!["cheap", "standard", "expensive"].includes(entry.cost_class)) throw new Error(`workflow authority verification ${checkId} has invalid cost_class`);
    return {
      check_id: checkId,
      objectives,
      verification_intent: requiredLine(entry.verification_intent, `workflow authority verification ${checkId}.verification_intent`),
      expected_evidence: requiredLine(entry.expected_evidence, `workflow authority verification ${checkId}.expected_evidence`),
      required: entry.required,
      evidence_class: entry.evidence_class,
      cost_class: entry.cost_class,
      prerequisites: stringList(entry.prerequisites, `workflow authority verification ${checkId}.prerequisites`, { required: true }),
    };
  });
}

export function normalizeAuthorityCore(input, { planMarkdown = null, requireHash = true } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("workflow authority must be an object");
  const allowed = [
    "artifact", "schema", "id", "status", "source", "profile", "plan_content_hash", "authority_hash", "predecessor_plan_id", "source_review_id",
    "goal", "acceptance", "non_goals", "constraints", "risk", "hard_triggers", "authority", "verification", "certification", "extensions",
  ];
  const unknown = Object.keys(input).filter((field) => !allowed.includes(field));
  if (unknown.length > 0) throw new Error(`workflow authority contains unsupported field ${unknown[0]}`);
  if (input.artifact !== "work-plan" || input.schema !== 6) throw new Error("workflow authority must declare artifact work-plan and schema 6");
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(input.id ?? ""))) throw new Error("workflow authority id must be wp-*");
  if (input.status !== "ready") throw new Error("workflow authority status must be ready");
  if (!["manual", "supervised", "autonomous"].includes(input.profile)) throw new Error("workflow authority profile is invalid");
  if (!["low", "medium", "high"].includes(input.risk)) throw new Error("workflow authority risk is invalid");
  const acceptance = stringList(input.acceptance, "workflow authority acceptance", { required: true });
  const authority = input.authority;
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) throw new Error("workflow authority authority must be an object");
  const normalized = {
    artifact: "work-plan",
    schema: 6,
    id: input.id,
    status: "ready",
    ...(input.source ? { source: requiredLine(input.source, "workflow authority source") } : {}),
    profile: input.profile,
    ...(input.plan_content_hash ? { plan_content_hash: String(input.plan_content_hash) } : {}),
    ...(input.authority_hash ? { authority_hash: String(input.authority_hash) } : {}),
    ...(input.predecessor_plan_id ? { predecessor_plan_id: input.predecessor_plan_id } : {}),
    ...(input.source_review_id ? { source_review_id: input.source_review_id } : {}),
    goal: requiredLine(input.goal, "workflow authority goal"),
    acceptance,
    non_goals: stringList(input.non_goals ?? [], "workflow authority non_goals"),
    constraints: stringList(input.constraints ?? [], "workflow authority constraints"),
    risk: input.risk,
    hard_triggers: stringList(input.hard_triggers ?? [], "workflow authority hard_triggers"),
    authority: structuredClone(authority),
    verification: validateVerification(input.verification, acceptance.length),
    ...(input.certification ? { certification: structuredClone(input.certification) } : {}),
    ...(input.extensions ? { extensions: structuredClone(input.extensions) } : {}),
  };
  if ((normalized.predecessor_plan_id == null) !== (normalized.source_review_id == null)) throw new Error("workflow authority lineage requires predecessor_plan_id and source_review_id together");
  if (normalized.profile === "autonomous" && normalized.hard_triggers.length > 0) throw new Error("hard-trigger work cannot use autonomous profile");
  if (["supervised", "autonomous"].includes(normalized.profile)) {
    for (const field of ["max_active_minutes", "max_total_tokens", "max_cost_usd"]) {
      if (!Number.isFinite(normalized.authority[field]) || normalized.authority[field] <= 0) throw new Error(`workflow authority ${normalized.profile} profile requires authority.${field}`);
    }
  }
  if (normalized.profile === "autonomous" && !normalized.certification) throw new Error("workflow authority autonomous profile requires certification");
  if (requireHash && !/^[a-f0-9]{64}$/.test(normalized.plan_content_hash ?? "")) throw new Error("workflow authority plan_content_hash must be sha256");
  if (requireHash && !/^[a-f0-9]{64}$/.test(normalized.authority_hash ?? "")) throw new Error("workflow authority authority_hash must be sha256");
  if (planMarkdown != null && normalized.plan_content_hash !== humanPlanContentHash(planMarkdown)) throw new Error("workflow authority plan_content_hash does not match the human plan Markdown");
  if (requireHash && normalized.authority_hash !== authorityHash(normalized)) throw new Error("workflow authority authority_hash does not match the Authority Core");
  return normalized;
}

export function internalWorkPlanFields(core) {
  const level = { manual: "lean", supervised: "controlled", autonomous: "certified" }[core.profile];
  return {
    artifact: "work-plan",
    schema: 6,
    id: core.id,
    status: "ready",
    source: core.source ?? "workflow-authority-core",
    ...(core.predecessor_plan_id ? { predecessor_plan_id: core.predecessor_plan_id, source_review_id: core.source_review_id } : {}),
    intent_ready: true,
    profile_max: core.profile,
    contract_level: level,
    plan_content_hash: core.plan_content_hash,
    authority_hash: core.authority_hash,
    risk: core.risk,
    hard_triggers: core.hard_triggers,
    goal: core.goal,
    acceptance: core.acceptance,
    non_goals: core.non_goals,
    constraints: core.constraints,
    authority: core.authority,
    ...(core.certification ? { certification: core.certification } : {}),
    extensions: { ...(core.extensions ?? {}), workflow_authority_core: 1 },
  };
}

function cell(value) {
  return String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
}

export function authorityCoreArtifactBody(core) {
  const rows = core.verification.map((check) => `| ${[
    check.check_id,
    check.objectives.join(", "),
    check.verification_intent,
    check.expected_evidence,
    check.required ? "yes" : "no",
    check.evidence_class,
    check.cost_class,
    check.prerequisites.join(", "),
  ].map(cell).join(" | ")} |`);
  return [
    "## Intent", "", core.goal,
    "", "## Acceptance", "", ...core.acceptance.map((entry, index) => `- OBJ-${index + 1}: ${entry}`),
    "", "### Verification", "",
    "| Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "", "## Boundaries", "",
    `Allowed roots: ${core.authority.allowed_roots.join(", ")}. Protected paths: ${(core.authority.protected_paths ?? []).join(", ") || "none"}. Approval-required paths: ${(core.authority.approval_required_paths ?? []).join(", ") || "none"}.`,
    "", "## Risks", "", `${core.risk} risk.${core.hard_triggers.length > 0 ? ` Hard triggers: ${core.hard_triggers.join(", ")}.` : " No hard triggers."}`,
    "",
  ].join("\n");
}

export function buildWorkflowAuthorityPlan(planMarkdown, authorityInput) {
  const body = normalizeHumanPlanMarkdown(planMarkdown);
  const prepared = normalizeAuthorityCore({ ...authorityInput, plan_content_hash: humanPlanContentHash(body) }, { planMarkdown: body, requireHash: false });
  const core = normalizeAuthorityCore({ ...prepared, authority_hash: authorityHash(prepared) }, { planMarkdown: body });
  const yaml = stringify(core, { lineWidth: 0 }).trimEnd();
  return {
    core,
    plan_markdown: body,
    root_plan: `${body.trimEnd()}\n\n<details>\n<summary>Workflow authority</summary>\n\n\`\`\`yaml workflow-authority\n${yaml}\n\`\`\`\n</details>\n`,
  };
}

export function parseWorkflowAuthorityPlan(source) {
  const text = String(source).replace(/\r\n?/g, "\n");
  if ((text.match(ANY_CORE_BLOCK) ?? []).length !== 1) throw new Error("native plan requires exactly one yaml workflow-authority block");
  ANY_CORE_BLOCK.lastIndex = 0;
  const match = text.match(CORE_BLOCK);
  if (!match) throw new Error("workflow-authority must be the generated expandable block at the end of the plan");
  const withoutCore = text.slice(0, match.index);
  const planMarkdown = normalizeHumanPlanMarkdown(withoutCore);
  const core = normalizeAuthorityCore(yamlObject(match[1], "workflow authority"), { planMarkdown });
  return { core, plan_markdown: planMarkdown, fields: internalWorkPlanFields(core), body: authorityCoreArtifactBody(core) };
}

export function canonicalAuthorityRootText(source) {
  const parsed = parseWorkflowAuthorityPlan(source);
  return `---\n${stringify(parsed.fields, { lineWidth: 0 }).trimEnd()}\n---\n\n${parsed.body}`;
}
