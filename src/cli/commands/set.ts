import type { Command } from "commander";
import { setSecret, hasSecret } from "../../core/secrets.js";
import { resolveHandler } from "../../core/formats/index.js";
import { checkGitignore } from "../../core/gitignore.js";
import { collectSecrets } from "../../input/resolve.js";
import { loadConfig } from "../../config/index.js";
import { validateKeyName } from "../../core/validate.js";

export function registerSetCommand(program: Command): void {
  program
    .command("set")
    .description("Prompt for secret value(s) and write to a file")
    .argument("<file>", "Target file path")
    .argument("<keys...>", "Key name(s) to set")
    .option("-f, --format <format>", "Override format detection (env, json, yaml, toml)")
    .option("--overwrite", "Allow overwriting existing keys")
    .option("--timeout <ms>", "Browser prompt timeout in milliseconds")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output (exit code only)")
    .action(async (file: string, keys: string[], options) => {

      const config = await loadConfig();
      const timeout = options.timeout ? parseInt(options.timeout, 10) : config.timeout;
      const overwrite = options.overwrite || config.overwriteByDefault;

      // Validate keys and format before prompting
      try {
        for (const key of keys) {
          validateKeyName(key);
        }
        resolveHandler(file, options.format);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      // Check which keys already exist
      const existingKeys: string[] = [];
      try {
        for (const key of keys) {
          const result = await hasSecret(file, key, { format: options.format });
          if (result.exists) {
            existingKeys.push(key);
          }
        }
      } catch {
        // File might not exist yet, that's fine
      }

      // Collect secrets
      try {
        const result = await collectSecrets({
          keys,
          file,
          existingKeys,
          timeout,
          method: config.inputMethod,
        });

        if (result.url) {
          if (!options.quiet) {
            console.log(`Open this URL to enter your secrets: ${result.url}`);
          }
          // Wait for values - this shouldn't happen in the CLI flow
          // as collectSecrets waits for completion
        }

        // Write each collected value
        let count = 0;
        for (const [key, value] of Object.entries(result.values)) {
          try {
            const { created } = await setSecret(file, key, value, {
              format: options.format,
              overwrite: true, // User explicitly provided values via the UI
            });
            count++;
            if (options.verbose) {
              console.log(`${created ? "Created" : "Updated"} ${key} in ${file}`);
            }
          } catch (err) {
            console.error(`Error writing ${key}: ${(err as Error).message}`);
          }
        }

        // Gitignore check
        const gitignoreWarning = await checkGitignore(file);
        if (gitignoreWarning && !options.quiet) {
          console.warn(gitignoreWarning);
        }

        if (!options.quiet) {
          console.log(`Wrote ${count} secret${count !== 1 ? "s" : ""} to ${file}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
