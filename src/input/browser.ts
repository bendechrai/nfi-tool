import { createBrowserPromptSession } from "../ui/index.js";

export interface BrowserInputOptions {
  keys: string[];
  file: string;
  existingKeys?: string[];
  timeout?: number;
}

export interface BrowserInputResult {
  values: Record<string, string>;
  /** URL if browser couldn't auto-open (caller should relay to user) */
  url?: string;
  method: "browser";
}

/**
 * Collect secrets via browser UI. Tries to auto-open browser.
 * Returns values once user submits the form.
 */
export async function collectViaBrowser(options: BrowserInputOptions): Promise<BrowserInputResult> {
  const session = createBrowserPromptSession({
    keys: options.keys,
    file: options.file,
    existingKeys: options.existingKeys,
    timeout: options.timeout,
    autoOpen: true,
  });

  const url = await session.url;

  try {
    const values = await session.values;
    return { values, method: "browser" };
  } catch (err) {
    // If we timed out or errored, include the URL in case it's useful
    throw Object.assign(err as Error, { url });
  }
}

/**
 * Start browser session without auto-opening. Returns URL for the caller to relay.
 */
export async function collectViaBrowserNoAutoOpen(options: BrowserInputOptions): Promise<{
  url: string;
  values: Promise<Record<string, string>>;
  close: () => void;
}> {
  const session = createBrowserPromptSession({
    keys: options.keys,
    file: options.file,
    existingKeys: options.existingKeys,
    timeout: options.timeout,
    autoOpen: false,
  });

  const url = await session.url;
  return { url, values: session.values, close: session.close };
}
