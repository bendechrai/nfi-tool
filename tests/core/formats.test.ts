import { describe, it, expect } from "vitest";
import { envHandler } from "../../src/core/formats/env.js";
import { jsonHandler } from "../../src/core/formats/json.js";
import { yamlHandler } from "../../src/core/formats/yaml.js";
import { tomlHandler } from "../../src/core/formats/toml.js";
import { detectFormat } from "../../src/core/formats/detect.js";

describe("detectFormat", () => {
  it("detects .env files", () => {
    expect(detectFormat(".env")).toBe("env");
    expect(detectFormat(".env.local")).toBe("env");
    expect(detectFormat(".env.production")).toBe("env");
    expect(detectFormat("path/to/.env")).toBe("env");
  });

  it("detects JSON files", () => {
    expect(detectFormat("config.json")).toBe("json");
    expect(detectFormat("path/to/settings.json")).toBe("json");
  });

  it("detects YAML files", () => {
    expect(detectFormat("config.yaml")).toBe("yaml");
    expect(detectFormat("config.yml")).toBe("yaml");
  });

  it("detects TOML files", () => {
    expect(detectFormat("config.toml")).toBe("toml");
  });

  it("returns null for unknown formats", () => {
    expect(detectFormat("config.xml")).toBeNull();
    expect(detectFormat("config.txt")).toBeNull();
  });
});

describe("envHandler", () => {
  const sample = `# Database config
DB_HOST=localhost
DB_PORT=5432
DB_PASSWORD="my secret"

# API keys
API_KEY=sk_test_123
`;

  it("parses key-value pairs", () => {
    const result = envHandler.parse(sample);
    expect(result).toEqual({
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_PASSWORD: "my secret",
      API_KEY: "sk_test_123",
    });
  });

  it("checks if key exists", () => {
    expect(envHandler.has(sample, "DB_HOST")).toBe(true);
    expect(envHandler.has(sample, "MISSING")).toBe(false);
  });

  it("gets a value", () => {
    expect(envHandler.get(sample, "DB_HOST")).toBe("localhost");
    expect(envHandler.get(sample, "DB_PASSWORD")).toBe("my secret");
    expect(envHandler.get(sample, "MISSING")).toBeUndefined();
  });

  it("lists keys", () => {
    expect(envHandler.keys(sample)).toEqual([
      "DB_HOST",
      "DB_PORT",
      "DB_PASSWORD",
      "API_KEY",
    ]);
  });

  it("sets a new key", () => {
    const result = envHandler.set(sample, "NEW_KEY", "new_value");
    expect(result).toContain("NEW_KEY=new_value");
    expect(envHandler.get(result, "NEW_KEY")).toBe("new_value");
    // Preserves existing content
    expect(envHandler.get(result, "DB_HOST")).toBe("localhost");
  });

  it("updates an existing key", () => {
    const result = envHandler.set(sample, "DB_HOST", "remotehost");
    expect(envHandler.get(result, "DB_HOST")).toBe("remotehost");
    // Preserves comments
    expect(result).toContain("# Database config");
  });

  it("quotes values with special characters", () => {
    const result = envHandler.set("", "KEY", "has spaces");
    expect(result).toContain('KEY="has spaces"');
  });

  it("removes a key", () => {
    const result = envHandler.remove(sample, "DB_PORT");
    expect(envHandler.has(result, "DB_PORT")).toBe(false);
    expect(envHandler.has(result, "DB_HOST")).toBe(true);
    // Preserves comments
    expect(result).toContain("# Database config");
  });

  it("handles empty content", () => {
    expect(envHandler.parse("")).toEqual({});
    expect(envHandler.keys("")).toEqual([]);
    const result = envHandler.set("", "KEY", "value");
    expect(envHandler.get(result, "KEY")).toBe("value");
  });

  it("strips inline comments from unquoted values", () => {
    const content = "API_KEY=test123 # my api key\n";
    expect(envHandler.get(content, "API_KEY")).toBe("test123");
  });

  it("preserves hash in quoted values", () => {
    const content = 'API_KEY="test#123"\n';
    expect(envHandler.get(content, "API_KEY")).toBe("test#123");
  });

  it("handles export prefix", () => {
    const content = "export DB_HOST=localhost\nexport DB_PORT=5432\n";
    expect(envHandler.get(content, "DB_HOST")).toBe("localhost");
    expect(envHandler.get(content, "DB_PORT")).toBe("5432");
    expect(envHandler.keys(content)).toEqual(["DB_HOST", "DB_PORT"]);
  });

  it("handles quoted values with trailing comments", () => {
    const content = 'DB_PASSWORD="secret123" # database password\n';
    expect(envHandler.get(content, "DB_PASSWORD")).toBe("secret123");
  });

  it("handles single-quoted values with trailing comments", () => {
    const content = "DB_PASSWORD='secret123' # database password\n";
    expect(envHandler.get(content, "DB_PASSWORD")).toBe("secret123");
  });

  it("handles values with equals signs", () => {
    const content = 'CONNECTION="postgres://user:pass@host/db?sslmode=require"\n';
    expect(envHandler.get(content, "CONNECTION")).toBe("postgres://user:pass@host/db?sslmode=require");
  });

  it("escapes newlines in values", () => {
    const result = envHandler.set("", "KEY", "line1\nline2");
    expect(result).toContain('KEY="line1\\nline2"');
    expect(result).not.toContain("\nline2");
  });
});

