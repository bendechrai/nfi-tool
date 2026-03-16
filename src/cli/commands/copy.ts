import type { Command } from "commander";
import { copySecret } from "../../core/secrets.js";
import { checkGitignore } from "../../core/gitignore.js";
import { validateKeyName } from "../../core/validate.js";

export function registerCopyCommand(program: Command): void {
  program
    .command("copy")
    .description("Copy a secret between files without exposing its value")
    .argument("<key>", "Key name in the source file")
    .argument("<source>", "Source file path")
    .argument("<dest>", "Destination file path")
    .option("-p, --path <path>", "Target key path in destination (for structured formats)")
    .option("-f, --format <format>", "Override source format detection")
    .option("--dest-format <format>", "Override destination format detection")
    .option("--overwrite", "Allow overwriting existing keys in destination")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output")
    .action(async (key: string, source: string, dest: string, options) => {
      try {
        validateKeyName(key);
        if (options.path) validateKeyName(options.path);
        await copySecret(key, source, dest, {
          format: options.format,
          destKey: options.path,
          destFormat: options.destFormat,
          overwrite: options.overwrite,
        });

        const gitignoreWarning = await checkGitignore(dest);
        if (gitignoreWarning && !options.quiet) {
          console.warn(gitignoreWarning);
        }

        if (!options.quiet) {
          const targetKey = options.path || key;
          console.log(`Copied ${key} from ${source} to ${dest} as ${targetKey}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
