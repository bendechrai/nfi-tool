export type Format = "env" | "json" | "yaml" | "toml";

export interface FormatHandler {
  /** Parse file content and return all key-value pairs as a flat map with dot-notation paths */
  parse(content: string): Record<string, string>;

  /** Get value for a specific key/path, or undefined if not found */
  get(content: string, key: string): string | undefined;

  /** Check if a key/path exists in the content */
  has(content: string, key: string): boolean;

  /** List all key paths up to a given depth (0 = all leaf paths) */
  keys(content: string, depth?: number): string[];

  /** Set a key/path to a value, preserving formatting where possible. Returns new content. */
  set(content: string, key: string, value: string): string;

  /** Remove a key/path entirely. Returns new content. */
  remove(content: string, key: string): string;
}