describe("jsonHandler", () => {
  const sample = JSON.stringify(
    {
      database: {
        host: "localhost",
        port: 5432,
        password: "secret",
      },
      api: {
        key: "sk_test_123",
      },
    },
    null,
    2,
  );

  it("parses to flat key-value pairs", () => {
    const result = jsonHandler.parse(sample);
    expect(result["database.host"]).toBe("localhost");
    expect(result["database.port"]).toBe("5432");
    expect(result["database.password"]).toBe("secret");
    expect(result["api.key"]).toBe("sk_test_123");
  });

  it("gets nested values via dot notation", () => {
    expect(jsonHandler.get(sample, "database.host")).toBe("localhost");
    expect(jsonHandler.get(sample, "database.password")).toBe("secret");
    expect(jsonHandler.get(sample, "missing.key")).toBeUndefined();
  });

  it("checks existence", () => {
    expect(jsonHandler.has(sample, "database.host")).toBe(true);
    expect(jsonHandler.has(sample, "missing")).toBe(false);
  });

  it("lists leaf paths", () => {
    const keys = jsonHandler.keys(sample);
    expect(keys).toEqual([
      "database.host",
      "database.port",
      "database.password",
      "api.key",
    ]);
  });

  it("lists keys with depth limit", () => {
    const keys = jsonHandler.keys(sample, 1);
    expect(keys).toEqual(["database", "api"]);
  });

  it("sets a nested value", () => {
    const result = jsonHandler.set(sample, "database.password", "new_secret");
    expect(jsonHandler.get(result, "database.password")).toBe("new_secret");
    expect(jsonHandler.get(result, "database.host")).toBe("localhost");
  });

  it("creates intermediate objects", () => {
    const result = jsonHandler.set(sample, "redis.url", "redis://localhost");
    expect(jsonHandler.get(result, "redis.url")).toBe("redis://localhost");
  });

  it("removes a nested key", () => {
    const result = jsonHandler.remove(sample, "database.password");
    expect(jsonHandler.has(result, "database.password")).toBe(false);
    expect(jsonHandler.has(result, "database.host")).toBe(true);
  });

  it("preserves indentation", () => {
    const result = jsonHandler.set(sample, "new.key", "value");
    // Original uses 2-space indent
    expect(result).toContain('  "new"');
  });
});

describe("yamlHandler", () => {
  const sample = `database:
  host: localhost
  port: 5432
  password: secret
api:
  key: sk_test_123
`;

  it("parses to flat key-value pairs", () => {
    const result = yamlHandler.parse(sample);
    expect(result["database.host"]).toBe("localhost");
    expect(result["database.port"]).toBe("5432");
    expect(result["api.key"]).toBe("sk_test_123");
  });

  it("gets nested values", () => {
    expect(yamlHandler.get(sample, "database.host")).toBe("localhost");
    expect(yamlHandler.get(sample, "missing")).toBeUndefined();
  });

  it("checks existence", () => {
    expect(yamlHandler.has(sample, "database.password")).toBe(true);
    expect(yamlHandler.has(sample, "missing")).toBe(false);
  });

  it("lists leaf paths", () => {
    const keys = yamlHandler.keys(sample);
    expect(keys).toContain("database.host");
    expect(keys).toContain("api.key");
  });

  it("sets a nested value", () => {
    const result = yamlHandler.set(sample, "database.password", "new_secret");
    expect(yamlHandler.get(result, "database.password")).toBe("new_secret");
  });

  it("removes a key", () => {
    const result = yamlHandler.remove(sample, "database.password");
    expect(yamlHandler.has(result, "database.password")).toBe(false);
    expect(yamlHandler.has(result, "database.host")).toBe(true);
  });
});

describe("tomlHandler", () => {
  const sample = `[database]
host = "localhost"
port = 5432
password = "secret"

[api]
key = "sk_test_123"
`;

  it("parses to flat key-value pairs", () => {
    const result = tomlHandler.parse(sample);
    expect(result["database.host"]).toBe("localhost");
    expect(result["database.port"]).toBe("5432");
    expect(result["api.key"]).toBe("sk_test_123");
  });

  it("gets nested values", () => {
    expect(tomlHandler.get(sample, "database.host")).toBe("localhost");
    expect(tomlHandler.get(sample, "missing")).toBeUndefined();
  });

  it("checks existence", () => {
    expect(tomlHandler.has(sample, "database.password")).toBe(true);
    expect(tomlHandler.has(sample, "missing")).toBe(false);
  });

  it("sets a value", () => {
    const result = tomlHandler.set(sample, "database.password", "new_secret");
    expect(tomlHandler.get(result, "database.password")).toBe("new_secret");
  });

  it("removes a key", () => {
    const result = tomlHandler.remove(sample, "database.password");
    expect(tomlHandler.has(result, "database.password")).toBe(false);
    expect(tomlHandler.has(result, "database.host")).toBe(true);
  });
});
