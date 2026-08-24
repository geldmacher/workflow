import { parse } from "yaml";

export function parseWorkflowYaml(source) {
  return parse(String(source));
}

export function parsePreferenceYaml(source) {
  return parseWorkflowYaml(source);
}
