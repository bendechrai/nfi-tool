import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { checkGitignore } from "../../src/core/gitignore.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nfi-gitignore-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("checkGitignore", () => {
  it("returns null when file is covered by exact match in .gitignore", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    await fs.writeFile(path.join(tmpDir, ".gitignore"), ".env\n");
    const filePath = path.resolve(tmpDir, ".env");
    await fs.writeFile(filePath, "SECRET=abc");

    expect(await checkGitignore(filePath)).toBeNull();
  });

  it("returns null when file is covered by wildcard pattern (*.env)", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    await fs.writeFile(path.join(tmpDir, ".gitignore"), "*.env\n");
    const filePath = path.resolve(tmpDir, "production.env");
    await fs.writeFile(filePath, "SECRET=abc");

    expect(await checkGitignore(filePath)).toBeNull();
  });

  it("returns null when file is covered by prefix wildcard (.env*)", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    await fs.writeFile(path.join(tmpDir, ".gitignore"), ".env*\n");
    const filePath = path.resolve(tmpDir, ".env.local");
    await fs.writeFile(filePath, "SECRET=abc");

    expect(await checkGitignore(filePath)).toBeNull();
  });

  it("returns warning when file is NOT in .gitignore but is in a git repo", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    await fs.writeFile(path.join(tmpDir, ".gitignore"), "other-file\n");
    const filePath = path.resolve(tmpDir, ".env");
    await fs.writeFile(filePath, "SECRET=abc");

    expect(await checkGitignore(filePath)).toBe("Warning: .env is not in .gitignore");
  });

  it("returns warning when there is no .gitignore at all in a git repo", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    const filePath = path.resolve(tmpDir, ".env");
    await fs.writeFile(filePath, "SECRET=abc");

    expect(await checkGitignore(filePath)).toBe("Warning: .env is not in .gitignore");
  });

  it("returns null when not in a git repo at all", async () => {
    const filePath = path.resolve(tmpDir, ".env");
    await fs.writeFile(filePath, "SECRET=abc");

    expect(await checkGitignore(filePath)).toBeNull();
  });
});
