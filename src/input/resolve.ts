import { collectViaBrowser, type BrowserInputOptions } from "./browser.js";
import { promptTTY } from "./tty.js";

export type InputMethod = "auto" | "browser" | "tty";

export interface CollectSecretsOptions {
  keys: string[];
  file: string;
  existingKeys?: string[];
  timeout?: number;
  method?: InputMethod;
}

export interface CollectSecretsResult {
  values: Record<string, string>;
  method: "browser" | "tty";
  /** URL if the browser couldn't auto-open (MCP callers should relay this) */
  url?: string;
}

/**
 * Collect secret values from the user using the fallback chain:
 * 1. Browser UI (auto-open)
 * 2. TTY prompt (/dev/tty)
 */
export async function collectSecrets(options: CollectSecretsOptions): Promise<CollectSecretsResult> {
  const method = options.method ?? "auto";

  if (method === "tty") {
    return collectViaTTY(options.keys);
  }

  if (method === "browser" || method === "auto") {
    try {
      const result = await collectViaBrowser({
        keys: options.keys,
        file: options.file,
        existingKeys: options.existingKeys,
        timeout: options.timeout,
      });
      return { ...result };
    } catch (err) {
      // If browser method was explicitly requested, throw
      if (method === "browser") {
        throw err;
      }

      // Auto mode: fall back to TTY
    }

    // Fallback to TTY
    try {
      return await collectViaTTY(options.keys);
    } catch {
      throw new Error(
        "Could not collect secrets: browser UI failed and TTY is not available. " +
        "Run in a terminal or use a client that supports clicking URLs.",
      );
    }
  }

  throw new Error(`Unknown input method: ${method}`);
}

async function collectViaTTY(keys: string[]): Promise<CollectSecretsResult> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    values[key] = await promptTTY(key);
  }
  return { values, method: "tty" };
}
