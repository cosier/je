/**
 * Git repository utilities for the je tool
 */
import { join, dirname } from "jsr:@std/path";
import { exists } from "jsr:@std/fs";

/**
 * Find the root directory of the current git repository
 * @param startDir Directory to start the search from (defaults to current directory)
 * @returns The absolute path to the git repository root
 */
export async function findGitRoot(startDir: string = Deno.cwd()): Promise<string> {
  let currentDir = startDir;

  while (true)
  {
    const gitDir = join(currentDir, ".git");
    if (await exists(gitDir))
    {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir)
    {
      throw new Error("Could not find git repository root");
    }

    currentDir = parentDir;
  }
}
