import { parse } from "yaml";

export function parsePreferenceYaml(source) {
  return parse(String(source));
}
