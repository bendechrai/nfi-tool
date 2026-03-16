import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface McpClientConfig {
  name: string;
  configPath: string;
  serverKey: string;
}

function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  }
  // Linux
  return path.join(os.homedir(), ".config", "claude", "claude_desktop_config.json");
}

function getCursorConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Cursor", "mcp.json");
  }
  if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "Cursor", "mcp.json");
  }
  return path.join(os.homedir(), ".config", "cursor", "mcp.json");
}

const CLIENTS: Record<string, McpClientConfig> = {
  "claude-desktop": {
    name: "Claude Desktop",
    configPath: getClaudeDesktopConfigPath(),
    serverKey: "mcpServers",
  },
  cursor: {
    name: "Cursor",
    configPath: getCursorConfigPath(),
    serverKey: "mcpServers",
  },
};

async function detectClients(): Promise<McpClientConfig[]> {
  const found: McpClientConfig[] = [];
  for (const client of Object.values(CLIENTS)) {
    try {
      await fs.access(path.dirname(client.configPath));
      found.push(client);
    } catch {
      // Client not installed
    }
  }
  return found;
}

export function registerMcpCommand(program: Command): void {
  const mcp = program
    .command("mcp")
    .description("MCP server management");

  mcp
    .command("install")
    .description("Register nfi as an MCP server in a supported client")
    .option("--client <client>", "Client to configure (claude-desktop, cursor)")
    .action(async (options) => {
      try {
        let client: McpClientConfig;

        if (options.client) {
          client = CLIENTS[options.client];
          if (!client) {
            console.error(`Unknown client: ${options.client}. Available: ${Object.keys(CLIENTS).join(", ")}`);
            process.exit(1);
          }
        } else {
          const detected = await detectClients();
          if (detected.length === 0) {
            console.error("No supported MCP clients detected. Use --client to specify one.");
            process.exit(1);
          }
          if (detected.length > 1) {
            console.log("Multiple clients detected:");
            for (const c of detected) {
              console.log(`  ${c.name}`);
            }
            console.log("Use --client to specify which one.");
            process.exit(1);
          }
          client = detected[0];
        }

        // Read or create config file
        let config: Record<string, unknown> = {};
        try {
          const content = await fs.readFile(client.configPath, "utf-8");
          config = JSON.parse(content);
        } catch {
          // File doesn't exist or isn't valid JSON
        }

        // Add nfi server config
        const servers = (config[client.serverKey] || {}) as Record<string, unknown>;

        // Determine the command to run the MCP server
        const nfiBin = process.argv[1];
        const command = nfiBin.endsWith(".ts") ? "npx" : "node";
        const args = command === "npx" ? ["nfi-tools", "mcp", "serve"] : [nfiBin, "mcp", "serve"];

        servers["nfi"] = {
          command,
          args,
        };

        config[client.serverKey] = servers;

        // Write config
        await fs.mkdir(path.dirname(client.configPath), { recursive: true });
        await fs.writeFile(client.configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

        console.log(`Registered nfi MCP server in ${client.name}`);
        console.log(`Config file: ${client.configPath}`);
        console.log("\nRestart the client for changes to take effect.");
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  mcp
    .command("serve")
    .description("Run the nfi MCP server (called by MCP clients)")
    .action(async () => {
      // Dynamic import to avoid loading MCP SDK for non-MCP commands
      const { startMcpServer } = await import("../../mcp/index.js");
      await startMcpServer();
    });
}
