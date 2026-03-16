import * as TOML from "smol-toml";
import type { FormatHandler } from "./types.js";
import { getNestedValue, setNestedValue, removeNestedValue, collectLeafPaths } from "./nested.js";

export const tomlHandler: FormatHandler = {
  parse(content: string): Record<string, string> {
    const obj = TOML.parse(content);
    const paths = collectLeafPaths(obj, "", 0, 0);
    const result: Record<string, string> = {};
    for (const path of paths) {
      const val = getNestedValue(obj, path);
      result[path] = String(val);
    }
    return result;
  },

  get(content: string, key: string): string | undefined {
    const obj = TOML.parse(content);
    const val = getNestedValue(obj, key);
    return val === undefined ? undefined : String(val);
  },

  has(content: string, key: string): boolean {
    const obj = TOML.parse(content);
    return getNestedValue(obj, key) !== undefined;
  },

  keys(content: string, depth?: number): string[] {
    const obj = TOML.parse(content);
    return collectLeafPaths(obj, "", depth ?? 0, 0);
  },

  set(content: string, key: string, value: string): string {
    const obj = TOML.parse(content) as Record<string, unknown>;
    const updated = setNestedValue(obj, key, value);
    return TOML.stringify(updated);
  },

  remove(content: string, key: string): string {
    const obj = TOML.parse(content) as Record<string, unknown>;
    const updated = removeNestedValue(obj, key);
    return TOML.stringify(updated);
  },
};
