import { createRequire } from "node:module";
import { Command } from "commander";
import { registerSetCommand } from "./commands/set.js";
import { registerHasCommand } from "./commands/has.js";
import { registerKeysCommand } from "./commands/keys.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerCopyCommand } from "./commands/copy.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerMcpCommand } from "./commands/mcp.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const program = new Command();

program
  .name("nfi")
  .description("Handle sensitive information without exposing values to AI assistants")
  .version(version);

registerSetCommand(program);
registerHasCommand(program);
registerKeysCommand(program);
registerDiffCommand(program);
registerRemoveCommand(program);
registerCopyCommand(program);
registerGenerateCommand(program);
registerMcpCommand(program);

program.parse();
