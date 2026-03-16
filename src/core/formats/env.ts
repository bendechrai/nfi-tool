import type { FormatHandler } from "./types.js";

interface EnvLine {
  type: "entry" | "comment" | "blank";
  raw: string;
  key?: string;
  value?: string;
}

function parseLines(content: string): EnvLine[] {
  const lines = content.split("\n");
  return lines.map((raw) => {
    const trimmed = raw.trim();

    if (trimmed === "") {
      return { type: "blank", raw };
    }

    if (trimmed.startsWith("#")) {
      return { type: "comment", raw };
    }

    // Strip optional "export " prefix
    const stripped = trimmed.startsWith("export ")
      ? trimmed.slice(7)
      : trimmed;

    const eqIndex = stripped.indexOf("=");
    if (eqIndex === -1) {
      return { type: "comment", raw };
    }

    const key = stripped.slice(0, eqIndex).trim();
    let value = stripped.slice(eqIndex + 1);

    // Handle quoted values - find matching closing quote first
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      const closeIndex = value.indexOf(quote, 1);
      if (closeIndex !== -1) {
        value = value.slice(1, closeIndex);
      }
    } else {
      // Strip inline comments for unquoted values
      const hashIndex = value.indexOf(" #");
      if (hashIndex !== -1) {
        value = value.slice(0, hashIndex);
      }
      value = value.trim();
    }

    return { type: "entry", raw, key, value };
  });
}

function reconstructContent(lines: EnvLine[]): string {
  return lines.map((l) => l.raw).join("\n");
}

export const envHandler: FormatHandler = {
  parse(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of parseLines(content)) {
      if (line.type === "entry" && line.key !== undefined) {
        result[line.key] = line.value ?? "";
      }
    }
    return result;
  },

  get(content: string, key: string): string | undefined {
    const entries = this.parse(content);
    return entries[key];
  },

  has(content: string, key: string): boolean {
    return this.get(content, key) !== undefined;
  },

  keys(content: string, _depth?: number): string[] {
    // .env files are flat, depth is irrelevant
    return Object.keys(this.parse(content));
  },

  set(content: string, key: string, value: string): string {
    const lines = parseLines(content);
    // Escape newlines and check if quoting is needed
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    const needsQuotes = value.includes(" ") || value.includes("=") || value.includes('"') || value.includes("'") || value.includes("\n") || value.includes("\r") || value.includes("#");
    const formattedValue = needsQuotes ? `"${escaped}"` : value;
    const newLine = `${key}=${formattedValue}`;

    // Find existing entry and replace
    const existingIndex = lines.findIndex(
      (l) => l.type === "entry" && l.key === key,
    );

    if (existingIndex !== -1) {
      lines[existingIndex] = { type: "entry", raw: newLine, key, value };
      return reconstructContent(lines);
    }

    // Append to end
    const hasTrailingNewline = content.endsWith("\n");
    if (hasTrailingNewline) {
      return content + newLine + "\n";
    }
    return (content === "" ? "" : content + "\n") + newLine + "\n";
  },

  remove(content: string, key: string): string {
    const lines = parseLines(content);
    const filtered = lines.filter(
      (l) => !(l.type === "entry" && l.key === key),
    );
    return reconstructContent(filtered);
  },
};
