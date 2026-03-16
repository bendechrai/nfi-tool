import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  setSecret,
  hasSecret,
  listKeys,
  removeSecret,
  copySecret,
  diffKeys,
} from "../../src/core/secrets.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nfi-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("setSecret", () => {
  it("creates a new .env file with the secret", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "API_KEY", "test_value");

    const content = await fs.readFile(file, "utf-8");
    expect(content).toContain("API_KEY=test_value");
  });

  it("creates a new JSON file with nested key", async () => {
    const file = path.join(tmpDir, "config.json");
    await setSecret(file, "database.password", "secret123");

    const content = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(content.database.password).toBe("secret123");
  });

  it("rejects overwriting existing key without flag", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "API_KEY", "original");

    await expect(
      setSecret(file, "API_KEY", "new_value"),
    ).rejects.toThrow("already exists");
  });

  it("allows overwriting with flag", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "API_KEY", "original");
    await setSecret(file, "API_KEY", "new_value", { overwrite: true });

    const result = await hasSecret(file, "API_KEY");
    expect(result.exists).toBe(true);
  });

  it("reports whether key was created or updated", async () => {
    const file = path.join(tmpDir, ".env");
    const r1 = await setSecret(file, "KEY", "val1");
    expect(r1.created).toBe(true);

    const r2 = await setSecret(file, "KEY", "val2", { overwrite: true });
    expect(r2.created).toBe(false);
  });
});

describe("hasSecret", () => {
  it("returns false for missing file", async () => {
    const file = path.join(tmpDir, ".env");
    await expect(hasSecret(file, "KEY")).rejects.toThrow("File not found");
  });

  it("returns exists: false for missing key", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "OTHER=value\n");

    const result = await hasSecret(file, "KEY");
    expect(result.exists).toBe(false);
    expect(result.hasValue).toBe(false);
  });

  it("detects empty values", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "KEY=\n");

    const result = await hasSecret(file, "KEY");
    expect(result.exists).toBe(true);
    expect(result.hasValue).toBe(false);
  });

  it("detects non-empty values", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "KEY=hello\n");

    const result = await hasSecret(file, "KEY");
    expect(result.exists).toBe(true);
    expect(result.hasValue).toBe(true);
  });
});

describe("listKeys", () => {
  it("lists env keys", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "A=1\nB=2\nC=3\n");

    const keys = await listKeys(file);
    expect(keys).toEqual(["A", "B", "C"]);
  });

  it("lists JSON leaf paths", async () => {
    const file = path.join(tmpDir, "config.json");
    await fs.writeFile(file, JSON.stringify({ a: { b: 1, c: 2 }, d: 3 }));

    const keys = await listKeys(file);
    expect(keys).toEqual(["a.b", "a.c", "d"]);
  });

  it("respects depth limit", async () => {
    const file = path.join(tmpDir, "config.json");
    await fs.writeFile(file, JSON.stringify({ a: { b: 1 }, c: 2 }));

    const keys = await listKeys(file, { depth: 1 });
    expect(keys).toEqual(["a", "c"]);
  });
});

describe("removeSecret", () => {
  it("removes a key from env file", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "A=1\nB=2\nC=3\n");

    await removeSecret(file, "B");

    const keys = await listKeys(file);
    expect(keys).toEqual(["A", "C"]);
  });

  it("throws for missing key", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "A=1\n");

    await expect(removeSecret(file, "MISSING")).rejects.toThrow("not found");
  });
});

describe("copySecret", () => {
  it("copies between env files", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await fs.writeFile(source, "SECRET=hidden_value\n");

    await copySecret("SECRET", source, dest);

    const result = await hasSecret(dest, "SECRET");
    expect(result.exists).toBe(true);
    expect(result.hasValue).toBe(true);
  });

  it("copies with key rename", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await fs.writeFile(source, "OLD_KEY=value\n");

    await copySecret("OLD_KEY", source, dest, { destKey: "NEW_KEY" });

    const result = await hasSecret(dest, "NEW_KEY");
    expect(result.exists).toBe(true);
  });

  it("throws for missing source key", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await fs.writeFile(source, "OTHER=value\n");

    await expect(copySecret("MISSING", source, dest)).rejects.toThrow("not found");
  });
});

describe("diffKeys", () => {
  it("finds missing keys in both directions", async () => {
    const file1 = path.join(tmpDir, "a.env");
    const file2 = path.join(tmpDir, "b.env");
    await fs.writeFile(file1, "A=1\nB=2\n");
    await fs.writeFile(file2, "B=x\nC=y\n");

    const result = await diffKeys(file1, file2);
    expect(result.missingFrom1).toEqual(["C"]);
    expect(result.missingFrom2).toEqual(["A"]);
  });

  it("reports no diff for identical key sets", async () => {
    const file1 = path.join(tmpDir, "a.env");
    const file2 = path.join(tmpDir, "b.env");
    await fs.writeFile(file1, "A=1\nB=2\n");
    await fs.writeFile(file2, "A=x\nB=y\n");

    const result = await diffKeys(file1, file2);
    expect(result.missingFrom1).toEqual([]);
    expect(result.missingFrom2).toEqual([]);
  });
});
