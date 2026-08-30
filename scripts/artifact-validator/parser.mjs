import { parseDocument } from "yaml";

function yamlObject(source, label, failures) {
  const document = parseDocument(source, { prettyErrors: false, uniqueKeys: true });
  for (const error of document.errors) failures.push(`${label}: invalid YAML: ${error.message}`);
  if (document.errors.length > 0) return null;
  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be a YAML object`);
    return null;
  }
  return value;
}

function visibleH2Headings(source) {
  const headings = [];
  let fenced = false;
  for (const line of String(source).split(/\r?\n/)) {
    if (/^```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = line.match(/^## ([^#].*)$/);
    if (match) headings.push(match[1].trim());
  }
  return headings;
}

function validateHumanFirstNextStep(projection, failures) {
  const source = String(projection);
  const headings = [...source.matchAll(/^### Next step\s*$/gm)];
  if (headings.length !== 1) {
    failures.push("human-first native plan projection requires exactly one complete ### Next step block");
    return;
  }
  const quick = source.match(/^## Quick decision\s*$([\s\S]*?)(?=^## Details\s*$)/m)?.[1] ?? "";
  const block = quick.match(/^### Next step\s*$([\s\S]*)$/m);
  if (!block || !quick.trimEnd().endsWith(block[0].trimEnd())) {
    failures.push("human-first native plan projection requires ### Next step at the end of Quick decision");
    return;
  }
  const lines = block[1].trim().split(/\r?\n/).filter(Boolean);
  const expected = ["Now", "How", "Why"];
  if (lines.length !== expected.length || expected.some((label, index) => !new RegExp(`^- ${label}:\\s*\\S`).test(lines[index]))) {
    failures.push("human-first native plan projection requires complete Now, How, and Why lines in ### Next step");
  }
}

export function extractEmbeddedWorkPlanText(text) {
  const source = String(text);
  const failures = [];
  const parsed = parseArtifact(source, failures);
  if (failures.length > 0 || parsed?.container !== "cursor-plan" || parsed.fields.artifact !== "work-plan") return null;
  const envelope = source.match(/```yaml artifact-envelope\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/);
  if (!envelope) return null;
  return `---\n${envelope[1].trim()}\n---\n${parsed.body}`;
}

function parsePlanContainer(text, wrapper, failures, normalizations = []) {
  const match = String(text).match(/(?:^|\n)# ([^\r\n]+)\r?\n([\s\S]*?)```yaml artifact-envelope\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/);
  if (!match) {
    failures.push("native plan must contain one H1 and one yaml artifact-envelope");
    return null;
  }
  const projection = match[2].trim();
  if (projection) {
    const headings = visibleH2Headings(projection);
    const expected = ["Quick decision", "Details", "Agent and machine contract (authoritative)"];
    if (headings.length !== expected.length || headings.some((heading, index) => heading !== expected[index])) {
      failures.push("human-first native plan projection must order Quick decision, Details, then Agent and machine contract (authoritative)");
      return null;
    }
    validateHumanFirstNextStep(projection, failures);
    if (failures.length > 0) return null;
  }
  const fields = yamlObject(match[3], "artifact envelope", failures);
  if (!fields) return null;
  if (fields.artifact !== "work-plan") failures.push("native plan containers may contain only work-plan");
  const offset = match.index + (match[0].startsWith("\n") ? 1 : 0);
  if (offset > 0) normalizations.push("ignored Cursor progress text before native plan");
  if (projection) normalizations.push("validated human-first native plan projection");
  return { fields, body: String(text).slice(match.index + match[0].length), wrapper, container: "cursor-plan", title: match[1], normalizations };
}

export function parseArtifact(text, failures = [], normalizations = []) {
  const source = String(text);
  const candidates = [];
  const expression = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/gm;
  for (const match of source.matchAll(expression)) {
    const probeFailures = [];
    const fields = yamlObject(match[1], "frontmatter", probeFailures);
    if (!fields) continue;
    const workflow = typeof fields.artifact === "string" || ["name", "overview", "todos", "isProject"].some((field) => field in fields);
    if (workflow) candidates.push({ match, fields });
  }
  const envelopes = [];
  const envelopeExpression = /```yaml(?: artifact-envelope)?\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
  for (const match of source.matchAll(envelopeExpression)) {
    const probeFailures = [];
    const fields = yamlObject(match[1], "artifact envelope", probeFailures);
    if (fields?.artifact) envelopes.push({ match, fields });
  }
  if (candidates.length === 0) {
    if (envelopes.length > 1) {
      failures.push("response contains multiple workflow artifact candidates");
      return null;
    }
    if (envelopes.length === 1) {
      const [{ match, fields }] = envelopes;
      normalizations.push("normalized fenced Workflow artifact to chat artifact");
      if (match.index > 0) normalizations.push("ignored Cursor progress preamble");
      return { fields, body: source.slice(match.index + match[0].length), wrapper: null, container: "normalized-envelope", normalizations };
    }
    failures.push("response is missing workflow YAML frontmatter");
    return null;
  }
  if (candidates.length > 1) {
    failures.push("response contains multiple workflow artifact candidates");
    return null;
  }
  if (envelopes.length > 1) {
    failures.push("response contains multiple workflow artifact candidates");
    return null;
  }
  const [{ match, fields }] = candidates;
  if (typeof fields.artifact === "string" && envelopes.length > 0) {
    failures.push("response contains multiple workflow artifact candidates");
    return null;
  }
  if (match.index > 0) normalizations.push("ignored Cursor progress preamble");
  if (typeof fields.artifact === "string") return { fields, body: source.slice(match.index + match[0].length), wrapper: null, container: "chat-artifact", normalizations };
  if (["name", "overview", "todos", "isProject"].some((field) => field in fields)) return parsePlanContainer(source.slice(match.index + match[0].length), fields, failures, normalizations);
  failures.push("artifact type is missing");
  return null;
}

function artifactYamlCandidate(text) {
  const source = String(text);
  const candidates = [];
  const frontmatterExpression = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/gm;
  for (const match of source.matchAll(frontmatterExpression)) {
    const failures = [];
    const fields = yamlObject(match[1], "frontmatter", failures);
    if (failures.length === 0 && typeof fields?.artifact === "string") candidates.push({ match, yaml: match[1] });
  }
  const envelopeExpression = /```yaml(?: artifact-envelope)?\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
  for (const match of source.matchAll(envelopeExpression)) {
    const failures = [];
    const fields = yamlObject(match[1], "artifact envelope", failures);
    if (failures.length === 0 && typeof fields?.artifact === "string") candidates.push({ match, yaml: match[1] });
  }
  if (candidates.length !== 1) throw new Error(`artifact text requires exactly one Workflow YAML candidate; observed ${candidates.length}`);
  const candidate = candidates[0];
  const start = candidate.match.index + candidate.match[0].indexOf(candidate.yaml);
  return { source, yaml: candidate.yaml, start, end: start + candidate.yaml.length };
}

export function opaqueExtensionsFromArtifactText(text) {
  const candidate = artifactYamlCandidate(text);
  const document = parseDocument(candidate.yaml, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) throw new Error(`invalid Workflow YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  const fields = document.toJS();
  return Object.hasOwn(fields, "extensions")
    ? { present: true, value: structuredClone(fields.extensions) }
    : { present: false, value: null };
}

export function replaceOpaqueExtensions(text, opaque = { present: false, value: null }) {
  const candidate = artifactYamlCandidate(text);
  const document = parseDocument(candidate.yaml, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) throw new Error(`invalid Workflow YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  document.delete("extensions");
  if (opaque.present === true) {
    if (!opaque.value || typeof opaque.value !== "object" || Array.isArray(opaque.value)) throw new Error("opaque extensions must be an object");
    document.set("extensions", structuredClone(opaque.value));
  }
  const yaml = document.toString({ lineWidth: 0 }).trimEnd();
  return `${candidate.source.slice(0, candidate.start)}${yaml}${candidate.source.slice(candidate.end)}`;
}
