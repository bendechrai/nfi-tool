import fs from "node:fs/promises";
import path from "node:path";

/**
 * Check if a file path is covered by a .gitignore in its directory tree.
 * Returns a warning message if the file is not ignored, null otherwise.
 */
export async function checkGitignore(filePath: string): Promise<string | null> {
  const absolutePath = path.resolve(filePath);
  const fileName = path.basename(absolutePath);
  let dir = path.dirname(absolutePath);

  // Walk up the directory tree looking for .gitignore files
  const root = path.parse(dir).root;

  while (dir !== root) {
    const gitignorePath = path.join(dir, ".gitignore");
    try {
      const content = await fs.readFile(gitignorePath, "utf-8");
      if (isFileIgnored(content, absolutePath, dir)) {
        return null; // File is ignored
      }
    } catch {
      // No .gitignore in this directory, keep walking up
    }

    // Check if we've hit a git root
    try {
      await fs.access(path.join(dir, ".git"));
      // We're at the git root and haven't found a matching ignore rule
      return `Warning: ${fileName} is not in .gitignore`;
    } catch {
      // Not a git root, keep walking up
    }

    dir = path.dirname(dir);
  }

  // Not in a git repo, no warning needed
  return null;
}

function isFileIgnored(gitignoreContent: string, filePath: string, gitignoreDir: string): boolean {
  const relativePath = path.relative(gitignoreDir, filePath);
  const fileName = path.basename(filePath);
  const lines = gitignoreContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    // Simple pattern matching (covers most common cases)
    const pattern = trimmed.replace(/^\//, "");

    // Exact file name match
    if (pattern === fileName || pattern === relativePath) {
      return true;
    }

    // Wildcard patterns like *.env or .env*
    if (pattern.includes("*")) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      const regex = new RegExp("^" + escaped + "$");
      if (regex.test(fileName) || regex.test(relativePath)) {
        return true;
      }
    }
  }

  return false;
}
