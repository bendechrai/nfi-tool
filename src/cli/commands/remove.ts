import type { Command } from "commander";
import { removeSecret } from "../../core/secrets.js";
import { validateKeyName } from "../../core/validate.js";

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove")
    .description("Remove a key and its value from a file")
    .argument("<key>", "Key name to remove")
    .argument("<file>", "File to remove from")
    .option("-f, --format <format>", "Override format detection")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output")
    .action(async (key: string, file: string, options) => {
      try {
        validateKeyName(key);
        await removeSecret(file, key, { format: options.format });

        if (!options.quiet) {
          console.log(`Removed ${key} from ${file}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
