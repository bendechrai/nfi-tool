import type { FormatHandler } from "./types.js";
import { getNestedValue, setNestedValue, removeNestedValue, collectLeafPaths } from "./nested.js";

function detectIndent(content: string): number {
  const match = content.match(/^(\s+)"/m);
  return match ? match[1].length : 2;
}

export const jsonHandler: FormatHandler = {
  parse(content: string): Record<string, string> {
    const obj = JSON.parse(content);
    const paths = collectLeafPaths(obj, "", 0, 0);
    const result: Record<string, string> = {};
    for (const path of paths) {
      const val = getNestedValue(obj, path);
      result[path] = String(val);
    }
    return result;
  },

  get(content: string, key: string): string | undefined {
    const obj = JSON.parse(content);
    const val = getNestedValue(obj, key);
    return val === undefined ? undefined : String(val);
  },

  has(content: string, key: string): boolean {
    const obj = JSON.parse(content);
    return getNestedValue(obj, key) !== undefined;
  },

  keys(content: string, depth?: number): string[] {
    const obj = JSON.parse(content);
    return collectLeafPaths(obj, "", depth ?? 0, 0);
  },

  set(content: string, key: string, value: string): string {
    const indent = detectIndent(content);
    const obj = JSON.parse(content);
    const updated = setNestedValue(obj, key, value);
    return JSON.stringify(updated, null, indent) + "\n";
  },

  remove(content: string, key: string): string {
    const indent = detectIndent(content);
    const obj = JSON.parse(content);
    const updated = removeNestedValue(obj, key);
    return JSON.stringify(updated, null, indent) + "\n";
  },
};
