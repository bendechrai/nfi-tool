import type { Command } from "commander";
import { diffKeys } from "../../core/secrets.js";

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Show keys present in one file but not the other")
    .argument("<file1>", "First file")
    .argument("<file2>", "Second file")
    .option("-f, --format <format>", "Override format detection (both files)")
    .option("-v, --verbose", "Show detailed output")
    .option("-q, --quiet", "Suppress output")
    .action(async (file1: string, file2: string, options) => {
      try {
        const result = await diffKeys(file1, file2, { format: options.format });

        if (options.quiet) {
          const hasDiff = result.missingFrom1.length > 0 || result.missingFrom2.length > 0;
          process.exit(hasDiff ? 1 : 0);
          return;
        }

        if (result.missingFrom1.length === 0 && result.missingFrom2.length === 0) {
          console.log("Both files have the same keys.");
          return;
        }

        if (result.missingFrom1.length > 0) {
          console.log(`Missing from ${file1}:`);
          for (const key of result.missingFrom1) {
            console.log(`  ${key}`);
          }
        }

        if (result.missingFrom2.length > 0) {
          console.log(`Missing from ${file2}:`);
          for (const key of result.missingFrom2) {
            console.log(`  ${key}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
