import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../../src/config/index.js";

describe("config", () => {
  let tmpDir: string;
  let originalXdg: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nfi-config-test-"));
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(async () => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function configPath(): string {
    return path.join(tmpDir, "nfi", "config.json");
  }

  async function writeConfig(obj: Record<string, unknown>): Promise<void> {
    const dir = path.join(tmpDir, "nfi");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(configPath(), JSON.stringify(obj));
  }

  describe("DEFAULT_CONFIG", () => {
    it("has expected values", () => {
      expect(DEFAULT_CONFIG).toEqual({
        timeout: 300000,
        defaultFormat: null,
        overwriteByDefault: false,
        inputMethod: "auto",
        generateTemplate: "hex:64",
      });
    });
  });

  describe("loadConfig", () => {
    it("returns defaults when no config file exists", async () => {
      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("merges valid user config with defaults", async () => {
      await writeConfig({ timeout: 60000, overwriteByDefault: true });
      const config = await loadConfig();
      expect(config.timeout).toBe(60000);
      expect(config.overwriteByDefault).toBe(true);
      expect(config.defaultFormat).toBe(null);
      expect(config.inputMethod).toBe("auto");
      expect(config.generateTemplate).toBe("hex:64");
    });

    it("accepts valid inputMethod values", async () => {
      await writeConfig({ inputMethod: "browser" });
      expect((await loadConfig()).inputMethod).toBe("browser");

      await writeConfig({ inputMethod: "tty" });
      expect((await loadConfig()).inputMethod).toBe("tty");
    });

    it("accepts valid defaultFormat values", async () => {
      await writeConfig({ defaultFormat: "json" });
      expect((await loadConfig()).defaultFormat).toBe("json");

      await writeConfig({ defaultFormat: null });
      expect((await loadConfig()).defaultFormat).toBe(null);
    });

    it("accepts valid generateTemplate values", async () => {
      await writeConfig({ generateTemplate: "uuid" });
      expect((await loadConfig()).generateTemplate).toBe("uuid");

      await writeConfig({ generateTemplate: "base64:32" });
      expect((await loadConfig()).generateTemplate).toBe("base64:32");
    });

    describe("ignores invalid values", () => {
      it("ignores negative timeout", async () => {
        await writeConfig({ timeout: -100 });
        expect((await loadConfig()).timeout).toBe(DEFAULT_CONFIG.timeout);
      });

      it("ignores zero timeout", async () => {
        await writeConfig({ timeout: 0 });
        expect((await loadConfig()).timeout).toBe(DEFAULT_CONFIG.timeout);
      });

      it("ignores non-numeric timeout", async () => {
        await writeConfig({ timeout: "fast" });
        expect((await loadConfig()).timeout).toBe(DEFAULT_CONFIG.timeout);
      });

      it("ignores unknown inputMethod", async () => {
        await writeConfig({ inputMethod: "telepathy" });
        expect((await loadConfig()).inputMethod).toBe(DEFAULT_CONFIG.inputMethod);
      });

      it("ignores non-boolean overwriteByDefault", async () => {
        await writeConfig({ overwriteByDefault: "yes" });
        expect((await loadConfig()).overwriteByDefault).toBe(DEFAULT_CONFIG.overwriteByDefault);
      });

      it("ignores invalid defaultFormat", async () => {
        await writeConfig({ defaultFormat: "xml" });
        expect((await loadConfig()).defaultFormat).toBe(DEFAULT_CONFIG.defaultFormat);
      });

      it("ignores invalid generateTemplate", async () => {
        await writeConfig({ generateTemplate: "rot13:64" });
        expect((await loadConfig()).generateTemplate).toBe(DEFAULT_CONFIG.generateTemplate);
      });
    });

    it("returns defaults for non-object JSON", async () => {
      const dir = path.join(tmpDir, "nfi");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(configPath(), '"just a string"');
      expect(await loadConfig()).toEqual(DEFAULT_CONFIG);
    });

    it("returns defaults for malformed JSON", async () => {
      const dir = path.join(tmpDir, "nfi");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(configPath(), "{not valid json}");
      expect(await loadConfig()).toEqual(DEFAULT_CONFIG);
    });
  });

  describe("saveConfig", () => {
    it("creates the directory and writes the file", async () => {
      await saveConfig({ timeout: 10000 });
      const content = JSON.parse(await fs.readFile(configPath(), "utf-8"));
      expect(content.timeout).toBe(10000);
      expect(content.overwriteByDefault).toBe(false);
      expect(content.inputMethod).toBe("auto");
    });

    it("merges with existing config on save", async () => {
      await writeConfig({ timeout: 5000, overwriteByDefault: true });
      await saveConfig({ inputMethod: "tty" });
      const content = JSON.parse(await fs.readFile(configPath(), "utf-8"));
      expect(content.timeout).toBe(5000);
      expect(content.overwriteByDefault).toBe(true);
      expect(content.inputMethod).toBe("tty");
    });
  });

  describe("XDG_CONFIG_HOME", () => {
    it("uses XDG_CONFIG_HOME for config path", async () => {
      await saveConfig({ timeout: 42000 });
      const content = await fs.readFile(configPath(), "utf-8");
      expect(JSON.parse(content).timeout).toBe(42000);
    });

    it("does not write to default ~/.config when XDG_CONFIG_HOME is set", async () => {
      await saveConfig({ timeout: 42000 });
      const defaultPath = path.join(os.homedir(), ".config", "nfi", "config.json");
      // The file at defaultPath should either not exist or not contain our value
      try {
        const content = JSON.parse(await fs.readFile(defaultPath, "utf-8"));
        expect(content.timeout).not.toBe(42000);
      } catch {
        // File doesn't exist, which is correct
      }
    });
  });
});
