import path from "node:path";
import type { Format, FormatHandler } from "./types.js";
import { envHandler } from "./env.js";
import { jsonHandler } from "./json.js";
import { yamlHandler } from "./yaml.js";
import { tomlHandler } from "./toml.js";

const FORMAT_MAP: Record<Format, FormatHandler> = {
  env: envHandler,
  json: jsonHandler,
  yaml: yamlHandler,
  toml: tomlHandler,
};

const EXTENSION_MAP: Record<string, Format> = {
  ".env": "env",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
};

export function detectFormat(filePath: string): Format | null {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath);

  // Handle .env, .env.local, .env.production, etc.
  if (basename.startsWith(".env")) {
    return "env";
  }

  return EXTENSION_MAP[ext] ?? null;
}

export function getHandler(format: Format): FormatHandler {
  return FORMAT_MAP[format];
}

export function resolveHandler(filePath: string, formatOverride?: string): { format: Format; handler: FormatHandler } {
  if (formatOverride) {
    const format = formatOverride as Format;
    if (!(format in FORMAT_MAP)) {
      throw new Error(`Unsupported format: ${formatOverride}. Supported formats: ${Object.keys(FORMAT_MAP).join(", ")}`);
    }
    return { format, handler: FORMAT_MAP[format] };
  }

  const format = detectFormat(filePath);
  if (!format) {
    throw new Error(
      `Cannot detect format for file: ${filePath}. Use --format to specify. Supported formats: ${Object.keys(FORMAT_MAP).join(", ")}`,
    );
  }

  return { format, handler: FORMAT_MAP[format] };
}
