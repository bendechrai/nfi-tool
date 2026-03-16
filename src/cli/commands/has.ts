import type { Command } from "commander";
import { hasSecret } from "../../core/secrets.js";
import { validateKeyName } from "../../core/validate.js";

export function registerHasCommand(program: Command): void {
  program
    .command("has")
    .description("Check if a key exists in a file (exit code 0 if found, 1 if not)")
    .argument("<key>", "Key name to check")
    .argument("<file>", "File to check in")
    .option("-f, --format <format>", "Override format detection")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output (exit code only)")
    .action(async (key: string, file: string, options) => {
      try {
        validateKeyName(key);
        const result = await hasSecret(file, key, { format: options.format });

        if (result.exists) {
          if (!options.quiet) {
            if (result.hasValue) {
              console.log(`${key} exists in ${file} and has a non-empty value`);
            } else {
              console.log(`${key} exists in ${file} but has an empty value`);
            }
          }
          process.exit(0);
        } else {
          if (!options.quiet) {
            console.log(`${key} is not set in ${file}`);
          }
          process.exit(1);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(2);
      }
    });
}
