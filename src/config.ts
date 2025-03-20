/**
 * Configuration file handler for the je tool
 */
import { parse as parseJsonc } from "jsr:@std/jsonc";
import { exists } from "jsr:@std/fs";
import { join } from "jsr:@std/path";
import { findGitRoot } from "./git.ts";

/**
 * Find the config file in the git root directory
 * @returns The path to the config file
 */
export async function findConfigFile(): Promise<string> {
  try
  {
    const gitRoot = await findGitRoot();
    const defaultConfig = join(gitRoot, "env.jsonc");

    if (await exists(defaultConfig))
    {
      return defaultConfig;
    }

    throw new Error("Could not find env.jsonc config file in git root directory");
  } catch (error)
  {
    throw new Error(`Failed to locate config file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Interface for the environment configuration file structure
 */
export interface EnvConfig {
  base?: Record<string, string>;
  development?: Record<string, string>;
  staging?: Record<string, string>;
  production?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Load and parse the JSONC config file
 * @param configPath Path to the config file
 * @returns Parsed config object
 */
export async function loadConfig(configPath: string): Promise<EnvConfig> {
  try
  {
    const content = await Deno.readTextFile(configPath);
    return parseJsonc(content) as EnvConfig;
  } catch (error)
  {
    throw new Error(`Failed to load or parse config file: ${error instanceof Error ? error.message : String(error)}`);
  }
}
