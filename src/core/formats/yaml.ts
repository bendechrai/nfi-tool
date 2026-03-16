import YAML from "yaml";
import type { FormatHandler } from "./types.js";
import { getNestedValue, removeNestedValue, collectLeafPaths } from "./nested.js";

export const yamlHandler: FormatHandler = {
  parse(content: string): Record<string, string> {
    const obj = YAML.parse(content) ?? {};
    const paths = collectLeafPaths(obj, "", 0, 0);
    const result: Record<string, string> = {};
    for (const path of paths) {
      const val = getNestedValue(obj, path);
      result[path] = String(val);
    }
    return result;
  },

  get(content: string, key: string): string | undefined {
    const obj = YAML.parse(content) ?? {};
    const val = getNestedValue(obj, key);
    return val === undefined ? undefined : String(val);
  },

  has(content: string, key: string): boolean {
    const obj = YAML.parse(content) ?? {};
    return getNestedValue(obj, key) !== undefined;
  },

  keys(content: string, depth?: number): string[] {
    const obj = YAML.parse(content) ?? {};
    return collectLeafPaths(obj, "", depth ?? 0, 0);
  },

  set(content: string, key: string, value: string): string {
    const doc = YAML.parseDocument(content);
    const parts = key.split(".");

    // Initialize empty document with a map so nested set works
    if (!doc.contents) {
      (doc as { contents: unknown }).contents = doc.createNode({});
    }

    if (parts.length === 1) {
      doc.set(key, value);
    } else {
      // Navigate/create nested structure
      let current = doc.contents as YAML.YAMLMap;
      for (let i = 0; i < parts.length - 1; i++) {
        let next = current.get(parts[i], true) as YAML.YAMLMap | undefined;
        if (!next || !(next instanceof YAML.YAMLMap)) {
          next = new YAML.YAMLMap();
          current.set(parts[i], next);
        }
        current = next;
      }
      current.set(parts[parts.length - 1], value);
    }

    return doc.toString();
  },

  remove(content: string, key: string): string {
    const obj = YAML.parse(content) ?? {};
    const updated = removeNestedValue(obj, key);
    return YAML.stringify(updated);
  },
};
