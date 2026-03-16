import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface NfiConfig {
  timeout: number;
  defaultFormat: string | null;
  overwriteByDefault: boolean;
  inputMethod: "auto" | "browser" | "tty";
  generateTemplate: string;
}

const DEFAULT_CONFIG: NfiConfig = {
  timeout: 300000, // 5 minutes
  defaultFormat: null,
  overwriteByDefault: false,
  inputMethod: "auto",
  generateTemplate: "hex:64",
};

const VALID_INPUT_METHODS = new Set(["auto", "browser", "tty"]);
const VALID_FORMATS = new Set(["env", "json", "yaml", "toml"]);

function getConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return path.join(xdgConfig, "nfi");
  }
  return path.join(os.homedir(), ".config", "nfi");
}

function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

/**
 * Validate and sanitize user-provided config values.
 */
function validateConfig(raw: Record<string, unknown>): Partial<NfiConfig> {
  const result: Partial<NfiConfig> = {};

  if ("timeout" in raw) {
    const val = Number(raw.timeout);
    if (!isNaN(val) && val > 0) {
      result.timeout = val;
    }
  }

  if ("defaultFormat" in raw) {
    if (raw.defaultFormat === null || (typeof raw.defaultFormat === "string" && VALID_FORMATS.has(raw.defaultFormat))) {
      result.defaultFormat = raw.defaultFormat as string | null;
    }
  }

  if ("overwriteByDefault" in raw && typeof raw.overwriteByDefault === "boolean") {
    result.overwriteByDefault = raw.overwriteByDefault;
  }

  if ("inputMethod" in raw && typeof raw.inputMethod === "string" && VALID_INPUT_METHODS.has(raw.inputMethod)) {
    result.inputMethod = raw.inputMethod as NfiConfig["inputMethod"];
  }

  if ("generateTemplate" in raw && typeof raw.generateTemplate === "string") {
    // Validate template name (allow any length suffix like hex:32)
    const name = raw.generateTemplate.split(":")[0];
    const validNames = new Set(["hex", "base64", "uuid", "alphanumeric"]);
    if (validNames.has(name)) {
      result.generateTemplate = raw.generateTemplate;
    }
  }

  return result;
}

export async function loadConfig(): Promise<NfiConfig> {
  const configPath = getConfigPath();

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const userConfig = JSON.parse(content);
    if (typeof userConfig === "object" && userConfig !== null && !Array.isArray(userConfig)) {
      const validated = validateConfig(userConfig);
      return { ...DEFAULT_CONFIG, ...validated };
    }
    return { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Partial<NfiConfig>): Promise<void> {
  const configDir = getConfigDir();
  await fs.mkdir(configDir, { recursive: true });

  const existing = await loadConfig();
  const merged = { ...existing, ...config };

  await fs.writeFile(getConfigPath(), JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

export { DEFAULT_CONFIG };
