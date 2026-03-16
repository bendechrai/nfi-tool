const KEY_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.\-]*$/;
const MAX_KEY_LENGTH = 256;

/**
 * Validate a secret key name to prevent injection attacks.
 * Rejects keys with newlines, null bytes, or other dangerous characters
 * that could corrupt .env files or structured format files.
 */
export function validateKeyName(key: string): void {
  if (!key) {
    throw new Error("Key name cannot be empty");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new Error(`Key name exceeds maximum length of ${MAX_KEY_LENGTH} characters`);
  }
  if (!KEY_NAME_PATTERN.test(key)) {
    throw new Error(
      `Invalid key name "${key}". Key names must start with a letter or underscore and contain only letters, digits, underscores, dots, and hyphens.`,
    );
  }
}
