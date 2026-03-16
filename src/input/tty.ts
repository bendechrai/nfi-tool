import fs from "node:fs";
import readline from "node:readline";

/**
 * Prompt for a secret value directly from /dev/tty, bypassing stdin/stdout
 * that the AI controls. Errors if /dev/tty is not available rather than
 * falling back to process.stdin (which would leak the secret to the AI).
 */
export async function promptTTY(key: string): Promise<string> {
  let ttyFd: number;

  try {
    ttyFd = fs.openSync("/dev/tty", "r+");
  } catch {
    throw new Error(
      "Cannot open /dev/tty for secure input. " +
      "This environment does not support direct terminal access. " +
      "Use the browser-based input method instead.",
    );
  }

  const ttyStream = fs.createReadStream("", { fd: ttyFd });
  const ttyWriteStream = fs.createWriteStream("", { fd: ttyFd });

  const rl = readline.createInterface({
    input: ttyStream,
    output: ttyWriteStream,
    terminal: true,
  });

  return new Promise<string>((resolve, reject) => {
    // Disable echo for password-like input
    ttyWriteStream.write(`Enter value for ${key}: `);
    const rawInput = ttyStream as NodeJS.ReadableStream & { setRawMode?: (mode: boolean) => void };
    if (rawInput.setRawMode) {
      rawInput.setRawMode(true);
    }

    let value = "";

    if (rawInput.setRawMode) {
      // Manual character collection for masked input
      ttyStream.on("data", function handler(chunk: Buffer) {
        const char = chunk.toString();

        if (char === "\n" || char === "\r") {
          ttyStream.removeListener("data", handler);
          if (rawInput.setRawMode) {
            rawInput.setRawMode(false);
          }
          ttyWriteStream.write("\n");
          rl.close();
          fs.closeSync(ttyFd);
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          // Backspace
          if (value.length > 0) {
            value = value.slice(0, -1);
          }
          return;
        }

        if (char === "\u0003") {
          // Ctrl+C
          rl.close();
          fs.closeSync(ttyFd);
          reject(new Error("User cancelled input"));
          return;
        }

        value += char;
      });
    } else {
      // Terminal without raw mode support - use readline question
      rl.question("", (answer) => {
        rl.close();
        fs.closeSync(ttyFd);
        resolve(answer);
      });
    }
  });
}
