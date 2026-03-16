/**
 * Shared utilities for navigating and manipulating nested objects.
 * Used by JSON, YAML, and TOML format handlers.
 */

export function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setNestedValue(obj: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const parts = path.split(".");
  const result = structuredClone(obj);
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

export function removeNestedValue(obj: Record<string, unknown>, path: string): Record<string, unknown> {
  const parts = path.split(".");
  const result = structuredClone(obj);

  if (parts.length === 1) {
    delete result[parts[0]];
    return result;
  }

  let current: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      return result; // Path doesn't exist, nothing to remove
    }
    current = current[part] as Record<string, unknown>;
  }

  delete current[parts[parts.length - 1]];
  return result;
}

export function collectLeafPaths(obj: unknown, prefix: string, maxDepth: number, currentDepth: number): string[] {
  if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }

  // TOML Date objects are leaf values
  if (obj instanceof Date) {
    return prefix ? [prefix] : [];
  }

  if (maxDepth > 0 && currentDepth >= maxDepth) {
    return prefix ? [prefix] : [];
  }

  const results: string[] = [];
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = (obj as Record<string, unknown>)[key];

    if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      results.push(...collectLeafPaths(value, fullPath, maxDepth, currentDepth + 1));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}
