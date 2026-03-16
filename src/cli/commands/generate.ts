import type { Command } from "commander";
import { generateSecret, describeTemplate, AVAILABLE_TEMPLATES } from "../../core/generate.js";
import { checkGitignore } from "../../core/gitignore.js";
import { loadConfig } from "../../config/index.js";
import { validateKeyName } from "../../core/validate.js";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate a random secret and write it to a file")
    .argument("<key>", "Key name for the generated secret")
    .argument("<file>", "Target file path")
    .option("-t, --template <template>", "Generation template (e.g., hex:64, base64:32, uuid)")
    .option("-f, --format <format>", "Override format detection")
    .option("--overwrite", "Allow overwriting existing keys")
    .option("--dry-run", "Show what would be generated without writing")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output")
    .action(async (key: string, file: string, options) => {
      try {
        validateKeyName(key);
        const config = await loadConfig();
        const template = options.template || config.generateTemplate;

        if (options.dryRun) {
          const description = describeTemplate(template);
          console.log(`Would generate: ${description}`);
          console.log(`Would write to: ${file} as ${key}`);
          console.log("\nAvailable templates:");
          for (const t of AVAILABLE_TEMPLATES) {
            console.log(`  ${t.name.padEnd(25)} ${t.description}`);
          }
          return;
        }

        const { description } = await generateSecret(file, key, template, {
          format: options.format,
          overwrite: options.overwrite,
        });

        // Gitignore check
        const gitignoreWarning = await checkGitignore(file);
        if (gitignoreWarning && !options.quiet) {
          console.warn(gitignoreWarning);
        }

        if (!options.quiet) {
          console.log(`Generated and wrote ${key} to ${file} (${description})`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
