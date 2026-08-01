import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

function formatAjv(error) {
  const location = error.instancePath || "/";
  return error.keyword === "additionalProperties" ? `${location}: additional property ${error.params.additionalProperty}` : `${location}: ${error.message}`;
}

export function schemaFor(root, artifact) {
  return join(resolve(root), "schemas", "artifacts", `${artifact}.schema.json`);
}

export function validateArtifactSchema(root, parsed, failures) {
  const path = schemaFor(root, parsed.fields.artifact);
  if (!existsSync(path)) {
    failures.push(`unsupported artifact type: ${parsed.fields.artifact}`);
    return null;
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  if (parsed.wrapper) {
    const wrapperSchema = JSON.parse(readFileSync(join(resolve(root), "schemas", "cursor-plan-wrapper.schema.json"), "utf8"));
    const validateWrapper = ajv.compile(wrapperSchema);
    if (!validateWrapper(parsed.wrapper)) failures.push(...validateWrapper.errors.map((error) => `Cursor wrapper ${formatAjv(error)}`));
  }
  const schema = JSON.parse(readFileSync(path, "utf8"));
  const validate = ajv.compile(schema);
  if (!validate(parsed.fields)) failures.push(...validate.errors.map(formatAjv));
  return schema;
}
