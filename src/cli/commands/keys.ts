import type { Command } from "commander";
import { listKeys } from "../../core/secrets.js";

export function registerKeysCommand(program: Command): void {
  program
    .command("keys")
    .description("List all key names in a file (no values shown)")
    .argument("<file>", "File to list keys from")
    .option("-f, --format <format>", "Override format detection")
    .option("-d, --depth <depth>", "Limit depth for structured formats")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output")
    .action(async (file: string, options) => {
      try {
        const depth = options.depth ? parseInt(options.depth, 10) : undefined;
        const keys = await listKeys(file, { format: options.format, depth });

        if (!options.quiet) {
          for (const key of keys) {
            console.log(key);
          }
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
