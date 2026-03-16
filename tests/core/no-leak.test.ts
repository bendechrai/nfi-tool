/**
 * Tests that secret values never leak into outputs that could reach an AI context.
 *
 * These tests use a known sentinel value and assert it never appears in:
 * - CLI stdout/stderr
 * - Core function return values
 * - Error messages
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
import { generateSecret } from "../../src/core/generate.js";

const exec = promisify(execFile);
const CLI = path.resolve("dist/cli/index.js");

// A sentinel value that should never appear in any output
const SECRET_VALUE = "SUPER_SECRET_sentinel_value_12345!@#$%";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nfi-leak-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function assertNoLeak(text: string, label: string): void {
  expect(text).not.toContain(SECRET_VALUE);
  // Also check for partial matches (in case of truncation or encoding)
  expect(text).not.toContain("SUPER_SECRET_sentinel");
}

describe("core functions never return secret values", () => {
  it("setSecret returns only {created} boolean, not the value", async () => {
    const file = path.join(tmpDir, ".env");
    const result = await setSecret(file, "MY_KEY", SECRET_VALUE);
    const serialized = JSON.stringify(result);
    assertNoLeak(serialized, "setSecret return value");
    expect(result).toEqual({ created: true });
  });

  it("hasSecret returns only {exists, hasValue} booleans", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "MY_KEY", SECRET_VALUE);
    const result = await hasSecret(file, "MY_KEY");
    const serialized = JSON.stringify(result);
    assertNoLeak(serialized, "hasSecret return value");
    expect(result).toEqual({ exists: true, hasValue: true });
  });

  it("listKeys returns only key names, never values", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "MY_KEY", SECRET_VALUE);
    const keys = await listKeys(file);
    const serialized = JSON.stringify(keys);
    assertNoLeak(serialized, "listKeys return value");
    expect(keys).toEqual(["MY_KEY"]);
  });

  it("diffKeys returns only key names, never values", async () => {
    const file1 = path.join(tmpDir, "a.env");
    const file2 = path.join(tmpDir, "b.env");
    await setSecret(file1, "KEY_A", SECRET_VALUE);
    await setSecret(file2, "KEY_B", "other_secret_value");
    const result = await diffKeys(file1, file2);
    const serialized = JSON.stringify(result);
    assertNoLeak(serialized, "diffKeys return value");
    expect(serialized).not.toContain("other_secret_value");
  });

  it("removeSecret returns void, not the removed value", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "MY_KEY", SECRET_VALUE);
    const result = await removeSecret(file, "MY_KEY");
    expect(result).toBeUndefined();
  });

  it("copySecret returns void, not the copied value", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await setSecret(source, "MY_KEY", SECRET_VALUE);
    const result = await copySecret("MY_KEY", source, dest);
    expect(result).toBeUndefined();
    // Verify the value was actually copied (it's in the file, not in the return)
    const destContent = await fs.readFile(dest, "utf-8");
    expect(destContent).toContain(SECRET_VALUE);
  });

  it("generateSecret returns only {description}, not the generated value", async () => {
    const file = path.join(tmpDir, ".env");
    const result = await generateSecret(file, "GEN_KEY", "hex:32");
    const serialized = JSON.stringify(result);
    // The generated value is a 32-char hex string; it should not be in the return
    expect(result).toHaveProperty("description");
    expect(Object.keys(result)).toEqual(["description"]);
    // Read the file to get the actual generated value and verify it's not in the return
    const content = await fs.readFile(file, "utf-8");
    const match = content.match(/GEN_KEY=([a-f0-9]+)/);
    expect(match).not.toBeNull();
    expect(serialized).not.toContain(match![1]);
  });

  it("error messages from setSecret do not contain the value", async () => {
    const file = path.join(tmpDir, ".env");
    await setSecret(file, "MY_KEY", SECRET_VALUE);
    try {
      await setSecret(file, "MY_KEY", SECRET_VALUE);
      expect.fail("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      assertNoLeak(message, "setSecret error message");
    }
  });
});

describe("CLI output never contains secret values", () => {
  it("generate command stdout does not contain the generated value", async () => {
    const file = path.join(tmpDir, ".env");
    const { stdout, stderr } = await exec("node", [CLI, "generate", "SECRET_KEY", file]);
    // Read the actual generated value from the file
    const content = await fs.readFile(file, "utf-8");
    const match = content.match(/SECRET_KEY=(.+)/);
    expect(match).not.toBeNull();
    const generatedValue = match![1];
    expect(generatedValue.length).toBeGreaterThan(0);
    expect(stdout).not.toContain(generatedValue);
    expect(stderr).not.toContain(generatedValue);
  });

  it("has command does not reveal the value", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, `SECRET=${SECRET_VALUE}\n`);
    const { stdout, stderr } = await exec("node", [CLI, "has", "SECRET", file]);
    assertNoLeak(stdout, "has stdout");
    assertNoLeak(stderr, "has stderr");
  });

  it("keys command does not reveal values", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, `SECRET=${SECRET_VALUE}\nOTHER=another_secret\n`);
    const { stdout, stderr } = await exec("node", [CLI, "keys", file]);
    assertNoLeak(stdout, "keys stdout");
    assertNoLeak(stderr, "keys stderr");
    expect(stdout).not.toContain("another_secret");
    // Should only contain key names
    expect(stdout.trim()).toBe("SECRET\nOTHER");
  });

  it("diff command does not reveal values", async () => {
    const file1 = path.join(tmpDir, "a.env");
    const file2 = path.join(tmpDir, "b.env");
    await fs.writeFile(file1, `KEY_A=${SECRET_VALUE}\n`);
    await fs.writeFile(file2, `KEY_B=other_secret\n`);
    const { stdout, stderr } = await exec("node", [CLI, "diff", file1, file2]);
    assertNoLeak(stdout, "diff stdout");
    assertNoLeak(stderr, "diff stderr");
    expect(stdout).not.toContain("other_secret");
  });

  it("remove command does not reveal the removed value", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, `SECRET=${SECRET_VALUE}\n`);
    const { stdout, stderr } = await exec("node", [CLI, "remove", "SECRET", file]);
    assertNoLeak(stdout, "remove stdout");
    assertNoLeak(stderr, "remove stderr");
  });

  it("copy command does not reveal the copied value", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await fs.writeFile(source, `SECRET=${SECRET_VALUE}\n`);
    const { stdout, stderr } = await exec("node", [CLI, "copy", "SECRET", source, dest]);
    assertNoLeak(stdout, "copy stdout");
    assertNoLeak(stderr, "copy stderr");
  });

  it("verbose flag on generate does not reveal the value", async () => {
    const file = path.join(tmpDir, ".env");
    const { stdout, stderr } = await exec("node", [CLI, "generate", "KEY", file, "--verbose"]);
    const content = await fs.readFile(file, "utf-8");
    const match = content.match(/KEY=(.+)/);
    expect(match).not.toBeNull();
    expect(stdout).not.toContain(match![1]);
    expect(stderr).not.toContain(match![1]);
  });
});

describe("structured format operations never leak values", () => {
  it("JSON listKeys returns paths not values", async () => {
    const file = path.join(tmpDir, "config.json");
    await setSecret(file, "database.password", SECRET_VALUE);
    const keys = await listKeys(file);
    const serialized = JSON.stringify(keys);
    assertNoLeak(serialized, "JSON listKeys");
    expect(keys).toEqual(["database.password"]);
  });

  it("YAML listKeys returns paths not values", async () => {
    const file = path.join(tmpDir, "config.yaml");
    await setSecret(file, "api.key", SECRET_VALUE);
    const keys = await listKeys(file);
    const serialized = JSON.stringify(keys);
    assertNoLeak(serialized, "YAML listKeys");
  });

  it("JSON hasSecret does not return the value", async () => {
    const file = path.join(tmpDir, "config.json");
    await setSecret(file, "secret.key", SECRET_VALUE);
    const result = await hasSecret(file, "secret.key");
    const serialized = JSON.stringify(result);
    assertNoLeak(serialized, "JSON hasSecret");
  });

  it("JSON diffKeys does not reveal values", async () => {
    const file1 = path.join(tmpDir, "a.json");
    const file2 = path.join(tmpDir, "b.json");
    await setSecret(file1, "secret", SECRET_VALUE);
    await setSecret(file2, "other", "another_secret");
    const result = await diffKeys(file1, file2);
    const serialized = JSON.stringify(result);
    assertNoLeak(serialized, "JSON diffKeys");
    expect(serialized).not.toContain("another_secret");
  });

  it("cross-format copy does not leak via return value", async () => {
    const source = path.join(tmpDir, ".env");
    const dest = path.join(tmpDir, "config.json");
    await setSecret(source, "DB_PASS", SECRET_VALUE);
    const result = await copySecret("DB_PASS", source, dest, { destKey: "database.password" });
    expect(result).toBeUndefined();
    // Value should be in the file though
    const content = await fs.readFile(dest, "utf-8");
    expect(content).toContain(SECRET_VALUE);
  });
});
