import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB limit for POST body

export interface BrowserPromptOptions {
  keys: string[];
  file: string;
  existingKeys?: string[];
  timeout?: number;
  autoOpen?: boolean;
}

export interface BrowserPromptResult {
  values: Record<string, string>;
  url?: string;
}

function getPageHtml(): string {
  // In development, read from source. In production, bundled alongside.
  const candidates = [
    path.join(__dirname, "page.html"),
    path.join(__dirname, "..", "ui", "page.html"),
    path.join(__dirname, "..", "..", "src", "ui", "page.html"),
  ];

  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, "utf-8");
    } catch {
      // Try next candidate
    }
  }

  throw new Error("Could not find page.html");
}

/**
 * Compare two strings in constant time to prevent timing attacks.
 * Hashes both inputs to a fixed length before comparing, so length
 * differences do not leak through timing.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Validate that submitted values are a flat Record<string, string>.
 * Prevents prototype pollution and non-string values.
 */
function validateValues(raw: unknown): Record<string, string> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return null;
    }
    if (typeof val !== "string") {
      return null;
    }
    result[key] = val;
  }
  return result;
}

/**
 * Start the browser prompt server and return both the URL and a promise
 * that resolves when the user submits values.
 */
export function createBrowserPromptSession(options: BrowserPromptOptions): {
  url: Promise<string>;
  values: Promise<Record<string, string>>;
  close: () => void;
} {
  const {
    keys,
    file,
    existingKeys = [],
    timeout = 300000,
    autoOpen = true,
  } = options;

  const token = crypto.randomBytes(32).toString("hex");
  const pageHtml = getPageHtml();

  let resolveUrl: (url: string) => void;
  let resolveValues: (values: Record<string, string>) => void;
  let rejectValues: (err: Error) => void;
  let rejectUrl: (err: Error) => void;

  const urlPromise = new Promise<string>((res, rej) => {
    resolveUrl = res;
    rejectUrl = rej;
  });

  const valuesPromise = new Promise<Record<string, string>>((res, rej) => {
    resolveValues = res;
    rejectValues = rej;
  });

  let serverInstance: http.Server;
  let timeoutHandle: ReturnType<typeof setTimeout>;
  let tokenConsumed = false; // One-time token: once GET is served, no more GETs
  let submitConsumed = false; // One-time submit: only one POST is accepted

  const server = http.createServer((req, res) => {
    // Security headers on all responses
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "GET" && req.url?.startsWith("/?")) {
      const params = new URLSearchParams(req.url.slice(2));
      const providedToken = params.get("token") ?? "";

      if (!timingSafeCompare(providedToken, token)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Invalid token");
        return;
      }

      if (tokenConsumed) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Token already used");
        return;
      }

      tokenConsumed = true;

      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      });
      res.end(pageHtml);
      return;
    }

    if (req.method === "POST" && req.url === "/submit") {
      // Reject if the one-time token was already consumed by a POST
      if (submitConsumed) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Already submitted" }));
        return;
      }

      // Require Origin header and check it matches localhost
      const origin = req.headers.origin;
      if (!origin || (!origin.startsWith("http://127.0.0.1:") && !origin.startsWith("http://localhost:"))) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden origin" }));
        return;
      }

      let body = "";
      let bodyTooLarge = false;

      req.on("data", (chunk: Buffer) => {
        body += chunk;
        if (body.length > MAX_BODY_SIZE) {
          bodyTooLarge = true;
          req.destroy();
        }
      });

      req.on("end", () => {
        if (bodyTooLarge) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request too large" }));
          return;
        }

        try {
          const data = JSON.parse(body);
          const providedToken = typeof data.token === "string" ? data.token : "";

          if (!timingSafeCompare(providedToken, token)) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid token" }));
            return;
          }

          const values = validateValues(data.values);
          if (!values) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid values format" }));
            return;
          }

          submitConsumed = true;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));

          clearTimeout(timeoutHandle);
          server.close();
          resolveValues(values);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  serverInstance = server;

  server.listen(0, "127.0.0.1", async () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      const err = new Error("Failed to start server");
      rejectUrl(err);
      rejectValues(err);
      return;
    }

    const keysParam = encodeURIComponent(JSON.stringify(keys));
    const existingParam = encodeURIComponent(JSON.stringify(existingKeys));
    const fileParam = encodeURIComponent(file);
    const url = `http://127.0.0.1:${address.port}/?token=${token}&keys=${keysParam}&existing=${existingParam}&file=${fileParam}`;

    resolveUrl(url);

    if (autoOpen) {
      try {
        const openModule = await import("open");
        await openModule.default(url);
      } catch {
        // Couldn't open browser - URL is still available via the url promise
      }
    }

    timeoutHandle = setTimeout(() => {
      server.close();
      rejectValues(new Error("Timed out waiting for secret input"));
    }, timeout);
  });

  server.on("error", (err) => {
    const error = err instanceof Error ? err : new Error(String(err));
    rejectUrl(error);
    rejectValues(error);
  });

  return {
    url: urlPromise,
    values: valuesPromise,
    close: () => {
      clearTimeout(timeoutHandle);
      serverInstance.close();
    },
  };
}
