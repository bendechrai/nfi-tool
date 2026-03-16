import fs from "node:fs/promises";
import { resolveHandler, type Format } from "./formats/index.js";

const EMPTY_CONTENT: Record<Format, string> = {
  env: "",
  json: "{}\n",
  yaml: "",
  toml: "\n",
};

export interface SecretOperationOptions {
  format?: string;
  overwrite?: boolean;
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
}

export async function setSecret(
  filePath: string,
  key: string,
  value: string,
  options: SecretOperationOptions = {},
): Promise<{ created: boolean }> {
  const { format, handler } = resolveHandler(filePath, options.format);

  let content: string;
  let isNewFile = false;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      content = EMPTY_CONTENT[format];
      isNewFile = true;
    } else {
      throw err;
    }
  }

  const exists = content !== "" && handler.has(content, key);

  if (exists && !options.overwrite) {
    throw new Error(`Key "${key}" already exists in ${filePath}. Use --overwrite to replace.`);
  }

  const updated = handler.set(content, key, value);
  await fs.writeFile(filePath, updated, "utf-8");

  return { created: isNewFile || !exists };
}

export async function hasSecret(
  filePath: string,
  key: string,
  options: SecretOperationOptions = {},
): Promise<{ exists: boolean; hasValue: boolean }> {
  const content = await readFileContent(filePath);
  const { handler } = resolveHandler(filePath, options.format);

  if (!handler.has(content, key)) {
    return { exists: false, hasValue: false };
  }

  const value = handler.get(content, key);
  return { exists: true, hasValue: value !== undefined && value !== "" };
}

export async function listKeys(
  filePath: string,
  options: SecretOperationOptions & { depth?: number } = {},
): Promise<string[]> {
  const content = await readFileContent(filePath);
  const { handler } = resolveHandler(filePath, options.format);
  return handler.keys(content, options.depth);
}

export async function removeSecret(
  filePath: string,
  key: string,
  options: SecretOperationOptions = {},
): Promise<void> {
  const content = await readFileContent(filePath);
  const { handler } = resolveHandler(filePath, options.format);

  if (!handler.has(content, key)) {
    throw new Error(`Key "${key}" not found in ${filePath}`);
  }

  const updated = handler.remove(content, key);
  await fs.writeFile(filePath, updated, "utf-8");
}

export async function copySecret(
  key: string,
  sourcePath: string,
  destPath: string,
  options: SecretOperationOptions & { destKey?: string; destFormat?: string } = {},
): Promise<void> {
  const sourceContent = await readFileContent(sourcePath);
  const { handler: sourceHandler } = resolveHandler(sourcePath, options.format);

  const value = sourceHandler.get(sourceContent, key);
  if (value === undefined) {
    throw new Error(`Key "${key}" not found in ${sourcePath}`);
  }

  const targetKey = options.destKey ?? key;
  await setSecret(destPath, targetKey, value, {
    format: options.destFormat,
    overwrite: options.overwrite,
  });
}

export interface DiffResult {
  missingFrom1: string[];
  missingFrom2: string[];
}

export async function diffKeys(
  filePath1: string,
  filePath2: string,
  options: SecretOperationOptions = {},
): Promise<DiffResult> {
  const content1 = await readFileContent(filePath1);
  const content2 = await readFileContent(filePath2);

  const resolved1 = resolveHandler(filePath1, options.format);
  const resolved2 = resolveHandler(filePath2, options.format);

  // Enforce same-format constraint
  if (resolved1.format !== resolved2.format) {
    throw new Error(
      `Cannot diff files of different formats: ${resolved1.format} (${filePath1}) vs ${resolved2.format} (${filePath2}). ` +
      `Use --format to override both to the same format.`,
    );
  }

  const keys1 = new Set(resolved1.handler.keys(content1));
  const keys2 = new Set(resolved2.handler.keys(content2));

  const missingFrom1 = [...keys2].filter((k) => !keys1.has(k));
  const missingFrom2 = [...keys1].filter((k) => !keys2.has(k));

  return { missingFrom1, missingFrom2 };
}
