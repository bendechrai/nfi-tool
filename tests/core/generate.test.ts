import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { generateValue, describeTemplate, generateSecret } from "../../src/core/generate.js";
import { hasSecret } from "../../src/core/secrets.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nfi-gen-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("generateValue", () => {
  it("generates hex of specified length", () => {
    const value = generateValue("hex:32");
    expect(value).toMatch(/^[a-f0-9]{32}$/);
  });

  it("generates hex with default length", () => {
    const value = generateValue("hex");
    expect(value).toHaveLength(64);
  });

  it("generates base64", () => {
    const value = generateValue("base64:20");
    expect(value).toHaveLength(20);
  });

  it("generates uuid", () => {
    const value = generateValue("uuid");
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("generates alphanumeric of specified length", () => {
    const value = generateValue("alphanumeric:16");
    expect(value).toHaveLength(16);
    expect(value).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("throws for unknown template", () => {
    expect(() => generateValue("unknown")).toThrow("Unknown template");
  });

  it("throws for invalid length", () => {
    expect(() => generateValue("hex:-5")).toThrow("Invalid length");
  });
});

describe("describeTemplate", () => {
  it("describes hex template", () => {
    expect(describeTemplate("hex:32")).toContain("hex");
    expect(describeTemplate("hex:32")).toContain("32");
  });

  it("describes uuid template", () => {
    expect(describeTemplate("uuid")).toContain("UUID");
  });
});

describe("generateSecret", () => {
  it("generates and writes to a new env file", async () => {
    const file = path.join(tmpDir, ".env");
    const { description } = await generateSecret(file, "SESSION_SECRET");

    expect(description).toContain("hex");
    const result = await hasSecret(file, "SESSION_SECRET");
    expect(result.exists).toBe(true);
    expect(result.hasValue).toBe(true);
  });

  it("generates with a specific template", async () => {
    const file = path.join(tmpDir, ".env");
    await generateSecret(file, "APP_KEY", "uuid");

    const content = await fs.readFile(file, "utf-8");
    // UUID format
    expect(content).toMatch(
      /APP_KEY=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/,
    );
  });

  it("rejects overwriting without flag", async () => {
    const file = path.join(tmpDir, ".env");
    await generateSecret(file, "KEY");

    await expect(generateSecret(file, "KEY")).rejects.toThrow("already exists");
  });
});
