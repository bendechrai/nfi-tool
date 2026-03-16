import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const exec = promisify(execFile);
const CLI = path.resolve("dist/cli/index.js");

function run(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return exec("node", [CLI, ...args]);
}

function runExpectFail(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile("node", [CLI, ...args], (err, stdout, stderr) => {
      const exitCode = err && "code" in err && typeof err.code === "number"
        ? err.code
        : 1;
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        code: exitCode,
      });
    });
  });
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nfi-cli-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("CLI --help", () => {
  it("shows help", async () => {
    const { stdout } = await run(["--help"]);
    expect(stdout).toContain("Handle sensitive information");
    expect(stdout).toContain("set");
    expect(stdout).toContain("has");
    expect(stdout).toContain("keys");
    expect(stdout).toContain("generate");
  });
});

describe("CLI generate", () => {
  it("generates a secret to a new file", async () => {
    const file = path.join(tmpDir, ".env");
    const { stdout } = await run(["generate", "SECRET", file]);
    expect(stdout).toContain("Generated and wrote SECRET");

    const content = await fs.readFile(file, "utf-8");
    expect(content).toMatch(/^SECRET=[a-f0-9]+$/m);
  });

  it("generates with template", async () => {
    const file = path.join(tmpDir, ".env");
    const { stdout } = await run(["generate", "KEY", file, "--template", "uuid"]);
    expect(stdout).toContain("UUID");

    const content = await fs.readFile(file, "utf-8");
    expect(content).toMatch(/KEY=[0-9a-f-]+/);
  });

  it("dry-run does not write", async () => {
    const file = path.join(tmpDir, ".env");
    const { stdout } = await run(["generate", "KEY", file, "--dry-run"]);
    expect(stdout).toContain("Would generate");

    await expect(fs.access(file)).rejects.toThrow();
  });
});

describe("CLI keys", () => {
  it("lists keys from env file", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "A=1\nB=2\nC=3\n");

    const { stdout } = await run(["keys", file]);
    expect(stdout.trim()).toBe("A\nB\nC");
  });

  it("lists keys from JSON file", async () => {
    const file = path.join(tmpDir, "config.json");
    await fs.writeFile(file, JSON.stringify({ x: { y: 1 }, z: 2 }));

    const { stdout } = await run(["keys", file]);
    expect(stdout.trim()).toBe("x.y\nz");
  });
});

describe("CLI has", () => {
  it("exits 0 for existing key", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "KEY=value\n");

    const { stdout } = await run(["has", "KEY", file]);
    expect(stdout).toContain("exists");
    expect(stdout).toContain("non-empty");
  });

  it("exits non-zero for missing key", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "OTHER=value\n");

    await expect(run(["has", "MISSING", file])).rejects.toThrow();
  });
});

describe("CLI remove", () => {
  it("removes a key", async () => {
    const file = path.join(tmpDir, ".env");
    await fs.writeFile(file, "A=1\nB=2\nC=3\n");

    const { stdout } = await run(["remove", "B", file]);
    expect(stdout).toContain("Removed B");

    const content = await fs.readFile(file, "utf-8");
    expect(content).not.toContain("B=");
    expect(content).toContain("A=1");
    expect(content).toContain("C=3");
  });
});

describe("CLI diff", () => {
  it("shows missing keys", async () => {
    const file1 = path.join(tmpDir, "a.env");
    const file2 = path.join(tmpDir, "b.env");
    await fs.writeFile(file1, "A=1\nB=2\n");
    await fs.writeFile(file2, "B=x\nC=y\n");

    const { stdout } = await run(["diff", file1, file2]);
    expect(stdout).toContain("Missing from");
    expect(stdout).toContain("C");
    expect(stdout).toContain("A");
  });
});

describe("CLI copy", () => {
  it("copies a key between files", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await fs.writeFile(source, "SECRET=hidden_value\n");

    const { stdout } = await run(["copy", "SECRET", source, dest]);
    expect(stdout).toContain("Copied SECRET");

    const content = await fs.readFile(dest, "utf-8");
    expect(content).toContain("SECRET=hidden_value");
  });

  it("copies with --path rename", async () => {
    const source = path.join(tmpDir, "source.env");
    const dest = path.join(tmpDir, "dest.env");
    await fs.writeFile(source, "OLD=value\n");

    const { stdout } = await run(["copy", "OLD", source, dest, "--path", "NEW"]);
    expect(stdout).toContain("Copied OLD");
    expect(stdout).toContain("as NEW");

    const content = await fs.readFile(dest, "utf-8");
    expect(content).toContain("NEW=value");
  });
});
