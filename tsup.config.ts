import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig([
  // CLI entry - needs shebang
  {
    entry: {
      "cli/index": "src/cli/index.ts",
    },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Core library + MCP server - no shebang
  {
    entry: {
      "core/index": "src/core/index.ts",
      "mcp/index": "src/mcp/index.ts",
    },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: false,
    splitting: true,
    sourcemap: true,
    dts: true,
    onSuccess: async () => {
      // Copy HTML file to dist
      cpSync("src/ui/page.html", "dist/ui/page.html", { recursive: true });
    },
  },
]);
