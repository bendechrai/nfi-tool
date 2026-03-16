import { describe, it, expect } from "vitest";
import { validateKeyName } from "../../src/core/validate";

describe("validateKeyName", () => {
  describe("valid keys", () => {
    it.each([
      ["API_KEY"],
      ["database.password"],
      ["my-key"],
      ["_SECRET"],
      ["A"],
      ["a1_b2.c3-d4"],
    ])("accepts %s", (key) => {
      expect(() => validateKeyName(key)).not.toThrow();
    });
  });

  describe("empty or too long", () => {
    it("throws for empty string", () => {
      expect(() => validateKeyName("")).toThrow("Key name cannot be empty");
    });

    it("throws for 257-character key", () => {
      const long = "A".repeat(257);
      expect(() => validateKeyName(long)).toThrow("exceeds maximum length");
    });

    it("accepts 256-character key", () => {
      const maxLen = "A".repeat(256);
      expect(() => validateKeyName(maxLen)).not.toThrow();
    });
  });

  describe("invalid characters or format", () => {
    it.each([
      ["0starts_with_digit", "starts with number"],
      [".dotstart", "starts with dot"],
      ["has space", "contains space"],
      ["has\nnewline", "contains newline"],
      ["has\0null", "contains null byte"],
      ["path/slash", "contains slash"],
      ["dollar$sign", "contains $"],
      ["at@sign", "contains @"],
      ["exclaim!", "contains !"],
    ])("throws for key that %s (%s)", (key) => {
      expect(() => validateKeyName(key)).toThrow("Invalid key name");
    });
  });
});
