import crypto from "node:crypto";
import { setSecret, type SecretOperationOptions } from "./secrets.js";

export interface Template {
  name: string;
  description: string;
  generate: () => string;
}

function parseTemplate(spec: string): { name: string; length?: number } {
  const colonIndex = spec.indexOf(":");
  if (colonIndex === -1) {
    return { name: spec };
  }
  const name = spec.slice(0, colonIndex);
  const length = parseInt(spec.slice(colonIndex + 1), 10);
  if (isNaN(length) || length <= 0) {
    throw new Error(`Invalid length in template: ${spec}`);
  }
  return { name, length };
}

function generateHex(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function generateBase64(length: number): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

/**
 * Generate a random alphanumeric string using rejection sampling
 * to avoid modulo bias.
 */
function generateAlphanumeric(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // 62 chars. Largest multiple of 62 that fits in a byte: 62 * 4 = 248
  const limit = 248;
  let result = "";

  while (result.length < length) {
    const bytes = crypto.randomBytes(length - result.length + 16); // over-request to reduce iterations
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      if (bytes[i] < limit) {
        result += chars[bytes[i] % chars.length];
      }
      // Reject bytes >= 248 to avoid bias
    }
  }

  return result;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateValue(templateSpec: string): string {
  const { name, length } = parseTemplate(templateSpec);

  switch (name) {
    case "hex":
      return generateHex(length ?? 64);
    case "base64":
      return generateBase64(length ?? 44);
    case "uuid":
      return generateUUID();
    case "alphanumeric":
      return generateAlphanumeric(length ?? 64);
    default:
      throw new Error(
        `Unknown template: ${name}. Available templates: hex, base64, uuid, alphanumeric`,
      );
  }
}

export function describeTemplate(templateSpec: string): string {
  const { name, length } = parseTemplate(templateSpec);

  switch (name) {
    case "hex":
      return `hex string, ${length ?? 64} characters`;
    case "base64":
      return `base64url string, ${length ?? 44} characters`;
    case "uuid":
      return "UUID v4";
    case "alphanumeric":
      return `alphanumeric string, ${length ?? 64} characters`;
    default:
      throw new Error(`Unknown template: ${name}`);
  }
}

export const AVAILABLE_TEMPLATES = [
  { name: "hex:<length>", description: "Random hex string (default: 64 chars)", example: "a3f2b1c9..." },
  { name: "base64:<length>", description: "Random base64url string (default: 44 chars)", example: "K8Fj2pQm..." },
  { name: "uuid", description: "UUID v4", example: "550e8400-e29b-41d4-a716-446655440000" },
  { name: "alphanumeric:<length>", description: "Random alphanumeric string (default: 64 chars)", example: "kA9mZ2xP..." },
];

export async function generateSecret(
  filePath: string,
  key: string,
  templateSpec: string = "hex:64",
  options: SecretOperationOptions = {},
): Promise<{ description: string }> {
  const value = generateValue(templateSpec);
  const description = describeTemplate(templateSpec);
  await setSecret(filePath, key, value, options);
  return { description };
}
